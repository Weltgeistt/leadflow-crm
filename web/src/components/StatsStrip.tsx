import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { STAGES, STAGE_LABELS, type PipelineStats } from "@shared/domain";
import { formatMoney, formatPercent, formatShortDate } from "../lib/format";
import { useStats } from "../lib/queries";
import { Card, Skeleton, STAGE_STYLE } from "./ui";

/** The dashboard strip above the board: stage totals, momentum, win rate and a weekly chart. */
export function StatsStrip() {
  const { data: stats } = useStats();

  if (!stats) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {["lg:col-span-5", "lg:col-span-2", "lg:col-span-2", "lg:col-span-3"].map((span, i) => (
          <Skeleton key={i} className={`h-[118px] ${span}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
      <StageBreakdown stats={stats} />
      <Momentum stats={stats} />
      <WinRate stats={stats} />
      <WeeklyChart weekly={stats.weekly} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium text-muted">{children}</div>;
}

function StageBreakdown({ stats }: { stats: PipelineStats }) {
  return (
    <Card className="p-4 sm:col-span-2 lg:col-span-5">
      <div className="flex items-baseline justify-between">
        <Label>Pipeline · {stats.total} leads</Label>
        <div className="text-xs text-muted">
          <span className="font-semibold text-ink tabular-nums">{formatMoney(stats.openPipelineValue)}</span> open value
        </div>
      </div>

      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-line-soft" role="img" aria-label="Leads per stage">
        {STAGES.map((stage) =>
          stats.byStage[stage] > 0 ? (
            <div
              key={stage}
              className="h-full border-r-2 border-surface last:border-r-0"
              style={{ width: `${(stats.byStage[stage] / Math.max(1, stats.total)) * 100}%`, background: STAGE_STYLE[stage].bar }}
            />
          ) : null,
        )}
      </div>

      <dl className="mt-3.5 grid grid-cols-5 gap-2">
        {STAGES.map((stage) => (
          <div key={stage}>
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`size-1.5 rounded-full ${STAGE_STYLE[stage].dot}`} />
              {STAGE_LABELS[stage]}
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tracking-tight text-ink tabular-nums">{stats.byStage[stage]}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Momentum({ stats }: { stats: PipelineStats }) {
  const delta = stats.leadsThisWeek - stats.leadsLastWeek;
  const up = delta >= 0;
  return (
    <Card className="flex flex-col justify-between p-4 lg:col-span-2">
      <Label>New leads · 7 days</Label>
      <div className="text-[28px] leading-none font-semibold tracking-tight text-ink tabular-nums">{stats.leadsThisWeek}</div>
      <div className={`flex items-center gap-0.5 text-xs font-medium ${up ? "text-emerald-600" : "text-red-600"}`}>
        {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {up ? "+" : ""}
        {delta} <span className="ml-1 font-normal text-muted">vs prior 7 days</span>
      </div>
    </Card>
  );
}

function WinRate({ stats }: { stats: PipelineStats }) {
  return (
    <Card className="flex flex-col justify-between p-4 lg:col-span-2">
      <Label>Conversion rate</Label>
      <div className="text-[28px] leading-none font-semibold tracking-tight text-ink tabular-nums">{formatPercent(stats.winRate)}</div>
      <div className="text-xs text-muted">
        {stats.byStage.won} won · {stats.byStage.lost} lost
      </div>
    </Card>
  );
}

/** Lightweight inline-SVG bar chart: no chart library needed for 8 bars. */
function WeeklyChart({ weekly }: { weekly: PipelineStats["weekly"] }) {
  const max = Math.max(1, ...weekly.map((w) => w.count));
  const W = 240;
  const H = 58;
  const gap = 6;
  const barW = (W - gap * (weekly.length - 1)) / weekly.length;

  return (
    <Card className="p-4 sm:col-span-2 lg:col-span-3">
      <div className="flex items-baseline justify-between">
        <Label>Leads per week</Label>
        <span className="text-xs text-faint">last {weekly.length} weeks</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="mt-2 w-full" role="img" aria-label="Leads created per week">
        {weekly.map((w, i) => {
          const h = Math.max(3, (w.count / max) * H);
          const x = i * (barW + gap);
          const current = i === weekly.length - 1;
          return (
            <g key={w.weekStart}>
              <title>{`Week of ${formatShortDate(w.weekStart)}: ${w.count} leads`}</title>
              <rect x={x} y={H - h} width={barW} height={h} rx={3} fill={current ? "#4f46e5" : "#c7d2fe"} />
              {(i === 0 || current) && (
                <text
                  x={current ? x + barW : x}
                  y={H + 12}
                  textAnchor={current ? "end" : "start"}
                  className="fill-faint text-[9px]"
                >
                  {current ? "This week" : formatShortDate(w.weekStart)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </Card>
  );
}
