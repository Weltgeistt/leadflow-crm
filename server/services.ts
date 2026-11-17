/**
 * Application services: the workflows that span several repositories and
 * the mailer. Route handlers stay thin and only translate HTTP <-> calls here.
 */
import type { EmailRecord, LeadDetail, LeadSummary, NewLead, Stage } from "../shared/domain.js";
import type { Mailer } from "./email/mailer.js";
import { digestEmail, followUpEmail } from "./email/templates.js";
import { selectNeedsAttention, summarize } from "./reminders.js";
import type { EmailRepository, LeadRepository } from "./repositories.js";

export interface ServiceDeps {
  leads: LeadRepository;
  emails: EmailRepository;
  mailer: Mailer;
  followUpAfterDays: number;
  owner: { email: string; name: string };
  appUrl: string;
  /** Injectable clock so tests (and the seed script) control "now". */
  now: () => Date;
  log?: Pick<Console, "info" | "error">;
}

export class LeadService {
  constructor(private readonly deps: ServiceDeps) {}

  list(): LeadSummary[] {
    const now = this.deps.now();
    return this.deps.leads.list().map((l) => summarize(l, now, this.deps.followUpAfterDays));
  }

  detail(id: number): LeadDetail | undefined {
    const lead = this.deps.leads.get(id);
    if (!lead) return undefined;
    return {
      ...summarize(lead, this.deps.now(), this.deps.followUpAfterDays),
      activities: this.deps.leads.activities(id),
      emails: this.deps.emails.forLead(id),
    };
  }

  needsAttention(): LeadSummary[] {
    return selectNeedsAttention(this.deps.leads.list(), this.deps.now(), this.deps.followUpAfterDays);
  }

  /**
   * Stores a new lead and immediately sends the "we'll get back within 24h"
   * auto-reply. A mail failure is logged on the timeline but never loses the lead.
   */
  async capture(input: NewLead): Promise<LeadDetail> {
    const lead = this.deps.leads.create(input, this.deps.now());
    try {
      const email = followUpEmail(lead, this.deps.owner.name);
      await this.deps.mailer.send({ ...email, to: lead.email, kind: "follow_up", leadId: lead.id }, this.deps.now());
      this.deps.leads.addActivity(lead.id, "emailed", `Auto-reply sent: “${email.subject}”`, this.deps.now());
    } catch (error) {
      this.deps.log?.error(`[mailer] follow-up to lead #${lead.id} failed`, error);
      this.deps.leads.addActivity(lead.id, "emailed", "Auto-reply could not be sent — check SMTP settings", this.deps.now());
    }
    return this.detail(lead.id)!;
  }

  moveToStage(id: number, stage: Stage): LeadDetail | undefined {
    const updated = this.deps.leads.setStage(id, stage, this.deps.now());
    return updated && this.detail(id);
  }

  markContacted(id: number): LeadDetail | undefined {
    const lead = this.deps.leads.get(id);
    if (!lead) return undefined;
    if (lead.stage === "new") {
      this.deps.leads.setStage(id, "contacted", this.deps.now(), "contacted");
    } else {
      // Already further along: just log the touchpoint, which resets the reminder.
      this.deps.leads.addActivity(id, "contacted", "Followed up with the lead", this.deps.now());
    }
    return this.detail(id);
  }

  addNote(id: number, body: string): LeadDetail | undefined {
    if (!this.deps.leads.get(id)) return undefined;
    this.deps.leads.addActivity(id, "note", body, this.deps.now());
    return this.detail(id);
  }

  /** Emails the owner a list of stale leads. Returns null when there is nothing to report. */
  async sendDigest(): Promise<EmailRecord | null> {
    const stale = this.needsAttention();
    if (stale.length === 0) return null;
    const email = digestEmail(stale, this.deps.owner.name, this.deps.appUrl);
    return this.deps.mailer.send({ ...email, to: this.deps.owner.email, kind: "digest" }, this.deps.now());
  }
}
