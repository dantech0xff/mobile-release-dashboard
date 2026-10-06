"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { isValidCron, nextRunAt, enqueueRun } from "@/lib/scheduler";
import { KEYSTORES_DIR, ensureDirs } from "@/lib/env";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function saveProject(fd: FormData) {
  const db = getDb();
  const id = Number(str(fd, "id") || 0);
  const scheduleCron = str(fd, "schedule_cron") || null;
  const scheduleEnabled = fd.get("schedule_enabled") ? 1 : 0;
  if (scheduleCron && !isValidCron(scheduleCron)) {
    throw new Error(`Invalid cron expression: ${scheduleCron}`);
  }
  const next = scheduleEnabled && scheduleCron ? nextRunAt(scheduleCron) : null;

  const fields = {
    name: str(fd, "name"),
    repo_url: str(fd, "repo_url"),
    branch: str(fd, "branch") || "main",
    type: str(fd, "type") || "android-kotlin",
    version_scheme: str(fd, "version_scheme") || "patch",
    gradle_file: str(fd, "gradle_file") || null,
    gradle_task: str(fd, "gradle_task") || null,
    artifact_glob: str(fd, "artifact_glob") || null,
    package_name: str(fd, "package_name") || null,
    release_target: str(fd, "release_target") || "play-internal",
    signing_profile_id: Number(str(fd, "signing_profile_id")) || null,
    play_account_id: Number(str(fd, "play_account_id")) || null,
    schedule_cron: scheduleCron,
    schedule_enabled: scheduleEnabled,
    next_run_at: next,
  };

  if (id > 0) {
    db.prepare(
      `UPDATE projects SET name=@name, repo_url=@repo_url, branch=@branch, type=@type,
       version_scheme=@version_scheme, gradle_file=@gradle_file, gradle_task=@gradle_task,
       artifact_glob=@artifact_glob, package_name=@package_name, release_target=@release_target,
       signing_profile_id=@signing_profile_id, play_account_id=@play_account_id,
       schedule_cron=@schedule_cron, schedule_enabled=@schedule_enabled, next_run_at=@next_run_at,
       updated_at=datetime('now') WHERE id=@id`
    ).run({ ...fields, id });
  } else {
    db.prepare(
      `INSERT INTO projects (name, repo_url, branch, type, version_scheme, gradle_file,
        gradle_task, artifact_glob, package_name, release_target, signing_profile_id,
        play_account_id, schedule_cron, schedule_enabled, next_run_at)
       VALUES (@name, @repo_url, @branch, @type, @version_scheme, @gradle_file, @gradle_task,
        @artifact_glob, @package_name, @release_target, @signing_profile_id, @play_account_id,
        @schedule_cron, @schedule_enabled, @next_run_at)`
    ).run(fields);
  }
  revalidatePath("/");
  redirect("/");
}

export async function deleteProject(fd: FormData) {
  const id = Number(str(fd, "id"));
  getDb().prepare("DELETE FROM projects WHERE id = ?").run(id);
  revalidatePath("/");
  redirect("/");
}

export async function triggerRun(fd: FormData) {
  const projectId = Number(str(fd, "project_id"));
  enqueueRun(projectId, "manual");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function saveGithubPat(fd: FormData) {
  const pat = str(fd, "github_pat");
  const db = getDb();
  if (!pat) {
    db.prepare("DELETE FROM secrets WHERE key = 'GITHUB_PAT'").run();
  } else {
    db.prepare(
      "INSERT INTO secrets (key, value_enc) VALUES ('GITHUB_PAT', ?) ON CONFLICT(key) DO UPDATE SET value_enc = excluded.value_enc"
    ).run(encrypt(pat));
  }
  revalidatePath("/secrets");
}

export async function saveSigningProfile(fd: FormData) {
  ensureDirs();
  const name = str(fd, "name");
  const keyAlias = str(fd, "key_alias");
  const storePassword = str(fd, "store_password");
  const keyPassword = str(fd, "key_password") || storePassword;
  const file = fd.get("keystore");
  if (!(file instanceof File) || file.size === 0) throw new Error("keystore file required");

  const db = getDb();
  const res = db
    .prepare(
      "INSERT INTO signing_profiles (name, keystore_path, store_password_enc, key_alias, key_password_enc) VALUES (?, '', ?, ?, ?)"
    )
    .run(name, encrypt(storePassword), keyAlias, encrypt(keyPassword));
  const id = Number(res.lastInsertRowid);

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ksPath = path.join(KEYSTORES_DIR, `${id}-${safe}`);
  fs.writeFileSync(ksPath, Buffer.from(await file.arrayBuffer()), { mode: 0o600 });
  db.prepare("UPDATE signing_profiles SET keystore_path = ? WHERE id = ?").run(ksPath, id);
  revalidatePath("/secrets");
}

export async function deleteSigningProfile(fd: FormData) {
  const id = Number(str(fd, "id"));
  const db = getDb();
  const row = db.prepare("SELECT keystore_path FROM signing_profiles WHERE id = ?").get(id) as
    | { keystore_path: string }
    | undefined;
  if (row) {
    try {
      fs.rmSync(row.keystore_path, { force: true });
    } catch {}
  }
  db.prepare("DELETE FROM signing_profiles WHERE id = ?").run(id);
  revalidatePath("/secrets");
}

export async function saveServiceAccount(fd: FormData) {
  const name = str(fd, "name");
  const kind = str(fd, "kind") || "play";
  const json = str(fd, "json");
  JSON.parse(json); // throws on invalid JSON
  getDb()
    .prepare("INSERT INTO service_accounts (name, kind, json_enc) VALUES (?, ?, ?)")
    .run(name, kind, encrypt(json));
  revalidatePath("/secrets");
}

export async function deleteServiceAccount(fd: FormData) {
  const id = Number(str(fd, "id"));
  getDb().prepare("DELETE FROM service_accounts WHERE id = ?").run(id);
  revalidatePath("/secrets");
}
