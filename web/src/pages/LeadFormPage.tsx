import clsx from "clsx";
import { ArrowRight, Check, ChevronDown, Clock, FileCheck2, Loader2, MessagesSquare } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { BUDGETS, BUDGET_LABELS, newLeadSchema, type LeadDetail, type NewLeadInput } from "@shared/domain";
import { Logo } from "../components/AppShell";
import { ApiError, api } from "../lib/api";

type Field = keyof NewLeadInput;
type Errors = Partial<Record<Field, string>>;

const EMPTY: NewLeadInput = { name: "", email: "", company: "", need: "", budget: "" as NewLeadInput["budget"] };

/** Validates with the same zod schema the API uses, so messages match exactly. */
function validate(values: NewLeadInput): Errors {
  const result = newLeadSchema.safeParse(values);
  if (result.success) return {};
  const errors: Errors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as Field;
    errors[field] ??= issue.message;
  }
  return errors;
}

export function LeadFormPage() {
  const [values, setValues] = useState<NewLeadInput>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [created, setCreated] = useState<LeadDetail | null>(null);

  const errors = { ...validate(values), ...serverErrors };
  const visibleError = (field: Field) => (touched[field] ? errors[field] : undefined);

  const set = (field: Field) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setServerErrors((s) => ({ ...s, [field]: undefined }));
  };
  const blur = (field: Field) => () => setTouched((t) => ({ ...t, [field]: true }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, company: true, need: true, budget: true });
    if (Object.keys(validate(values)).length > 0) return;

    setStatus("sending");
    try {
      setCreated(await api.createLead(values));
      setStatus("idle");
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) setServerErrors(error.details as Errors);
      setStatus("error");
    }
  };

  const reset = () => {
    setValues(EMPTY);
    setTouched({});
    setCreated(null);
  };

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Pitch */}
      <aside className="relative overflow-hidden bg-[#13123a] px-6 py-10 text-white sm:px-12 lg:flex lg:flex-col lg:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, #4f46e5 0%, transparent 65%)" }}
        />
        <div className="relative">
          <div className="inline-flex rounded-xl bg-white px-3 py-2">
            <Logo />
          </div>
          <h1 className="mt-12 max-w-md text-[34px] leading-[1.15] font-semibold tracking-tight lg:mt-20">
            Let's automate the busywork in your business.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-indigo-100/80">
            Tell us what eats your team's time. We design and build automations and AI assistants that quietly take it off
            your plate.
          </p>

          <ul className="mt-10 space-y-5">
            <Benefit icon={<Clock size={18} />} title="Reply within 24 hours" text="A real person reads every request — no bots, no sales scripts." />
            <Benefit icon={<MessagesSquare size={18} />} title="Free 20-minute discovery call" text="We map the workflow with you and spot the quick wins." />
            <Benefit icon={<FileCheck2 size={18} />} title="Fixed-price proposal" text="Clear scope, timeline and price before any work starts." />
          </ul>
        </div>

        <figure className="relative mt-12 max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 lg:mt-auto">
          <blockquote className="text-sm leading-relaxed text-indigo-50/90">
            “Our invoice processing went from two days a week to twenty minutes. The follow-up automation alone paid for the
            project in a month.”
          </blockquote>
          <figcaption className="mt-3 text-xs text-indigo-200/70">Operations lead · logistics company (fictional demo quote)</figcaption>
        </figure>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-10 lg:py-14">
        <div className="w-full max-w-[560px]">
          {created ? (
            <Success lead={created} onReset={reset} />
          ) : (
            <form noValidate onSubmit={submit} className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-9">
              <h2 className="text-xl font-semibold tracking-tight text-ink">Start a project</h2>
              <p className="mt-1 text-sm text-muted">Takes about a minute. Fields marked * are required.</p>

              <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField id="name" label="Your name *" error={visibleError("name")}>
                  <input id="name" autoComplete="name" value={values.name} onChange={set("name")} onBlur={blur("name")} placeholder="Jane Cooper" className={inputClass(visibleError("name"))} />
                </FormField>
                <FormField id="email" label="Work email *" error={visibleError("email")}>
                  <input id="email" type="email" autoComplete="email" value={values.email} onChange={set("email")} onBlur={blur("email")} placeholder="jane@company.com" className={inputClass(visibleError("email"))} />
                </FormField>
                <FormField id="company" label="Company" error={visibleError("company")}>
                  <input id="company" autoComplete="organization" value={values.company} onChange={set("company")} onBlur={blur("company")} placeholder="Acme Inc." className={inputClass(visibleError("company"))} />
                </FormField>
                <FormField id="budget" label="Budget range *" error={visibleError("budget")}>
                  <div className="relative">
                    <select id="budget" value={values.budget} onChange={set("budget")} onBlur={blur("budget")} className={clsx(inputClass(visibleError("budget")), "appearance-none pr-9", !values.budget && "text-faint")}>
                      <option value="" disabled>
                        Select a range
                      </option>
                      {BUDGETS.map((b) => (
                        <option key={b} value={b} className="text-ink">
                          {BUDGET_LABELS[b]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-faint" />
                  </div>
                </FormField>
                <FormField
                  id="need"
                  label="What do you need? *"
                  error={visibleError("need")}
                  hint={`${values.need.length}/2000`}
                  className="sm:col-span-2"
                >
                  <textarea
                    id="need"
                    rows={5}
                    value={values.need}
                    onChange={set("need")}
                    onBlur={blur("need")}
                    placeholder="e.g. We copy orders from email into a spreadsheet every morning and want that to happen automatically…"
                    className={clsx(inputClass(visibleError("need")), "h-auto resize-none py-3 leading-relaxed")}
                  />
                </FormField>
              </div>

              {status === "error" && Object.keys(serverErrors).length === 0 && (
                <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                  Something went wrong sending your request. Please try again in a moment.
                </p>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-70"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 size={17} className="animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    Send request <ArrowRight size={17} />
                  </>
                )}
              </button>
              <p className="mt-3 text-center text-xs text-faint">We'll only use your details to reply to this request.</p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

const inputClass = (error?: string) =>
  clsx(
    "block h-11 w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink shadow-xs transition outline-none placeholder:text-faint",
    error
      ? "border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100"
      : "border-line focus:border-brand-500 focus:ring-4 focus:ring-brand-100",
  );

function FormField({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink-2">
          {label}
        </label>
        {hint && <span className="text-xs text-faint tabular-nums">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[13px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function Benefit({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <li className="flex gap-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-indigo-200 ring-1 ring-white/15">
        {icon}
      </span>
      <span>
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="block text-sm text-indigo-100/70">{text}</span>
      </span>
    </li>
  );
}

function Success({ lead, onReset }: { lead: LeadDetail; onReset: () => void }) {
  const firstName = lead.name.split(" ")[0];
  const email = lead.emails[0];
  return (
    <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card sm:p-12">
      <div className="mx-auto flex size-16 animate-pop items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
        <span className="flex size-11 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check size={24} strokeWidth={3} />
        </span>
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-ink">Thanks, {firstName}!</h2>
      <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
        Your request is in. We've sent a confirmation to <span className="font-medium text-ink">{lead.email}</span> and
        will get back to you within 24 hours.
      </p>

      <div className="mx-auto mt-8 max-w-sm rounded-xl bg-canvas p-4 text-left text-sm">
        <div className="text-xs font-semibold tracking-wider text-faint uppercase">What happens next</div>
        <ol className="mt-2 space-y-1.5 text-ink-2">
          <li>1. We review your request today</li>
          <li>2. You get a reply with a few questions</li>
          <li>3. We book a free 20-minute call</li>
        </ol>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <button type="button" onClick={onReset} className="text-sm font-medium text-brand-600 hover:underline">
          Submit another request
        </button>
        {email && (
          <a href={`/outbox?email=${email.id}`} className="text-xs text-faint hover:text-muted">
            Demo: see the auto-reply in the Outbox →
          </a>
        )}
      </div>
    </div>
  );
}
