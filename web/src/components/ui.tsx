import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Stage } from "@shared/domain";
import { avatarTone, initials } from "../lib/format";

/** Visual identity per pipeline stage, used by columns, badges and the chart. */
export const STAGE_STYLE: Record<Stage, { dot: string; soft: string; text: string; bar: string }> = {
  new: { dot: "bg-sky-500", soft: "bg-sky-50", text: "text-sky-700", bar: "#0ea5e9" },
  contacted: { dot: "bg-violet-500", soft: "bg-violet-50", text: "text-violet-700", bar: "#8b5cf6" },
  proposal: { dot: "bg-amber-500", soft: "bg-amber-50", text: "text-amber-700", bar: "#f59e0b" },
  won: { dot: "bg-emerald-500", soft: "bg-emerald-50", text: "text-emerald-700", bar: "#10b981" },
  lost: { dot: "bg-slate-400", soft: "bg-slate-100", text: "text-slate-600", bar: "#94a3b8" },
};

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
        variant === "secondary" && "border border-line bg-surface text-ink-2 shadow-card hover:bg-canvas",
        variant === "ghost" && "text-muted hover:bg-line-soft hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        avatarTone(name),
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-11 text-sm",
      )}
    >
      {initials(name)}
    </span>
  );
}

export function StageBadge({ stage, label }: { stage: Stage; label: string }) {
  const s = STAGE_STYLE[stage];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", s.soft, s.text)}>
      <span className={clsx("size-1.5 rounded-full", s.dot)} />
      {label}
    </span>
  );
}

export function FollowUpBadge({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-600/10 ring-inset">
      <span className="size-1.5 rounded-full bg-red-500" />
      Follow up · {days}d
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-xl border border-line bg-surface shadow-card", className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-line-soft", className)} />;
}
