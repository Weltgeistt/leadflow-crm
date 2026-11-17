import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type DB = Database.Database;

/**
 * Schema migrations, applied in order. `PRAGMA user_version` records how many
 * have run, so adding a migration is just appending a string to this list.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE leads (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    email            TEXT NOT NULL,
    company          TEXT NOT NULL DEFAULT '',
    need             TEXT NOT NULL,
    budget           TEXT NOT NULL,
    stage            TEXT NOT NULL DEFAULT 'new',
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    last_activity_at TEXT NOT NULL
  );
  CREATE INDEX idx_leads_stage ON leads(stage);

  CREATE TABLE activities (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_activities_lead ON activities(lead_id, created_at);

  CREATE TABLE emails (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id    INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    kind       TEXT NOT NULL,
    to_address TEXT NOT NULL,
    subject    TEXT NOT NULL,
    html       TEXT NOT NULL,
    text       TEXT NOT NULL,
    transport  TEXT NOT NULL,
    file       TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_emails_created ON emails(created_at);
  `,
];

/** Opens (and migrates) the database. Pass ":memory:" for tests. */
export function openDatabase(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[version]!);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}
