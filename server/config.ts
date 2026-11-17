import "dotenv/config";
import path from "node:path";
import { z } from "zod";

/**
 * Environment configuration, validated once at startup.
 * Every value has a sensible default so the app runs with zero setup.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_PATH: z.string().default("./data/leadflow.db"),
  SEED_DEMO_DATA: z
    .string()
    .default("true")
    .transform((v) => v.toLowerCase() === "true"),
  FOLLOW_UP_AFTER_DAYS: z.coerce.number().int().min(1).max(90).default(3),
  DIGEST_CRON: z.string().default("0 8 * * *"),
  OWNER_EMAIL: z.string().default("owner@leadflow.example"),
  OWNER_NAME: z.string().default("Alex"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("LeadFlow Studio <hello@leadflow.example>"),
  OUTBOX_DIR: z.string().default("./outbox"),
  APP_URL: z.string().optional(),
});

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

export interface Config {
  port: number;
  /** Public URL of the web app, used for links inside emails. */
  appUrl: string;
  /** True when started by `npm run dev`: Vite serves the UI, the API only serves /api. */
  devMode: boolean;
  databasePath: string;
  seedDemoData: boolean;
  followUpAfterDays: number;
  digestCron: string;
  owner: { email: string; name: string };
  mail: {
    from: string;
    outboxDir: string;
    /** Undefined when SMTP is not configured: emails go to the local outbox. */
    smtp?: SmtpSettings;
  };
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  { devMode = process.argv.includes("--dev") }: { devMode?: boolean } = {},
): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = parsed.data;
  const smtpHost = e.SMTP_HOST?.trim();

  return {
    port: e.PORT,
    // In dev the UI is served by Vite on :5173; otherwise by the API server itself.
    appUrl: e.APP_URL ?? `http://localhost:${devMode ? 5173 : e.PORT}/`,
    devMode,
    databasePath: e.DATABASE_PATH === ":memory:" ? e.DATABASE_PATH : path.resolve(e.DATABASE_PATH),
    seedDemoData: e.SEED_DEMO_DATA,
    followUpAfterDays: e.FOLLOW_UP_AFTER_DAYS,
    digestCron: e.DIGEST_CRON,
    owner: { email: e.OWNER_EMAIL, name: e.OWNER_NAME },
    mail: {
      from: e.MAIL_FROM,
      outboxDir: path.resolve(e.OUTBOX_DIR),
      smtp: smtpHost
        ? {
            host: smtpHost,
            port: e.SMTP_PORT,
            secure: e.SMTP_SECURE,
            user: e.SMTP_USER || undefined,
            pass: e.SMTP_PASS || undefined,
          }
        : undefined,
    },
  };
}
