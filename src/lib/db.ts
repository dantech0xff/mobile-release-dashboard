import Database from "better-sqlite3";
import { DB_PATH, ensureDirs } from "./env";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  type TEXT NOT NULL CHECK (type IN ('android-kotlin','flutter')),
  version_scheme TEXT NOT NULL DEFAULT 'patch',
  gradle_file TEXT,
  gradle_task TEXT,
  artifact_glob TEXT,
  package_name TEXT,
  release_target TEXT NOT NULL DEFAULT 'play-internal',
  signing_profile_id INTEGER REFERENCES signing_profiles(id),
  play_account_id INTEGER REFERENCES service_accounts(id),
  schedule_cron TEXT,
  schedule_enabled INTEGER NOT NULL DEFAULT 0,
  next_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS signing_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  keystore_path TEXT NOT NULL,
  store_password_enc TEXT NOT NULL,
  key_alias TEXT NOT NULL,
  key_password_enc TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS service_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'play' CHECK (kind IN ('play','appstore')),
  json_enc TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS secrets (
  key TEXT PRIMARY KEY,
  value_enc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'queued',
  stage TEXT,
  version_before TEXT,
  version_after TEXT,
  artifact_path TEXT,
  log_path TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status, id);
`;

declare global {
  var __mrdDb: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (!global.__mrdDb) {
    ensureDirs();
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 10000");
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA);
    global.__mrdDb = db;
  }
  return global.__mrdDb;
}

export type Project = {
  id: number;
  name: string;
  repo_url: string;
  branch: string;
  type: "android-kotlin" | "flutter";
  version_scheme: string;
  gradle_file: string | null;
  gradle_task: string | null;
  artifact_glob: string | null;
  package_name: string | null;
  release_target: string;
  signing_profile_id: number | null;
  play_account_id: number | null;
  schedule_cron: string | null;
  schedule_enabled: number;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Run = {
  id: number;
  project_id: number;
  trigger_type: string;
  status: "queued" | "running" | "success" | "failed";
  stage: string | null;
  version_before: string | null;
  version_after: string | null;
  artifact_path: string | null;
  log_path: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type SigningProfile = {
  id: number;
  name: string;
  keystore_path: string;
  store_password_enc: string;
  key_alias: string;
  key_password_enc: string;
  created_at: string;
};

export type ServiceAccount = {
  id: number;
  name: string;
  kind: "play" | "appstore";
  json_enc: string;
  created_at: string;
};
