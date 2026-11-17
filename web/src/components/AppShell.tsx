import clsx from "clsx";
import { ExternalLink, Inbox, KanbanSquare, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAttention, useConfig, useOutbox } from "../lib/queries";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#4f46e5" />
        <path d="M10 9v14h12" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="21" cy="11" r="2.6" fill="#a5b4fc" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-ink">LeadFlow</span>
    </div>
  );
}

function NavItem({ to, icon, label, count, alert }: { to: string; icon: ReactNode; label: string; count?: number; alert?: boolean }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        clsx(
          "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
          isActive ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-muted hover:bg-line-soft hover:text-ink",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={isActive ? "text-brand-600" : "text-faint"}>{icon}</span>
          <span className="flex-1">{label}</span>
          {count !== undefined && (
            <span
              className={clsx(
                "rounded-md px-1.5 text-xs font-semibold tabular-nums",
                alert ? "bg-red-50 text-red-700" : "text-faint",
              )}
            >
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function AppShell() {
  const { data: attention } = useAttention();
  const { data: outbox } = useOutbox();
  const { data: config } = useConfig();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-canvas px-3 py-5 md:flex">
        <Logo className="px-2.5" />

        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          <NavItem to="/" icon={<KanbanSquare size={17} />} label="Pipeline" count={attention?.length} alert={!!attention?.length} />
          <NavItem to="/outbox" icon={<Inbox size={17} />} label="Outbox" count={outbox?.length} />
        </nav>

        <div className="mt-8 px-2.5 text-[11px] font-semibold tracking-wider text-faint uppercase">Public</div>
        <a
          href="/form"
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted transition-colors hover:bg-line-soft hover:text-ink"
        >
          <ExternalLink size={17} className="text-faint" />
          Lead capture form
        </a>

        <div className="mt-auto space-y-3">
          {config && (
            <div className="rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-muted">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink-2">
                <Settings2 size={13} />
                Automations
              </div>
              Auto-reply on new leads · reminders after {config.followUpAfterDays} days · daily digest
              <div className="mt-2 flex items-center gap-1.5">
                <span className={clsx("size-1.5 rounded-full", config.mailMode === "smtp" ? "bg-emerald-500" : "bg-amber-500")} />
                {config.mailMode === "smtp" ? "Sending via SMTP" : "Preview mode (local outbox)"}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex size-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">AM</span>
            <div className="min-w-0 text-sm leading-tight">
              <div className="font-medium text-ink">Alex Morgan</div>
              <div className="truncate text-xs text-muted">Owner · Studio plan</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-5 pt-6 pb-5 md:px-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
