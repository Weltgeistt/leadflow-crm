import type { Config } from "./config.js";
import { openDatabase, type DB } from "./db.js";
import { createMailer, type Mailer } from "./email/mailer.js";
import { EmailRepository, LeadRepository } from "./repositories.js";
import { LeadService } from "./services.js";

export interface Container {
  db: DB;
  leads: LeadRepository;
  emails: EmailRepository;
  mailer: Mailer;
  service: LeadService;
  now: () => Date;
}

/** Wires the object graph once, so the server, the seed script and tests share it. */
export function createContainer(
  config: Config,
  options: { now?: () => Date; log?: Pick<Console, "info" | "error"> } = {},
): Container {
  const now = options.now ?? (() => new Date());
  const db = openDatabase(config.databasePath);
  const leads = new LeadRepository(db);
  const emails = new EmailRepository(db);
  const mailer = createMailer(config.mail, emails);
  const service = new LeadService({
    leads,
    emails,
    mailer,
    followUpAfterDays: config.followUpAfterDays,
    owner: config.owner,
    appUrl: config.appUrl,
    now,
    log: options.log,
  });
  return { db, leads, emails, mailer, service, now };
}
