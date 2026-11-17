import { BellRing, CheckCircle2 } from "lucide-react";
import { STAGE_LABELS } from "@shared/domain";
import { useAttention, useConfig } from "../lib/queries";
import { Avatar, Card } from "./ui";

/** Stale New/Contacted leads, surfaced above the board so they can't be missed. */
export function NeedsAttention({ onOpen }: { onOpen: (id: number) => void }) {
  const { data: leads } = useAttention();
  const { data: config } = useConfig();
  if (!leads) return null;

  if (leads.length === 0) {
    return (
      <Card className="flex items-center gap-3 px-4 py-3 text-sm text-muted">
        <CheckCircle2 size={18} className="text-emerald-500" />
        All caught up — every active lead has been touched in the last {config?.followUpAfterDays ?? 3} days.
      </Card>
    );
  }

  return (
    <section aria-labelledby="attention-title" className="rounded-xl border border-red-100 bg-gradient-to-b from-red-50/70 to-surface shadow-card">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <h2 id="attention-title" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="flex size-6 items-center justify-center rounded-md bg-red-100 text-red-600">
            <BellRing size={14} />
          </span>
          Needs attention
          <span className="rounded-full bg-red-600 px-1.5 text-[11px] leading-5 font-semibold text-white tabular-nums">
            {leads.length}
          </span>
        </h2>
        <p className="hidden text-xs text-muted sm:block">
          No activity for {config?.followUpAfterDays ?? 3}+ days · included in the daily digest
        </p>
      </div>

      <ul className="scrollbar-thin flex gap-3 overflow-x-auto px-4 pt-3 pb-4 [mask-image:linear-gradient(to_right,black_calc(100%-48px),transparent)]">
        {leads.map((lead) => (
          <li key={lead.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onOpen(lead.id)}
              className="flex w-60 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left shadow-card transition hover:-translate-y-px hover:border-red-200 hover:shadow-md"
            >
              <Avatar name={lead.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{lead.name}</span>
                <span className="block truncate text-xs text-muted">{lead.company || lead.email}</span>
                <span className="block text-[11px] text-faint">In {STAGE_LABELS[lead.stage]}</span>
              </span>
              <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700 tabular-nums">
                {lead.daysIdle}d
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
