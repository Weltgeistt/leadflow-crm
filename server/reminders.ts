/**
 * Reminder rules — pure functions, no I/O, so they are trivial to unit test.
 *
 * A lead "needs follow-up" when it is still waiting on us (New or Contacted)
 * and nothing has happened on it for at least `followUpAfterDays` days.
 * Any timeline entry counts as activity: a note, an email, a stage change.
 */
import { ACTIVE_STAGES, type Lead, type LeadSummary } from "../shared/domain.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days elapsed between two instants (never negative). */
export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

export function needsFollowUp(lead: Lead, now: Date, followUpAfterDays: number): boolean {
  if (!ACTIVE_STAGES.includes(lead.stage)) return false;
  return wholeDaysBetween(new Date(lead.lastActivityAt), now) >= followUpAfterDays;
}

/** Adds the computed reminder fields the UI needs to a lead. */
export function summarize(lead: Lead, now: Date, followUpAfterDays: number): LeadSummary {
  return {
    ...lead,
    daysIdle: wholeDaysBetween(new Date(lead.lastActivityAt), now),
    needsFollowUp: needsFollowUp(lead, now, followUpAfterDays),
  };
}

/** Leads that need a follow-up, the longest-waiting first. */
export function selectNeedsAttention(
  leads: readonly Lead[],
  now: Date,
  followUpAfterDays: number,
): LeadSummary[] {
  return leads
    .map((lead) => summarize(lead, now, followUpAfterDays))
    .filter((lead) => lead.needsFollowUp)
    .sort((a, b) => b.daysIdle - a.daysIdle || a.id - b.id);
}
