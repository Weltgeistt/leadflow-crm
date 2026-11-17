/**
 * Domain model shared by the API and the web app.
 * Zod schemas are the single source of truth: types are inferred from them,
 * and the same schemas validate the public form in the browser and the
 * request bodies on the server.
 */
import { z } from "zod";

export const STAGES = ["new", "contacted", "proposal", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  new: "New",
  contacted: "Contacted",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

/** Stages in which a lead is still waiting on us and can go stale. */
export const ACTIVE_STAGES: readonly Stage[] = ["new", "contacted"];

export const BUDGETS = ["under_1k", "1k_5k", "5k_15k", "15k_50k", "50k_plus"] as const;
export type Budget = (typeof BUDGETS)[number];

export const BUDGET_LABELS: Record<Budget, string> = {
  under_1k: "Under $1k",
  "1k_5k": "$1k – $5k",
  "5k_15k": "$5k – $15k",
  "15k_50k": "$15k – $50k",
  "50k_plus": "$50k+",
};

/** Mid-point estimate used for the pipeline value on the dashboard. */
export const BUDGET_ESTIMATE: Record<Budget, number> = {
  under_1k: 750,
  "1k_5k": 3_000,
  "5k_15k": 10_000,
  "15k_50k": 30_000,
  "50k_plus": 60_000,
};

export const ACTIVITY_TYPES = ["created", "emailed", "stage_changed", "note", "contacted"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// ─── Request schemas ──────────────────────────────────────────────────────

export const newLeadSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80, "That name is a bit long"),
  email: z.string().trim().toLowerCase().pipe(z.email("Please enter a valid email address")),
  company: z.string().trim().max(100, "Please keep it under 100 characters").default(""),
  need: z
    .string()
    .trim()
    .min(10, "Tell us a little more (at least 10 characters)")
    .max(2000, "Please keep it under 2000 characters"),
  budget: z.enum(BUDGETS, { message: "Please choose a budget range" }),
});
export type NewLeadInput = z.input<typeof newLeadSchema>;
export type NewLead = z.output<typeof newLeadSchema>;

export const stageChangeSchema = z.object({ stage: z.enum(STAGES) });

export const noteSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty").max(2000),
});

// ─── API response shapes ──────────────────────────────────────────────────

export interface Lead {
  id: number;
  name: string;
  email: string;
  company: string;
  need: string;
  budget: Budget;
  stage: Stage;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

/** A lead as returned by the API, with reminder fields computed. */
export interface LeadSummary extends Lead {
  needsFollowUp: boolean;
  daysIdle: number;
}

export interface Activity {
  id: number;
  leadId: number;
  type: ActivityType;
  body: string;
  createdAt: string;
}

export type EmailKind = "follow_up" | "digest";
export type EmailTransport = "smtp" | "preview";

export interface EmailRecord {
  id: number;
  leadId: number | null;
  kind: EmailKind;
  to: string;
  subject: string;
  transport: EmailTransport;
  createdAt: string;
}

export interface EmailDetail extends EmailRecord {
  html: string;
  text: string;
  file: string | null;
}

export interface LeadDetail extends LeadSummary {
  activities: Activity[];
  emails: EmailRecord[];
}

export interface PipelineStats {
  total: number;
  byStage: Record<Stage, number>;
  /** Won ÷ (won + lost), 0–1. Null while nothing is closed yet. */
  winRate: number | null;
  leadsThisWeek: number;
  leadsLastWeek: number;
  /** Estimated value of open deals (new, contacted, proposal). */
  openPipelineValue: number;
  /** Leads created per week, oldest first. */
  weekly: { weekStart: string; count: number }[];
}

export interface AppConfig {
  followUpAfterDays: number;
  mailMode: EmailTransport;
  ownerEmail: string;
  digestCron: string;
}
