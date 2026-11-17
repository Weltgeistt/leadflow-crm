/**
 * `npm run seed` — wipes the database and the local outbox, then loads the
 * demo dataset. Safe to run repeatedly.
 */
import fs from "node:fs";
import { loadConfig } from "./config.js";
import { createContainer } from "./container.js";
import { seedDemoData } from "./seed-data.js";

const config = loadConfig();

for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(config.databasePath + suffix, { force: true });
fs.rmSync(config.mail.outboxDir, { recursive: true, force: true });

const container = createContainer(config);
const count = await seedDemoData(container, {
  now: new Date(),
  outboxDir: config.mail.outboxDir,
  from: config.mail.from,
  owner: config.owner,
  appUrl: config.appUrl,
  followUpAfterDays: config.followUpAfterDays,
});
container.db.close();

console.info(`Seeded ${count} demo leads into ${config.databasePath}`);
console.info(`Preview emails written to ${config.mail.outboxDir}`);
