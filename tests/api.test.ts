import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig, EmailDetail, EmailRecord, LeadDetail, LeadSummary, PipelineStats } from "../shared/domain.js";
import { createApp } from "../server/app.js";
import { loadConfig } from "../server/config.js";
import { createContainer, type Container } from "../server/container.js";

const DAY = 24 * 60 * 60 * 1000;

const validLead = {
  name: "Maya Chen",
  email: "Maya@Northwind.example",
  company: "Northwind Logistics",
  need: "Automate shipment tracking updates into one dashboard.",
  budget: "15k_50k",
};

let clock: Date;
let outboxDir: string;
let container: Container;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  clock = new Date("2026-03-10T09:00:00.000Z");
  outboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "leadflow-outbox-"));
  // An empty SMTP_HOST puts the mailer in preview mode, so nothing is sent.
  const config = loadConfig({ DATABASE_PATH: ":memory:", OUTBOX_DIR: outboxDir, SMTP_HOST: "", FOLLOW_UP_AFTER_DAYS: "3" });
  container = createContainer(config, { now: () => clock });
  app = createApp({
    service: container.service,
    emails: container.emails,
    mailer: container.mailer,
    now: () => clock,
    config: { followUpAfterDays: 3, ownerEmail: config.owner.email, digestCron: config.digestCron },
  });
});

afterEach(() => {
  container.db.close();
  fs.rmSync(outboxDir, { recursive: true, force: true });
});

const advance = (days: number) => {
  clock = new Date(clock.getTime() + days * DAY);
};

async function createLead(body: object = validLead): Promise<LeadDetail> {
  const res = await request(app).post("/api/leads").send(body).expect(201);
  return res.body as LeadDetail;
}

describe("POST /api/leads", () => {
  it("stores the lead, normalises input and starts it in New", async () => {
    const lead = await createLead();
    expect(lead).toMatchObject({
      name: "Maya Chen",
      email: "maya@northwind.example",
      stage: "new",
      needsFollowUp: false,
    });

    const list = (await request(app).get("/api/leads").expect(200)).body as LeadSummary[];
    expect(list).toHaveLength(1);
  });

  it("sends the auto-reply and writes a preview to the outbox", async () => {
    const lead = await createLead();

    expect(lead.emails).toHaveLength(1);
    expect(lead.emails[0]).toMatchObject({ kind: "follow_up", to: "maya@northwind.example", transport: "preview" });
    expect(lead.activities.map((a) => a.type)).toEqual(["emailed", "created"]);

    const files = fs.readdirSync(outboxDir);
    expect(files.filter((f) => f.endsWith(".eml"))).toHaveLength(1);
    expect(files.filter((f) => f.endsWith(".html"))).toHaveLength(1);

    const email = (await request(app).get(`/api/outbox/${lead.emails[0]!.id}`).expect(200)).body as EmailDetail;
    expect(email.subject).toContain("within 24h");
    expect(email.html).toContain("Northwind Logistics");
  });

  it("escapes user input in the email HTML", async () => {
    const lead = await createLead({ ...validLead, company: "<script>alert(1)</script>" });
    const email = (await request(app).get(`/api/outbox/${lead.emails[0]!.id}`)).body as EmailDetail;
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("rejects invalid input with per-field messages", async () => {
    const res = await request(app)
      .post("/api/leads")
      .send({ name: "M", email: "not-an-email", need: "short", budget: "a lot" })
      .expect(400);

    expect(res.body.error).toBe("Validation failed");
    expect(Object.keys(res.body.details).sort()).toEqual(["budget", "email", "name", "need"]);
    expect((await request(app).get("/api/leads")).body).toHaveLength(0);
  });
});

describe("pipeline actions", () => {
  it("moves a lead between stages and logs it on the timeline", async () => {
    const { id } = await createLead();
    const res = await request(app).patch(`/api/leads/${id}/stage`).send({ stage: "proposal" }).expect(200);
    const lead = res.body as LeadDetail;

    expect(lead.stage).toBe("proposal");
    expect(lead.activities[0]).toMatchObject({ type: "stage_changed", body: "Moved from New to Proposal" });
  });

  it("rejects unknown stages and unknown leads", async () => {
    const { id } = await createLead();
    await request(app).patch(`/api/leads/${id}/stage`).send({ stage: "maybe" }).expect(400);
    await request(app).patch("/api/leads/999/stage").send({ stage: "won" }).expect(404);
    await request(app).get("/api/leads/abc").expect(400);
  });

  it("adds notes", async () => {
    const { id } = await createLead();
    const lead = (await request(app).post(`/api/leads/${id}/notes`).send({ body: "Call booked" }).expect(201))
      .body as LeadDetail;
    expect(lead.activities[0]).toMatchObject({ type: "note", body: "Call booked" });

    await request(app).post(`/api/leads/${id}/notes`).send({ body: "   " }).expect(400);
  });
});

describe("reminders", () => {
  it("flags a quiet lead after N days, and 'Mark contacted' clears it", async () => {
    const { id } = await createLead();

    advance(2);
    expect((await request(app).get("/api/attention")).body).toHaveLength(0);

    advance(1);
    const attention = (await request(app).get("/api/attention")).body as LeadSummary[];
    expect(attention.map((l) => l.id)).toEqual([id]);
    expect(attention[0]!.daysIdle).toBe(3);

    const lead = (await request(app).post(`/api/leads/${id}/contacted`).expect(200)).body as LeadDetail;
    expect(lead.stage).toBe("contacted");
    expect(lead.needsFollowUp).toBe(false);
    expect((await request(app).get("/api/attention")).body).toHaveLength(0);
  });

  it("emails a digest of stale leads to the owner, and skips it when there are none", async () => {
    await createLead();
    expect((await request(app).post("/api/digest").expect(200)).body).toEqual({ sent: false, email: null });

    advance(4);
    const res = await request(app).post("/api/digest").expect(200);
    const email = res.body.email as EmailRecord;
    expect(res.body.sent).toBe(true);
    expect(email).toMatchObject({ kind: "digest", subject: "1 lead needs a follow-up today" });

    const outbox = (await request(app).get("/api/outbox")).body as EmailRecord[];
    expect(outbox[0]!.id).toBe(email.id);
  });
});

describe("dashboard", () => {
  it("reports totals, win rate and recent leads", async () => {
    const a = await createLead();
    const b = await createLead({ ...validLead, email: "b@test.example" });
    await createLead({ ...validLead, email: "c@test.example" });
    await request(app).patch(`/api/leads/${a.id}/stage`).send({ stage: "won" });
    await request(app).patch(`/api/leads/${b.id}/stage`).send({ stage: "lost" });

    const stats = (await request(app).get("/api/stats").expect(200)).body as PipelineStats;
    expect(stats.total).toBe(3);
    expect(stats.byStage).toEqual({ new: 1, contacted: 0, proposal: 0, won: 1, lost: 1 });
    expect(stats.winRate).toBe(0.5);
    expect(stats.leadsThisWeek).toBe(3);
    expect(stats.weekly).toHaveLength(8);
    expect(stats.weekly.at(-1)!.count).toBe(3);
  });

  it("exposes non-secret config to the UI", async () => {
    const config = (await request(app).get("/api/config").expect(200)).body as AppConfig;
    expect(config).toMatchObject({ followUpAfterDays: 3, mailMode: "preview" });
    expect(JSON.stringify(config)).not.toMatch(/pass/i);
  });
});
