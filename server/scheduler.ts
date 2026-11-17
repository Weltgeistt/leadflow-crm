import cron from "node-cron";
import type { LeadService } from "./services.js";

/**
 * Schedules the daily "needs attention" digest. Returns a stop function so the
 * process can shut down cleanly.
 */
export function scheduleDigest(
  service: LeadService,
  expression: string,
  log: Pick<Console, "info" | "error"> = console,
): () => void {
  if (!cron.validate(expression)) {
    throw new Error(`DIGEST_CRON is not a valid cron expression: "${expression}"`);
  }

  const task = cron.schedule(expression, async () => {
    try {
      const email = await service.sendDigest();
      log.info(email ? `[digest] sent "${email.subject}" to ${email.to}` : "[digest] nothing needs attention today");
    } catch (error) {
      log.error("[digest] failed", error);
    }
  });

  return () => void task.stop();
}
