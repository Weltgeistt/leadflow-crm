import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import clsx from "clsx";
import { useMemo, useState } from "react";
import {
  BUDGET_ESTIMATE,
  BUDGET_LABELS,
  STAGES,
  STAGE_LABELS,
  type LeadSummary,
  type Stage,
} from "@shared/domain";
import { formatMoney, timeAgo } from "../lib/format";
import { useLeads, useMoveLead } from "../lib/queries";
import { Avatar, FollowUpBadge, Skeleton, STAGE_STYLE } from "./ui";

/** Kanban board: drag a card to another column to change its stage. */
export function Board({ onOpen, selectedId }: { onOpen: (id: number) => void; selectedId: number | null }) {
  const { data: leads, isLoading } = useLeads();
  const move = useMoveLead();
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    // A small distance threshold lets a plain click open the card instead of starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Space picks a card up / drops it; Enter is left free to open the lead panel.
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const columns = useMemo(() => {
    const byStage = Object.fromEntries(STAGES.map((s) => [s, [] as LeadSummary[]])) as Record<Stage, LeadSummary[]>;
    for (const lead of leads ?? []) byStage[lead.stage].push(lead);
    // Most urgent first: stale leads on top, then most recent activity.
    for (const list of Object.values(byStage)) {
      list.sort(
        (a, b) => Number(b.needsFollowUp) - Number(a.needsFollowUp) || b.lastActivityAt.localeCompare(a.lastActivityAt),
      );
    }
    return byStage;
  }, [leads]);

  const active = leads?.find((l) => l.id === activeId) ?? null;

  const onDragStart = (e: DragStartEvent) => setActiveId(Number(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const stage = e.over?.id as Stage | undefined;
    const lead = leads?.find((l) => l.id === Number(e.active.id));
    if (lead && stage && lead.stage !== stage) move.mutate({ id: lead.id, stage });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {STAGES.map((s) => (
          <Skeleton key={s} className="h-80" />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="scrollbar-thin -mx-5 overflow-x-auto px-5 pb-2 md:-mx-8 md:px-8">
        <div className="grid min-w-[1060px] grid-cols-5 gap-4">
          {STAGES.map((stage) => (
            <Column key={stage} stage={stage} leads={columns[stage]} onOpen={onOpen} selectedId={selectedId} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {active ? <LeadCard lead={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  stage,
  leads,
  onOpen,
  selectedId,
}: {
  stage: Stage;
  leads: LeadSummary[];
  onOpen: (id: number) => void;
  selectedId: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const value = leads.reduce((sum, l) => sum + BUDGET_ESTIMATE[l.budget], 0);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${STAGE_LABELS[stage]} column`}
      className={clsx(
        "flex min-h-[420px] flex-col rounded-xl border p-2 transition-colors",
        isOver ? "border-brand-200 bg-brand-50/70" : "border-transparent bg-line-soft/70",
      )}
    >
      <header className="flex items-center justify-between px-2 pt-1 pb-2.5">
        <div className="flex items-center gap-2">
          <span className={clsx("size-2 rounded-full", STAGE_STYLE[stage].dot)} />
          <h3 className="text-[13px] font-semibold text-ink">{STAGE_LABELS[stage]}</h3>
          <span className="rounded-md bg-surface px-1.5 text-xs font-medium text-muted tabular-nums ring-1 ring-line">
            {leads.length}
          </span>
        </div>
        <span className="text-xs text-faint tabular-nums">{formatMoney(value)}</span>
      </header>

      <div className="flex flex-1 flex-col gap-2">
        {leads.map((lead) => (
          <DraggableCard key={lead.id} lead={lead} onOpen={onOpen} selected={lead.id === selectedId} />
        ))}
        {leads.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line text-xs text-faint">
            Drop a lead here
          </div>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ lead, onOpen, selected }: { lead: LeadSummary; onOpen: (id: number) => void; selected: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(lead.id);
        listeners?.onKeyDown?.(e);
      }}
      aria-label={`${lead.name}, ${lead.company}. Press Enter to open, Space to move.`}
      className={clsx("rounded-lg outline-none", isDragging && "opacity-40")}
    >
      <LeadCard lead={lead} selected={selected} />
    </div>
  );
}

export function LeadCard({ lead, overlay, selected }: { lead: LeadSummary; overlay?: boolean; selected?: boolean }) {
  return (
    <article
      className={clsx(
        "cursor-grab rounded-lg border bg-surface p-3 transition-shadow select-none",
        overlay ? "rotate-[1.5deg] cursor-grabbing border-brand-200 shadow-lift" : "shadow-card hover:shadow-md",
        selected ? "border-brand-500 ring-2 ring-brand-100" : "border-line",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={lead.name} size="sm" />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[13px] font-semibold text-ink">{lead.name}</h4>
          <p className="truncate text-xs text-muted">{lead.company || lead.email}</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="rounded-md bg-canvas px-1.5 py-0.5 text-[11px] font-medium text-ink-2 ring-1 ring-line ring-inset">
          {BUDGET_LABELS[lead.budget]}
        </span>
        <time className="ml-auto shrink-0 text-[11px] text-faint" dateTime={lead.createdAt} title="Lead age">
          {timeAgo(lead.createdAt)}
        </time>
      </div>
      {lead.needsFollowUp && (
        <div className="mt-2">
          <FollowUpBadge days={lead.daysIdle} />
        </div>
      )}
    </article>
  );
}
