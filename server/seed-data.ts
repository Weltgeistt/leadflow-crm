/**
 * Demo dataset: 25 fictional leads spread across every stage and the last
 * ~7 weeks. All people and companies are made up; emails use the reserved
 * `.example` domain so nothing can ever be delivered to a real inbox.
 */
import type { Budget, NewLead, Stage } from "../shared/domain.js";
import type { Container } from "./container.js";
import { createMailer } from "./email/mailer.js";
import { digestEmail, followUpEmail } from "./email/templates.js";
import { selectNeedsAttention } from "./reminders.js";

interface SeedLead {
  name: string;
  company: string;
  need: string;
  budget: Budget;
  stage: Stage;
  /** How long ago the lead came in. Fractions are fine (0.1 ≈ 2.4 hours). */
  createdDaysAgo: number;
  /** How long ago the most recent touchpoint happened (defaults to creation). */
  lastTouchDaysAgo?: number;
  notes?: string[];
}

const LEADS: SeedLead[] = [
  // ─── New ──────────────────────────────────────────────────────────────
  {
    name: "Maya Chen",
    company: "Northwind Logistics",
    need: "We track 300+ shipments a day in spreadsheets. Looking for an automation that pulls carrier tracking updates into one dashboard and emails the customer when a delivery is running late.",
    budget: "15k_50k",
    stage: "new",
    createdDaysAgo: 0.08,
  },
  {
    name: "Hannah Brooks",
    company: "Mosaic Events",
    need: "Event inquiries arrive through three different forms. We'd like them qualified automatically and answered with the right package PDF within minutes.",
    budget: "1k_5k",
    stage: "new",
    createdDaysAgo: 0.2,
  },
  {
    name: "Daniel Okafor",
    company: "Brightline Solar",
    need: "A website chatbot that answers installation FAQs and books site surveys straight into our Google Calendar.",
    budget: "5k_15k",
    stage: "new",
    createdDaysAgo: 1.1,
  },
  {
    name: "Sofia Marquez",
    company: "Cedar & Co. Bakery",
    need: "Wholesale orders come in by email and WhatsApp. We want them collected into one order sheet automatically, plus a daily prep list for the kitchen at 5am.",
    budget: "1k_5k",
    stage: "new",
    createdDaysAgo: 2.3,
  },
  {
    name: "Liam Novak",
    company: "Kestrel Freight",
    need: "Automate invoice processing: read PDF invoices from a shared inbox, extract totals and PO numbers, and push them into QuickBooks for approval.",
    budget: "5k_15k",
    stage: "new",
    createdDaysAgo: 4.2,
  },
  {
    name: "Priya Raman",
    company: "Lumen Dental Group",
    need: "Appointment reminder SMS and email sequences for our 4 clinics, plus a polite no-show follow-up that offers the next free slot.",
    budget: "5k_15k",
    stage: "new",
    createdDaysAgo: 5.4,
  },
  {
    name: "Jonas Weber",
    company: "Quarry Lane Coffee",
    need: "A simple loyalty program connected to our Square POS — every 10th coffee free, with a monthly email to regulars.",
    budget: "under_1k",
    stage: "new",
    createdDaysAgo: 6.1,
  },

  // ─── Contacted ────────────────────────────────────────────────────────
  {
    name: "Aisha Karim",
    company: "Nimbus HR",
    need: "Onboarding automation: when a hire is marked in BambooHR, create their accounts, send the welcome pack and schedule day-one meetings.",
    budget: "15k_50k",
    stage: "contacted",
    createdDaysAgo: 7.2,
    lastTouchDaysAgo: 0.3,
    notes: ["Intro call went well. They use Google Workspace + Slack; 12–15 hires a month."],
  },
  {
    name: "Chloe Dubois",
    company: "Halcyon Spa",
    need: "Rebook clients automatically four weeks after their last visit, with a personalised offer based on the treatment they had.",
    budget: "1k_5k",
    stage: "contacted",
    createdDaysAgo: 6.3,
    lastTouchDaysAgo: 1.2,
  },
  {
    name: "Ethan Park",
    company: "Polaris EdTech",
    need: "An AI assistant that drafts feedback on student essays, which teachers then review and edit before it is shared.",
    budget: "15k_50k",
    stage: "contacted",
    createdDaysAgo: 9.4,
    lastTouchDaysAgo: 2.1,
    notes: ["Needs to run on their own Azure tenant (student data). Asked for a data-handling one-pager."],
  },
  {
    name: "Ryan Mitchell",
    company: "Summit Outdoor Gear",
    need: "Scrape competitor prices weekly and flag products where we're more than 10% above the market.",
    budget: "5k_15k",
    stage: "contacted",
    createdDaysAgo: 10.2,
    lastTouchDaysAgo: 3.3,
  },
  {
    name: "Lucas Ferreira",
    company: "Atlas Property Management",
    need: "Tenant maintenance requests: route them by urgency, assign contractors and keep tenants updated by email until the job is closed.",
    budget: "5k_15k",
    stage: "contacted",
    createdDaysAgo: 12.1,
    lastTouchDaysAgo: 4.4,
    notes: ["Left a voicemail. Try again — Lucas prefers calls before 11am."],
  },
  {
    name: "Amara Nwosu",
    company: "Harbor & Pine Interiors",
    need: "Sync Shopify orders to Airtable and ping our team on Slack whenever a custom order needs sign-off.",
    budget: "1k_5k",
    stage: "contacted",
    createdDaysAgo: 8.3,
    lastTouchDaysAgo: 6.2,
  },

  // ─── Proposal ─────────────────────────────────────────────────────────
  {
    name: "Oliver Grant",
    company: "Contoso Retail",
    need: "Customer-support triage with AI: classify incoming tickets, draft replies for agents, and escalate refund requests over $200.",
    budget: "50k_plus",
    stage: "proposal",
    createdDaysAgo: 20.2,
    lastTouchDaysAgo: 1.1,
    notes: [
      "Discovery call: ~1,800 tickets/week in Zendesk, 6 agents.",
      "Proposal sent: phased rollout, triage first, drafting in phase 2.",
    ],
  },
  {
    name: "Kenji Sato",
    company: "Fabrikam Studio",
    need: "Internal knowledge search over five years of project docs in Google Drive, with answers that cite the source file.",
    budget: "15k_50k",
    stage: "proposal",
    createdDaysAgo: 22.3,
    lastTouchDaysAgo: 0.4,
    notes: ["Demoed a prototype on 40 sample docs — they loved the citations."],
  },
  {
    name: "Mei Tanaka",
    company: "Bluepeak Analytics",
    need: "Automated weekly client reports from GA4 and HubSpot, delivered every Monday as branded PDFs.",
    budget: "5k_15k",
    stage: "proposal",
    createdDaysAgo: 16.2,
    lastTouchDaysAgo: 2.2,
  },
  {
    name: "Isabella Rossi",
    company: "Vantage Realty",
    need: "Listing descriptions generated from property data and photos, then published to our site and the big portals.",
    budget: "5k_15k",
    stage: "proposal",
    createdDaysAgo: 14.1,
    lastTouchDaysAgo: 3.2,
  },
  {
    name: "Noah Schmidt",
    company: "Tidewater Marine",
    need: "Parts inventory reorder alerts from our ERP, with supplier purchase emails drafted automatically for approval.",
    budget: "15k_50k",
    stage: "proposal",
    createdDaysAgo: 18.3,
    lastTouchDaysAgo: 5.1,
  },

  // ─── Won ──────────────────────────────────────────────────────────────
  {
    name: "Grace Holloway",
    company: "Juniper Legal",
    need: "Client intake form → conflict check → engagement letter generated and sent for e-signature.",
    budget: "15k_50k",
    stage: "won",
    createdDaysAgo: 40.2,
    lastTouchDaysAgo: 9.3,
    notes: ["Redlines agreed on the SOW — sent for signature."],
  },
  {
    name: "William Foster",
    company: "Copperleaf Accounting",
    need: "Collect monthly receipts from clients by email and file them into the right Google Drive folders automatically.",
    budget: "5k_15k",
    stage: "won",
    createdDaysAgo: 28.1,
    lastTouchDaysAgo: 6.4,
  },
  {
    name: "Mateo Alvarez",
    company: "Evergreen Landscaping",
    need: "Quote follow-up sequence and job scheduling synced from Jobber.",
    budget: "1k_5k",
    stage: "won",
    createdDaysAgo: 33.2,
    lastTouchDaysAgo: 12.2,
  },
  {
    name: "Zara Ahmed",
    company: "Redwood Clinics",
    need: "Patient feedback survey after each visit, with low scores routed to the practice manager the same day.",
    budget: "5k_15k",
    stage: "won",
    createdDaysAgo: 45.3,
    lastTouchDaysAgo: 20.1,
  },

  // ─── Lost ─────────────────────────────────────────────────────────────
  {
    name: "Ava Thompson",
    company: "Globex Media",
    need: "Auto-post our YouTube videos to every social channel with generated captions.",
    budget: "under_1k",
    stage: "lost",
    createdDaysAgo: 26.2,
    lastTouchDaysAgo: 18.1,
    notes: ["Went with an off-the-shelf tool — budget too tight for custom work."],
  },
  {
    name: "Emma Larsen",
    company: "Orbit Fitness",
    need: "A churn-prediction dashboard for our membership base.",
    budget: "5k_15k",
    stage: "lost",
    createdDaysAgo: 35.1,
    lastTouchDaysAgo: 15.2,
  },
  {
    name: "Felix Bauer",
    company: "Silverline Insurance",
    need: "Proof of concept for extracting data from claims documents.",
    budget: "50k_plus",
    stage: "lost",
    createdDaysAgo: 50.2,
    lastTouchDaysAgo: 25.3,
    notes: ["Project paused internally until next fiscal year."],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const STAGE_PATH: Record<Stage, Stage[]> = {
  new: [],
  contacted: ["contacted"],
  proposal: ["contacted", "proposal"],
  won: ["contacted", "proposal", "won"],
  lost: ["contacted", "proposal", "lost"],
};

const emailFor = (name: string, company: string): string => {
  const first = name.split(" ")[0]!.toLowerCase();
  const domain = company.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  return `${first}@${domain}.example`;
};

/**
 * Inserts the demo dataset relative to `now`, with a realistic timeline per
 * lead. Emails always go to the local outbox in preview mode — seeding never
 * sends real mail, even when SMTP is configured.
 */
export async function seedDemoData(
  c: Container,
  opts: {
    now: Date;
    outboxDir: string;
    from: string;
    owner: { email: string; name: string };
    appUrl: string;
    followUpAfterDays: number;
  },
): Promise<number> {
  const previewMailer = createMailer({ from: opts.from, outboxDir: opts.outboxDir }, c.emails);
  const at = (daysAgo: number) => new Date(opts.now.getTime() - daysAgo * DAY_MS);

  for (const seed of LEADS) {
    const input: NewLead = {
      name: seed.name,
      email: emailFor(seed.name, seed.company),
      company: seed.company,
      need: seed.need,
      budget: seed.budget,
    };
    const createdAt = at(seed.createdDaysAgo);
    const lead = c.leads.create(input, createdAt);

    const emailedAt = new Date(createdAt.getTime() + 20_000);
    const email = followUpEmail(lead, opts.owner.name);
    await previewMailer.send({ ...email, to: lead.email, kind: "follow_up", leadId: lead.id }, emailedAt);
    c.leads.addActivity(lead.id, "emailed", `Auto-reply sent: “${email.subject}”`, emailedAt);

    // Spread stage changes and notes evenly between creation and the last touch.
    type Step = { kind: "stage"; stage: Stage } | { kind: "note"; body: string };
    const steps: Step[] = STAGE_PATH[seed.stage].map((stage) => ({ kind: "stage" as const, stage }));
    // Notes on closed deals were written before the deal closed; otherwise they're the latest touch.
    const closed = seed.stage === "won" || seed.stage === "lost";
    const notes: Step[] = (seed.notes ?? []).map((body) => ({ kind: "note" as const, body }));
    if (closed) steps.splice(steps.length - 1, 0, ...notes);
    else steps.push(...notes);
    if (steps.length === 0) continue;

    const start = seed.createdDaysAgo - 0.05;
    const end = seed.lastTouchDaysAgo ?? seed.createdDaysAgo;
    steps.forEach((step, i) => {
      const daysAgo = steps.length === 1 ? end : start - ((start - end) * (i + 1)) / steps.length;
      if (step.kind === "stage") {
        c.leads.setStage(lead.id, step.stage, at(daysAgo), step.stage === "contacted" ? "contacted" : "stage_changed");
      } else {
        c.leads.addActivity(lead.id, "note", step.body, at(daysAgo));
      }
    });
  }

  // Leave this morning's digest in the outbox, as if the scheduled job had run at 08:00.
  const digestAt = new Date(opts.now);
  digestAt.setHours(8, 0, 0, 0);
  if (digestAt > opts.now) digestAt.setDate(digestAt.getDate() - 1);
  const stale = selectNeedsAttention(c.leads.list(), digestAt, opts.followUpAfterDays);
  if (stale.length > 0) {
    const digest = digestEmail(stale, opts.owner.name, opts.appUrl);
    await previewMailer.send({ ...digest, to: opts.owner.email, kind: "digest" }, digestAt);
  }

  return LEADS.length;
}
