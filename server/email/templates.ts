/**
 * Transactional email templates. Table-based layout with inline styles,
 * because that is what email clients (Outlook included) render reliably.
 */
import { BUDGET_LABELS, STAGE_LABELS, type Lead, type LeadSummary } from "../../shared/domain.js";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

function layout(opts: { preheader: string; body: string; footer: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LeadFlow</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="padding:0 4px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:28px;height:28px;border-radius:8px;background:#4f46e5;color:#ffffff;font-weight:700;font-size:15px;text-align:center;line-height:28px;">L</td>
          <td style="padding-left:10px;font-weight:600;font-size:15px;color:#111827;">LeadFlow Studio</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:32px;">
        ${opts.body}
      </td></tr>
      <tr><td style="padding:20px 4px;font-size:12px;line-height:18px;color:#9ca3af;">${opts.footer}</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Auto-reply sent to every new lead the moment the form is submitted. */
export function followUpEmail(lead: Lead, ownerName: string): RenderedEmail {
  const name = escapeHtml(firstName(lead.name));
  const need = escapeHtml(lead.need).replace(/\n/g, "<br>");
  const company = lead.company ? escapeHtml(lead.company) : "—";

  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:#111827;font-weight:700;">Thanks, ${name} — we've got your request</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#374151;">
      Thanks for reaching out. A real person reads every request, and we'll get back to you
      <strong style="color:#111827;">within 24 hours</strong> with next steps and a few questions.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f9fafb;border:1px solid #eef0f3;border-radius:10px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6b7280;font-weight:600;margin-bottom:10px;">Your request</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:22px;">
          <tr><td style="color:#6b7280;width:110px;padding:2px 0;">Company</td><td style="color:#111827;">${company}</td></tr>
          <tr><td style="color:#6b7280;padding:2px 0;">Budget</td><td style="color:#111827;">${BUDGET_LABELS[lead.budget]}</td></tr>
          <tr><td style="color:#6b7280;padding:2px 0;vertical-align:top;">Project</td><td style="color:#111827;">${need}</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 6px;font-size:15px;line-height:24px;color:#374151;">
      In the meantime, feel free to reply to this email with any files, links or examples that help explain the project.
    </p>
    <p style="margin:24px 0 0;font-size:15px;line-height:24px;color:#374151;">Talk soon,<br><strong style="color:#111827;">${escapeHtml(ownerName)}</strong></p>`;

  const text = [
    `Thanks, ${firstName(lead.name)} — we've got your request`,
    "",
    "Thanks for reaching out. We'll get back to you within 24 hours with next steps.",
    "",
    `Company: ${lead.company || "—"}`,
    `Budget:  ${BUDGET_LABELS[lead.budget]}`,
    `Project: ${lead.need}`,
    "",
    `Talk soon,`,
    ownerName,
  ].join("\n");

  return {
    subject: `Thanks ${firstName(lead.name)} — we'll get back to you within 24h`,
    html: layout({
      preheader: "We'll get back to you within 24 hours.",
      body,
      footer: "You're receiving this because you submitted the project form on our website.",
    }),
    text,
  };
}

/** Daily digest for the owner: every lead that has gone quiet. */
export function digestEmail(leads: readonly LeadSummary[], ownerName: string, appUrl: string): RenderedEmail {
  const count = leads.length;
  const rows = leads
    .map(
      (l) => `
      <tr>
        <td style="padding:12px 0;border-top:1px solid #f0f1f3;">
          <div style="font-size:14px;font-weight:600;color:#111827;">${escapeHtml(l.name)}</div>
          <div style="font-size:13px;color:#6b7280;">${escapeHtml(l.company || l.email)} · ${BUDGET_LABELS[l.budget]}</div>
        </td>
        <td style="padding:12px 0;border-top:1px solid #f0f1f3;text-align:right;white-space:nowrap;">
          <span style="display:inline-block;font-size:12px;font-weight:600;color:#b91c1c;background:#fef2f2;border-radius:999px;padding:3px 10px;">${l.daysIdle}d idle</span>
          <div style="font-size:12px;color:#9ca3af;margin-top:4px;">${STAGE_LABELS[l.stage]}</div>
        </td>
      </tr>`,
    )
    .join("");

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;line-height:30px;color:#111827;font-weight:700;">Good morning, ${escapeHtml(firstName(ownerName))}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#374151;">
      ${count === 1 ? "1 lead is" : `${count} leads are`} waiting on a follow-up. A quick reply today keeps them warm.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr>
      <td style="background:#4f46e5;border-radius:8px;">
        <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:11px 18px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Open pipeline</a>
      </td>
    </tr></table>`;

  const text = [
    `Good morning, ${firstName(ownerName)}`,
    "",
    `${count} lead(s) waiting on a follow-up:`,
    ...leads.map((l) => `- ${l.name} (${l.company || l.email}) — ${STAGE_LABELS[l.stage]}, ${l.daysIdle}d idle`),
    "",
    `Open pipeline: ${appUrl}`,
  ].join("\n");

  return {
    subject: `${count} ${count === 1 ? "lead needs" : "leads need"} a follow-up today`,
    html: layout({
      preheader: `${count} leads are waiting on a reply.`,
      body,
      footer: "Daily digest from LeadFlow. Change the schedule with DIGEST_CRON.",
    }),
    text,
  };
}
