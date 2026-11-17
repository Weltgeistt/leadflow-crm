import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import type { EmailKind, EmailRecord, EmailTransport } from "../../shared/domain.js";
import type { SmtpSettings } from "../config.js";
import type { EmailRepository } from "../repositories.js";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: EmailKind;
  leadId?: number | null;
}

export interface Mailer {
  readonly mode: EmailTransport;
  /** Sends (or previews) an email and records it in the outbox table. */
  send(email: OutgoingEmail, at?: Date): Promise<EmailRecord>;
}

export interface MailerOptions {
  from: string;
  outboxDir: string;
  smtp?: SmtpSettings;
}

/**
 * Two delivery modes behind one interface:
 *  - smtp:    real delivery through any SMTP provider (Postmark, SES, Gmail…)
 *  - preview: nothing leaves the machine; each message is rendered to a
 *             standards-compliant .eml (open it in any mail client) plus an
 *             .html copy in the outbox folder, and shown in the app.
 */
export function createMailer(options: MailerOptions, emails: EmailRepository): Mailer {
  const mode: EmailTransport = options.smtp ? "smtp" : "preview";

  const transport = options.smtp
    ? nodemailer.createTransport({
        host: options.smtp.host,
        port: options.smtp.port,
        secure: options.smtp.secure,
        auth: options.smtp.user ? { user: options.smtp.user, pass: options.smtp.pass } : undefined,
      })
    : nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });

  return {
    mode,
    async send(email, at = new Date()) {
      const info = await transport.sendMail({
        from: options.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        date: at,
      });

      let file: string | null = null;
      if (mode === "preview") {
        file = await writePreview(options.outboxDir, email, at, info.message as Buffer);
      }

      return emails.insert({
        leadId: email.leadId ?? null,
        kind: email.kind,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        transport: mode,
        file,
        createdAt: at.toISOString(),
      });
    },
  };
}

async function writePreview(dir: string, email: OutgoingEmail, at: Date, raw: Buffer): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  const stamp = at.toISOString().replace(/[:.]/g, "-");
  const recipient = email.to.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const base = `${stamp}_${email.kind}_${recipient}`;
  await fs.writeFile(path.join(dir, `${base}.eml`), raw);
  await fs.writeFile(path.join(dir, `${base}.html`), email.html, "utf8");
  return `${base}.eml`;
}
