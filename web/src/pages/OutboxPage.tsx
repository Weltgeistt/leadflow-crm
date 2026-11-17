import clsx from "clsx";
import { BellRing, FileText, Info, MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { EmailKind, EmailRecord } from "@shared/domain";
import { PageHeader } from "../components/AppShell";
import { Card, Skeleton } from "../components/ui";
import { formatDateTime, timeAgo } from "../lib/format";
import { useConfig, useEmail, useOutbox } from "../lib/queries";

const FILTERS: { id: "all" | EmailKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "follow_up", label: "Auto-replies" },
  { id: "digest", label: "Daily digests" },
];

export function OutboxPage() {
  const { data: emails } = useOutbox();
  const { data: config } = useConfig();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<"all" | EmailKind>("all");

  const visible = (emails ?? []).filter((e) => filter === "all" || e.kind === filter);
  const selectedId = params.get("email") ? Number(params.get("email")) : (visible[0]?.id ?? null);

  // Keep the URL in sync with the default selection so the view is shareable.
  useEffect(() => {
    if (!params.get("email") && visible[0]) setParams({ email: String(visible[0].id) }, { replace: true });
  }, [params, setParams, visible]);

  return (
    <>
      <PageHeader title="Outbox" subtitle="Every automated email LeadFlow has sent, with a full preview." />

      <div className="space-y-4 px-5 pb-10 md:px-8">
        {config?.mailMode === "preview" && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Info size={18} className="mt-px shrink-0 text-amber-600" />
            <p>
              <span className="font-semibold">Preview mode.</span> SMTP isn't configured, so emails are rendered to{" "}
              <code className="rounded bg-amber-100 px-1 py-px text-[13px]">./outbox/</code> as <code className="text-[13px]">.eml</code> +{" "}
              <code className="text-[13px]">.html</code> files instead of being sent. Add your SMTP settings to{" "}
              <code className="rounded bg-amber-100 px-1 py-px text-[13px]">.env</code> to deliver them for real.
            </p>
          </div>
        )}

        <Card className="grid min-h-[640px] grid-cols-1 overflow-hidden lg:grid-cols-[380px_1fr]">
          <div className="flex min-h-0 flex-col border-b border-line lg:border-r lg:border-b-0">
            <div className="flex gap-1 border-b border-line p-2" role="tablist" aria-label="Filter emails">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => {
                    setFilter(f.id);
                    setParams({});
                  }}
                  className={clsx(
                    "h-8 rounded-md px-3 text-[13px] font-medium transition-colors",
                    filter === f.id ? "bg-canvas text-ink ring-1 ring-line" : "text-muted hover:text-ink",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <ul className="scrollbar-thin max-h-[720px] flex-1 overflow-y-auto">
              {!emails &&
                Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="p-4">
                    <Skeleton className="h-10" />
                  </li>
                ))}
              {visible.map((email) => (
                <EmailRow
                  key={email.id}
                  email={email}
                  selected={email.id === selectedId}
                  onSelect={() => setParams({ email: String(email.id) })}
                />
              ))}
            </ul>
          </div>

          <EmailPreview id={selectedId} />
        </Card>
      </div>
    </>
  );
}

function EmailRow({ email, selected, onSelect }: { email: EmailRecord; selected: boolean; onSelect: () => void }) {
  const Icon = email.kind === "digest" ? BellRing : MailCheck;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={clsx(
          "flex w-full gap-3 border-b border-line-soft px-4 py-3 text-left transition-colors",
          selected ? "bg-brand-50/70" : "hover:bg-canvas",
        )}
      >
        <span
          className={clsx(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
            email.kind === "digest" ? "bg-red-50 text-red-600" : "bg-sky-50 text-sky-600",
          )}
        >
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-medium text-ink">{email.to}</span>
            <span className="shrink-0 text-[11px] text-faint">{timeAgo(email.createdAt)}</span>
          </span>
          <span className={clsx("block truncate text-[13px]", selected ? "text-ink-2" : "text-muted")}>{email.subject}</span>
        </span>
      </button>
    </li>
  );
}

function EmailPreview({ id }: { id: number | null }) {
  const { data: email } = useEmail(id);

  if (id === null) {
    return <div className="flex items-center justify-center p-10 text-sm text-muted">No emails yet.</div>;
  }
  if (!email) return <Skeleton className="m-6 h-96" />;

  return (
    <div className="flex min-w-0 flex-col">
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-base font-semibold tracking-tight text-ink">{email.subject}</h2>
        <dl className="mt-2 grid grid-cols-[52px_1fr] gap-y-0.5 text-[13px]">
          <dt className="text-muted">To</dt>
          <dd className="text-ink-2">{email.to}</dd>
          <dt className="text-muted">Sent</dt>
          <dd className="text-ink-2">{formatDateTime(email.createdAt)}</dd>
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={clsx(
              "rounded-full px-2 py-0.5 font-medium",
              email.transport === "smtp" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
            )}
          >
            {email.transport === "smtp" ? "Delivered via SMTP" : "Preview — not sent"}
          </span>
          <span className="rounded-full bg-canvas px-2 py-0.5 font-medium text-muted ring-1 ring-line">
            {email.kind === "digest" ? "Daily digest" : "Auto-reply"}
          </span>
          {email.file && (
            <span className="inline-flex min-w-0 items-center gap-1 text-faint">
              <FileText size={12} />
              <span className="truncate">outbox/{email.file}</span>
            </span>
          )}
        </div>
      </div>
      {/* The email renders in a sandboxed iframe: no scripts, isolated styles. */}
      <iframe title="Email preview" srcDoc={email.html} sandbox="" className="min-h-[560px] w-full flex-1 bg-[#f4f5f7]" />
    </div>
  );
}
