import path from "node:path";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createContainer } from "./container.js";
import { scheduleDigest } from "./scheduler.js";
import { seedDemoData } from "./seed-data.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const container = createContainer(config, { log: console });

  if (config.seedDemoData && container.leads.count() === 0) {
    const n = await seedDemoData(container, {
      now: new Date(),
      outboxDir: config.mail.outboxDir,
      from: config.mail.from,
      owner: config.owner,
      appUrl: config.appUrl,
      followUpAfterDays: config.followUpAfterDays,
    });
    console.info(`[seed] empty database — added ${n} demo leads (set SEED_DEMO_DATA=false to skip)`);
  }

  const app = createApp({
    service: container.service,
    emails: container.emails,
    mailer: container.mailer,
    now: container.now,
    config: {
      followUpAfterDays: config.followUpAfterDays,
      ownerEmail: config.owner.email,
      digestCron: config.digestCron,
    },
    // `npm start` serves the built UI from dist/web; in dev, Vite serves it with hot reload.
    staticDir: config.devMode ? undefined : path.resolve("dist/web"),
  });

  const stopDigest = scheduleDigest(container.service, config.digestCron);

  const server = app.listen(config.port, () => {
    const mode = container.mailer.mode === "smtp" ? "SMTP" : `preview → ${config.mail.outboxDir}`;
    console.info(`[api] LeadFlow listening on http://localhost:${config.port}`);
    console.info(`[api] email: ${mode} · digest: "${config.digestCron}" · follow-up after ${config.followUpAfterDays}d`);
  });

  const shutdown = () => {
    stopDigest();
    server.close(() => {
      container.db.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
