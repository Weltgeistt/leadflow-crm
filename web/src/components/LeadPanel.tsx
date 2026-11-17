import clsx from "clsx";
import {
  ArrowRightLeft,
  CheckCheck,
  ChevronDown,
  Mail,
  MailCheck,
  PhoneOutgoing,
  Sparkles,
  StickyNote,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BUDGET_LABELS, STAGES, STAGE_LABELS, type ActivityType, type Stage } from "@shared/domain";
import { formatDateTime, timeAgo } from "../lib/format";
import { useAddNote, useLead, useMarkContacted, useMoveLead } from "../lib/queries";
import { Avatar, Button, FollowUpBadge, Skeleton, STAGE_STYLE } from "./ui";

const ACTIVITY_ICON: Record<ActivityType, { icon: LucideIcon; tone: string; label: string }> = {
  created: { icon: Sparkles, tone: "bg-brand-50 text-brand-600", label: "Lead created" },
  emailed: { icon: MailCheck, tone: "bg-sky-50 text-sky-600", label: "Email" },
  stage_changed: { icon: ArrowRightLeft, tone: "bg-amber-50 text-amber-600", label: "Stage changed" },
  contacted: { icon: PhoneOutgoing, tone: "bg-violet-50 text-violet-600", label: "Contacted" },
  note: { icon: StickyNote, tone: "bg-emerald-50 text-emerald-600", label: "Note" },
};

/** Slide-over with everything about one lead: details, quick actions, notes and timeline. */
export function LeadPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: lead } = useLead(id);
  const markContacted = useMarkContacted();
  const move = useMoveLead();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Move focus into the dialog without showing a focus ring on any one control.
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Lead details">
      <button type="button" aria-label="Close" className="absolute inset-0 animate-fade-in bg-ink/15" onClick={onClose} />

      <aside ref={panelRef} tabIndex={-1} className="relative flex h-full outline-none w-full max-w-[480px] animate-slide-in flex-col bg-surface shadow-panel">
        <div className="flex items-start gap-3.5 border-b border-line px-6 pt-6 pb-5">
          {lead ? <Avatar name={lead.name} size="lg" /> : <Skeleton className="size-11 rounded-full" />}
          <div className="min-w-0 flex-1">
            {lead ? (
              <>
                <h2 className="truncate text-lg font-semibold tracking-tight text-ink">{lead.name}</h2>
                <p className="truncate text-sm text-muted">{lead.company || "Independent"}</p>
              </>
            ) : (
              <Skeleton className="h-10 w-48" />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-line-soft hover:text-ink"
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>

        {lead && (
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {/* Stage + quick actions */}
            <div className="space-y-4 px-6 pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="stage">
                  Stage
                </label>
                <div className={clsx("relative rounded-lg", STAGE_STYLE[lead.stage].soft)}>
                  <span className={clsx("pointer-events-none absolute top-1/2 left-2.5 size-2 -translate-y-1/2 rounded-full", STAGE_STYLE[lead.stage].dot)} />
                  <select
                    id="stage"
                    value={lead.stage}
                    onChange={(e) => move.mutate({ id: lead.id, stage: e.target.value as Stage })}
                    className={clsx(
                      "h-8 cursor-pointer appearance-none rounded-lg bg-transparent pr-7 pl-6 text-[13px] font-semibold outline-none",
                      STAGE_STYLE[lead.stage].text,
                    )}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className={clsx("pointer-events-none absolute top-1/2 right-2 -translate-y-1/2", STAGE_STYLE[lead.stage].text)} />
                </div>
                {lead.needsFollowUp && <FollowUpBadge days={lead.daysIdle} />}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => markContacted.mutate(lead.id)}
                  disabled={markContacted.isPending}
                  className="flex-1"
                >
                  <CheckCheck size={16} />
                  {lead.stage === "new" ? "Mark contacted" : "Log follow-up"}
                </Button>
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-ink-2 shadow-card transition-colors hover:bg-canvas"
                >
                  <Mail size={16} />
                  Email {lead.name.split(" ")[0]}
                </a>
              </div>
            </div>

            {/* Details */}
            <dl className="mx-6 mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-canvas/60 p-4 text-sm">
              <Detail label="Email" value={lead.email} />
              <Detail label="Budget" value={BUDGET_LABELS[lead.budget]} />
              <Detail label="Created" value={`${formatDateTime(lead.createdAt)}`} />
              <Detail label="Last activity" value={timeAgo(lead.lastActivityAt)} />
            </dl>

            <section className="px-6 pt-5">
              <h3 className="text-xs font-semibold tracking-wider text-faint uppercase">What they need</h3>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-2">{lead.need}</p>
            </section>

            <NoteForm leadId={lead.id} />

            <section className="px-6 pt-6 pb-8">
              <h3 className="text-xs font-semibold tracking-wider text-faint uppercase">Activity</h3>
              <ol className="relative mt-3 space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-line">
                {lead.activities.map((a) => {
                  const meta = ACTIVITY_ICON[a.type];
                  const Icon = meta.icon;
                  const email = a.type === "emailed" ? lead.emails.find((e) => e.kind === "follow_up") : undefined;
                  return (
                    <li key={a.id} className="relative flex gap-3">
                      <span className={clsx("z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-surface", meta.tone)}>
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[13px] font-medium text-ink">{meta.label}</span>
                          <time className="shrink-0 text-xs text-faint" dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>
                            {timeAgo(a.createdAt)}
                          </time>
                        </div>
                        <p
                          className={clsx(
                            "mt-0.5 text-[13px] leading-relaxed text-muted",
                            a.type === "note" && "mt-1.5 rounded-lg bg-canvas px-3 py-2 text-ink-2",
                          )}
                        >
                          {a.body}
                        </p>
                        {email && (
                          <Link to={`/outbox?email=${email.id}`} className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline">
                            View email →
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-ink" title={value}>
        {value}
      </dd>
    </div>
  );
}

function NoteForm({ leadId }: { leadId: number }) {
  const [body, setBody] = useState("");
  const addNote = useAddNote();

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!body.trim()) return;
    addNote.mutate({ id: leadId, body }, { onSuccess: () => setBody("") });
  };

  return (
    <form onSubmit={submit} className="px-6 pt-6">
      <label htmlFor="note" className="text-xs font-semibold tracking-wider text-faint uppercase">
        Add a note
      </label>
      <div className="mt-2 rounded-xl border border-line bg-surface shadow-card focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <textarea
          id="note"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="Call notes, next steps, anything worth remembering…"
          className="block w-full resize-none rounded-xl bg-transparent px-3.5 pt-3 text-sm text-ink outline-none placeholder:text-faint"
        />
        <div className="flex items-center justify-between px-3 pb-2.5">
          <span className="text-[11px] text-faint">Ctrl + Enter to save</span>
          <Button type="submit" size="sm" variant="secondary" disabled={!body.trim() || addNote.isPending}>
            Save note
          </Button>
        </div>
      </div>
    </form>
  );
}
