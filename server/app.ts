import fs from "node:fs";
import path from "node:path";
import express, { Router } from "express";
import { newLeadSchema, noteSchema, stageChangeSchema, type AppConfig } from "../shared/domain.js";
import type { Mailer } from "./email/mailer.js";
import { errorHandler, notFound, parseBody, parseId } from "./http.js";
import type { EmailRepository } from "./repositories.js";
import type { LeadService } from "./services.js";
import { computeStats } from "./stats.js";

export interface AppContext {
  service: LeadService;
  emails: EmailRepository;
  mailer: Mailer;
  config: Omit<AppConfig, "mailMode">;
  now: () => Date;
  /** Built web app to serve in production (dist/web). Omitted in dev and tests. */
  staticDir?: string;
}

export function createApp(ctx: AppContext): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  app.use("/api", apiRouter(ctx));
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  if (ctx.staticDir && fs.existsSync(ctx.staticDir)) {
    const index = path.join(ctx.staticDir, "index.html");
    app.use(express.static(ctx.staticDir, { maxAge: "1h", index: false }));
    // Client-side routing: every non-API GET falls back to the SPA shell.
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(index));
  }

  app.use(errorHandler);
  return app;
}

function apiRouter({ service, emails, mailer, config, now }: AppContext): Router {
  const r = Router();

  r.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  r.get("/config", (_req, res) => {
    const body: AppConfig = { ...config, mailMode: mailer.mode };
    res.json(body);
  });

  // ─── Leads ────────────────────────────────────────────────────────────

  r.get("/leads", (_req, res) => {
    res.json(service.list());
  });

  /** Public endpoint used by the lead capture form. */
  r.post("/leads", async (req, res) => {
    const input = parseBody(newLeadSchema, req);
    const lead = await service.capture(input);
    res.status(201).json(lead);
  });

  r.get("/leads/:id", (req, res) => {
    const lead = service.detail(parseId(req.params.id));
    if (!lead) throw notFound("Lead");
    res.json(lead);
  });

  r.patch("/leads/:id/stage", (req, res) => {
    const { stage } = parseBody(stageChangeSchema, req);
    const lead = service.moveToStage(parseId(req.params.id), stage);
    if (!lead) throw notFound("Lead");
    res.json(lead);
  });

  r.post("/leads/:id/contacted", (req, res) => {
    const lead = service.markContacted(parseId(req.params.id));
    if (!lead) throw notFound("Lead");
    res.json(lead);
  });

  r.post("/leads/:id/notes", (req, res) => {
    const { body } = parseBody(noteSchema, req);
    const lead = service.addNote(parseId(req.params.id), body);
    if (!lead) throw notFound("Lead");
    res.status(201).json(lead);
  });

  // ─── Reminders & dashboard ────────────────────────────────────────────

  r.get("/attention", (_req, res) => {
    res.json(service.needsAttention());
  });

  r.get("/stats", (_req, res) => {
    res.json(computeStats(service.list(), now()));
  });

  /** Runs the daily digest on demand (the scheduler calls the same code). */
  r.post("/digest", async (_req, res) => {
    const email = await service.sendDigest();
    res.json({ sent: email !== null, email });
  });

  // ─── Outbox ───────────────────────────────────────────────────────────

  r.get("/outbox", (_req, res) => {
    res.json(emails.list());
  });

  r.get("/outbox/:id", (req, res) => {
    const email = emails.get(parseId(req.params.id));
    if (!email) throw notFound("Email");
    res.json(email);
  });

  return r;
}
