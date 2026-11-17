import { describe, expect, it } from "vitest";
import type { Lead, Stage } from "../shared/domain.js";
import { needsFollowUp, selectNeedsAttention, summarize, wholeDaysBetween } from "../server/reminders.js";

const NOW = new Date("2026-03-10T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function lead(id: number, stage: Stage, idleDays: number): Lead {
  const last = new Date(NOW.getTime() - idleDays * DAY).toISOString();
  return {
    id,
    name: `Lead ${id}`,
    email: `lead${id}@test.example`,
    company: "Test Co",
    need: "Automate something useful",
    budget: "1k_5k",
    stage,
    createdAt: last,
    updatedAt: last,
    lastActivityAt: last,
  };
}

describe("wholeDaysBetween", () => {
  it("counts only completed days", () => {
    expect(wholeDaysBetween(new Date(NOW.getTime() - 2.9 * DAY), NOW)).toBe(2);
    expect(wholeDaysBetween(new Date(NOW.getTime() - 3 * DAY), NOW)).toBe(3);
  });

  it("never returns a negative number for timestamps in the future", () => {
    expect(wholeDaysBetween(new Date(NOW.getTime() + DAY), NOW)).toBe(0);
  });
});

describe("needsFollowUp", () => {
  it("flags a New lead once it has been idle for the threshold", () => {
    expect(needsFollowUp(lead(1, "new", 3), NOW, 3)).toBe(true);
    expect(needsFollowUp(lead(1, "new", 2.99), NOW, 3)).toBe(false);
  });

  it("flags Contacted leads too", () => {
    expect(needsFollowUp(lead(1, "contacted", 5), NOW, 3)).toBe(true);
  });

  it.each<Stage>(["proposal", "won", "lost"])("never flags leads in %s", (stage) => {
    expect(needsFollowUp(lead(1, stage, 30), NOW, 3)).toBe(false);
  });

  it("respects a custom threshold", () => {
    expect(needsFollowUp(lead(1, "new", 5), NOW, 7)).toBe(false);
    expect(needsFollowUp(lead(1, "new", 7), NOW, 7)).toBe(true);
  });
});

describe("summarize", () => {
  it("adds daysIdle and needsFollowUp without touching the lead fields", () => {
    const base = lead(4, "contacted", 4.5);
    const summary = summarize(base, NOW, 3);
    expect(summary).toMatchObject({ ...base, daysIdle: 4, needsFollowUp: true });
  });
});

describe("selectNeedsAttention", () => {
  it("returns only stale active leads, longest-waiting first", () => {
    const leads = [
      lead(1, "new", 1),
      lead(2, "new", 4),
      lead(3, "contacted", 9),
      lead(4, "proposal", 20),
      lead(5, "contacted", 3),
      lead(6, "won", 12),
    ];
    const result = selectNeedsAttention(leads, NOW, 3);
    expect(result.map((l) => l.id)).toEqual([3, 2, 5]);
    expect(result.every((l) => l.needsFollowUp)).toBe(true);
  });

  it("returns an empty list when everything is fresh", () => {
    expect(selectNeedsAttention([lead(1, "new", 0), lead(2, "contacted", 2)], NOW, 3)).toEqual([]);
  });
});
