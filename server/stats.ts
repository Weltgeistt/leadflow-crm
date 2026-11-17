import { BUDGET_ESTIMATE, STAGES, type Lead, type PipelineStats, type Stage } from "../shared/domain.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STAGES: readonly Stage[] = ["new", "contacted", "proposal"];

/** Monday 00:00 UTC of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - daysSinceMonday * DAY_MS);
}

/** Dashboard numbers, computed from the full lead list (fine at CRM scale). */
export function computeStats(leads: readonly Lead[], now: Date, weeks = 8): PipelineStats {
  const byStage = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const lead of leads) byStage[lead.stage]++;

  const closed = byStage.won + byStage.lost;
  const thisWeekStart = startOfWeek(now).getTime();
  // "This week" is a rolling 7-day window so the number is meaningful on a Monday too.
  const nowMs = now.getTime();
  const sevenDaysAgo = nowMs - 7 * DAY_MS;
  const fourteenDaysAgo = nowMs - 14 * DAY_MS;
  const created = leads.map((l) => new Date(l.createdAt).getTime());

  const weekly = Array.from({ length: weeks }, (_, i) => {
    const start = thisWeekStart - (weeks - 1 - i) * 7 * DAY_MS;
    const end = start + 7 * DAY_MS;
    return {
      weekStart: new Date(start).toISOString(),
      count: created.filter((t) => t >= start && t < end).length,
    };
  });

  return {
    total: leads.length,
    byStage,
    winRate: closed === 0 ? null : byStage.won / closed,
    leadsThisWeek: created.filter((t) => t > sevenDaysAgo && t <= nowMs).length,
    leadsLastWeek: created.filter((t) => t > fourteenDaysAgo && t <= sevenDaysAgo).length,
    openPipelineValue: leads
      .filter((l) => OPEN_STAGES.includes(l.stage))
      .reduce((sum, l) => sum + BUDGET_ESTIMATE[l.budget], 0),
    weekly,
  };
}
