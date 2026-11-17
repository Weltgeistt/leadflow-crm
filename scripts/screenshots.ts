/// <reference lib="dom" />
/**
 * Captures the README screenshots at 1440×900 with headless Chromium.
 *
 *   npm run seed && npm run dev      # in one terminal
 *   npm run screenshots              # in another
 *
 * Note: the form step submits one real lead, so re-seed afterwards for a clean dataset.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import type { EmailRecord, LeadSummary } from "../shared/domain.js";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const OUT = path.resolve("docs/screenshots");

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // let entrance animations finish
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(OUT, name) });
  console.info(`  ✓ ${name}`);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const leads = (await (await fetch(`${BASE}/api/leads`)).json()) as LeadSummary[];
  const featured = leads.find((l) => l.company === "Contoso Retail") ?? leads[0]!;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  // 1. Pipeline overview: dashboard strip, needs-attention list and the board.
  await page.goto(BASE);
  await page.getByRole("heading", { name: "Needs attention" }).waitFor();
  await settle(page);
  await shot(page, "01-pipeline.png");

  // 2. Drag and drop in progress (cancelled with Escape, so no data changes).
  await page.locator("main").getByRole("region", { name: "New column" }).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 330);
  await page.waitForTimeout(300);
  const card = page.getByRole("button", { name: /^Daniel Okafor/ });
  const target = page.getByRole("region", { name: "Contacted column" });
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(
      from.x + from.width / 2 + ((to.x + to.width / 2 - from.x - from.width / 2) * i) / 12,
      from.y + from.height / 2 + 60 * (i / 12),
    );
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(250);
  await shot(page, "02-drag-and-drop.png");
  await page.keyboard.press("Escape");
  await page.mouse.up();

  // 3. Lead detail panel with notes and the activity timeline.
  await page.goto(`${BASE}/?lead=${featured.id}`);
  await page.getByRole("dialog", { name: "Lead details" }).getByRole("heading", { name: "Activity" }).waitFor();
  await settle(page);
  await shot(page, "03-lead-detail.png");

  // 4. Public lead capture form, filled in.
  await page.goto(`${BASE}/form`);
  await settle(page);
  await page.getByLabel("Your name *").fill("Jordan Ellis");
  await page.getByLabel("Work email *").fill("jordan@meridianwholesale.example");
  await page.getByLabel("Company").fill("Meridian Wholesale");
  await page.getByLabel("Budget range *").selectOption("5k_15k");
  await page
    .getByLabel("What do you need? *")
    .fill(
      "Our sales team re-types purchase orders from PDFs into our ERP every day. We'd like an automation that reads the PDFs, creates the orders and flags anything unusual for review.",
    );
  await page.locator("body").click({ position: { x: 1400, y: 880 } }); // blur, so no field shows a caret
  await shot(page, "04-lead-form.png");

  // 5. Success state after submitting.
  await page.getByRole("button", { name: "Send request" }).click();
  await page.getByRole("heading", { name: /Thanks, Jordan/ }).waitFor();
  await settle(page);
  await shot(page, "05-form-success.png");

  // 6. Outbox with the auto-reply that was just generated.
  const outbox = (await (await fetch(`${BASE}/api/outbox`)).json()) as EmailRecord[];
  const reply = outbox.find((e) => e.kind === "follow_up")!;
  await page.goto(`${BASE}/outbox?email=${reply.id}`);
  await page.frameLocator("iframe[title='Email preview']").getByText("Your request", { exact: true }).waitFor();
  await settle(page);
  await shot(page, "06-outbox.png");

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
