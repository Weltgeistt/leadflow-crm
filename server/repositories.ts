import {
  STAGE_LABELS,
  type Activity,
  type ActivityType,
  type Budget,
  type EmailDetail,
  type EmailKind,
  type EmailRecord,
  type EmailTransport,
  type Lead,
  type NewLead,
  type Stage,
} from "../shared/domain.js";
import type { DB } from "./db.js";

// Row shapes as stored in SQLite (snake_case), mapped to the camelCase API types.

interface LeadRow {
  id: number;
  name: string;
  email: string;
  company: string;
  need: string;
  budget: Budget;
  stage: Stage;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

interface ActivityRow {
  id: number;
  lead_id: number;
  type: ActivityType;
  body: string;
  created_at: string;
}

interface EmailRow {
  id: number;
  lead_id: number | null;
  kind: EmailKind;
  to_address: string;
  subject: string;
  html: string;
  text: string;
  transport: EmailTransport;
  file: string | null;
  created_at: string;
}

const toLead = (r: LeadRow): Lead => ({
  id: r.id,
  name: r.name,
  email: r.email,
  company: r.company,
  need: r.need,
  budget: r.budget,
  stage: r.stage,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  lastActivityAt: r.last_activity_at,
});

const toActivity = (r: ActivityRow): Activity => ({
  id: r.id,
  leadId: r.lead_id,
  type: r.type,
  body: r.body,
  createdAt: r.created_at,
});

const toEmailRecord = (r: EmailRow): EmailRecord => ({
  id: r.id,
  leadId: r.lead_id,
  kind: r.kind,
  to: r.to_address,
  subject: r.subject,
  transport: r.transport,
  createdAt: r.created_at,
});

export class LeadRepository {
  constructor(private readonly db: DB) {}

  count(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM leads").get() as { n: number }).n;
  }

  list(): Lead[] {
    const rows = this.db.prepare("SELECT * FROM leads ORDER BY last_activity_at DESC").all() as LeadRow[];
    return rows.map(toLead);
  }

  get(id: number): Lead | undefined {
    const row = this.db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as LeadRow | undefined;
    return row && toLead(row);
  }

  /** Inserts a lead together with its "created" timeline entry. */
  create(input: NewLead, at: Date, stage: Stage = "new"): Lead {
    const iso = at.toISOString();
    const id = this.db.transaction(() => {
      const { lastInsertRowid } = this.db
        .prepare(
          `INSERT INTO leads (name, email, company, need, budget, stage, created_at, updated_at, last_activity_at)
           VALUES (@name, @email, @company, @need, @budget, @stage, @iso, @iso, @iso)`,
        )
        .run({ ...input, stage, iso });
      const leadId = Number(lastInsertRowid);
      this.insertActivity(leadId, "created", "Lead submitted via the website form", iso);
      return leadId;
    })();
    return this.get(id)!;
  }

  /** Moves a lead to another stage and records the change on its timeline. */
  setStage(id: number, stage: Stage, at: Date, type: ActivityType = "stage_changed"): Lead | undefined {
    const lead = this.get(id);
    if (!lead) return undefined;
    if (lead.stage === stage) return lead;

    const iso = at.toISOString();
    this.db.transaction(() => {
      this.db.prepare("UPDATE leads SET stage = ?, updated_at = ? WHERE id = ?").run(stage, iso, id);
      const body =
        type === "contacted"
          ? "Marked as contacted"
          : `Moved from ${STAGE_LABELS[lead.stage]} to ${STAGE_LABELS[stage]}`;
      this.insertActivity(id, type, body, iso);
    })();
    return this.get(id);
  }

  addActivity(leadId: number, type: ActivityType, body: string, at: Date): Activity {
    return this.db.transaction(() => this.insertActivity(leadId, type, body, at.toISOString()))();
  }

  activities(leadId: number): Activity[] {
    const rows = this.db
      .prepare("SELECT * FROM activities WHERE lead_id = ? ORDER BY created_at DESC, id DESC")
      .all(leadId) as ActivityRow[];
    return rows.map(toActivity);
  }

  /** Every activity bumps the lead's "last activity" timestamp used by reminders. */
  private insertActivity(leadId: number, type: ActivityType, body: string, iso: string): Activity {
    const { lastInsertRowid } = this.db
      .prepare("INSERT INTO activities (lead_id, type, body, created_at) VALUES (?, ?, ?, ?)")
      .run(leadId, type, body, iso);
    this.db
      .prepare("UPDATE leads SET last_activity_at = MAX(last_activity_at, ?) WHERE id = ?")
      .run(iso, leadId);
    return { id: Number(lastInsertRowid), leadId, type, body, createdAt: iso };
  }
}

export interface NewEmailRecord {
  leadId: number | null;
  kind: EmailKind;
  to: string;
  subject: string;
  html: string;
  text: string;
  transport: EmailTransport;
  file: string | null;
  createdAt: string;
}

export class EmailRepository {
  constructor(private readonly db: DB) {}

  insert(email: NewEmailRecord): EmailRecord {
    const { lastInsertRowid } = this.db
      .prepare(
        `INSERT INTO emails (lead_id, kind, to_address, subject, html, text, transport, file, created_at)
         VALUES (@leadId, @kind, @to, @subject, @html, @text, @transport, @file, @createdAt)`,
      )
      .run(email);
    return this.get(Number(lastInsertRowid))!;
  }

  list(limit = 100): EmailRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM emails ORDER BY created_at DESC, id DESC LIMIT ?")
      .all(limit) as EmailRow[];
    return rows.map(toEmailRecord);
  }

  forLead(leadId: number): EmailRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM emails WHERE lead_id = ? ORDER BY created_at DESC")
      .all(leadId) as EmailRow[];
    return rows.map(toEmailRecord);
  }

  get(id: number): EmailDetail | undefined {
    const row = this.db.prepare("SELECT * FROM emails WHERE id = ?").get(id) as EmailRow | undefined;
    return row && { ...toEmailRecord(row), html: row.html, text: row.text, file: row.file };
  }
}
