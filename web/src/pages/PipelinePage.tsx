import { Plus, Send } from "lucide-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/AppShell";
import { Board } from "../components/Board";
import { LeadPanel } from "../components/LeadPanel";
import { NeedsAttention } from "../components/NeedsAttention";
import { StatsStrip } from "../components/StatsStrip";
import { Button } from "../components/ui";
import { useConfig, useLeads, useRunDigest } from "../lib/queries";

export function PipelinePage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("lead") ? Number(params.get("lead")) : null;
  const { data: leads } = useLeads();
  const { data: config } = useConfig();
  const digest = useRunDigest();
  const [toast, setToast] = useState<string | null>(null);

  // The open lead lives in the URL (?lead=12), so panels are linkable and survive a refresh.
  const open = useCallback((id: number) => setParams({ lead: String(id) }), [setParams]);
  const close = useCallback(() => setParams({}), [setParams]);

  const sendDigest = () =>
    digest.mutate(undefined, {
      onSuccess: (res) => {
        setToast(res.sent ? `Digest sent to ${res.email?.to}` : "Nothing needs attention — no digest sent");
        window.setTimeout(() => setToast(null), 3500);
      },
    });

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle={
          leads && config
            ? `${leads.length} leads · reminders after ${config.followUpAfterDays} days without activity`
            : "Loading…"
        }
        actions={
          <>
            <Button onClick={sendDigest} disabled={digest.isPending}>
              <Send size={15} />
              Send digest now
            </Button>
            <a
              href="/form"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              <Plus size={16} />
              New lead
            </a>
          </>
        }
      />

      <div className="space-y-5 px-5 pb-10 md:px-8">
        <StatsStrip />
        <NeedsAttention onOpen={open} />
        <Board onOpen={open} selectedId={selectedId} />
      </div>

      {selectedId !== null && <LeadPanel id={selectedId} onClose={close} />}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lift">
          {toast}
        </div>
      )}
    </>
  );
}
