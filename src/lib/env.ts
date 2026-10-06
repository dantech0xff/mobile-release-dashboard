import path from "path";
import fs from "fs";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const DB_PATH = path.join(DATA_DIR, "dashboard.db");
export const LOGS_DIR = path.join(DATA_DIR, "logs");
export const WORKSPACES_DIR = path.join(DATA_DIR, "workspaces");
export const KEYSTORES_DIR = path.join(DATA_DIR, "keystores");
export const TMP_DIR = path.join(DATA_DIR, "tmp");
export const GRADLE_USER_HOME = path.join(DATA_DIR, "gradle-home");

export function ensureDirs() {
  for (const d of [DATA_DIR, LOGS_DIR, WORKSPACES_DIR, KEYSTORES_DIR, TMP_DIR, GRADLE_USER_HOME]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export const MASTER_KEY = process.env.DASHBOARD_MASTER_KEY || "";
export const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";
