import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { getDb, Project, Run, SigningProfile, ServiceAccount } from "./db";
import { decrypt } from "./crypto";
import {
  ensureDirs,
  LOGS_DIR,
  WORKSPACES_DIR,
  TMP_DIR,
  GRADLE_USER_HOME,
} from "./env";
import { bumpProject } from "./version";
import { notifyRunFinished, telegramConfigured } from "./notify";

type Logger = (line: string) => void;

function makeLogger(logFile: string): Logger {
  const stream = fs.createWriteStream(logFile, { flags: "a" });
  return (line: string) => {
    const stamped = `[${new Date().toISOString()}] ${line}`;
    stream.write(stamped + "\n");
    console.log(stamped);
  };
}

function runCmd(
  log: Logger,
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string>; redact?: string[] } = {}
): Promise<void> {
  const shown = [cmd, ...args].join(" ");
  let redacted = shown;
  for (const s of opts.redact || []) if (s) redacted = redacted.split(s).join("***");
  log(`$ ${redacted}`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      shell: false,
    });
    child.stdout.on("data", (d) => log(String(d).trimEnd()));
    child.stderr.on("data", (d) => log(String(d).trimEnd()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

function gitAuthArgs(pat: string): string[] {
  // Per-invocation auth header — the PAT never lands in .git/config.
  return ["-c", `http.https://github.com/.extraheader=AUTHORIZATION: bearer ${pat}`];
}

function getSecret(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value_enc FROM secrets WHERE key = ?")
    .get(key) as { value_enc: string } | undefined;
  return row ? decrypt(row.value_enc) : null;
}

function setStage(runId: number, stage: string) {
  getDb().prepare("UPDATE runs SET stage = ? WHERE id = ?").run(stage, runId);
}

function findArtifact(ws: string, glob: string | null): string | null {
  const candidates: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".aab") && p.includes("release")) candidates.push(p);
    }
  };
  walk(ws);
  if (glob) {
    const needle = glob.replace(/^\//, "").replace(/\*/g, "");
    const hit = candidates.find((p) => p.includes(needle));
    if (hit) return hit;
  }
  // Prefer final outputs (*/outputs/*) — intermediates like intermediary-bundle.aab are unsigned.
  candidates.sort((a, b) => {
    const ai = a.includes("/outputs/") ? 0 : 1;
    const bi = b.includes("/outputs/") ? 0 : 1;
    return ai - bi || a.localeCompare(b);
  });
  return candidates[0] || null;
}

const SIGNING_INIT = `
allprojects { project ->
    project.afterEvaluate {
        def android = project.extensions.findByName('android')
        if (android != null) {
            android.signingConfigs {
                mrdRelease {
                    storeFile file(System.getenv('MRD_KEYSTORE'))
                    storePassword System.getenv('MRD_STORE_PASSWORD')
                    keyAlias System.getenv('MRD_KEY_ALIAS')
                    keyPassword System.getenv('MRD_KEY_PASSWORD')
                }
            }
            android.buildTypes.release.signingConfig = android.signingConfigs.mrdRelease
        }
    }
}
`;

export async function executeRun(runId: number): Promise<void> {
  ensureDirs();
  const db = getDb();
  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as Run;
  const project = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(run.project_id) as Project | undefined;
  if (!project) throw new Error(`run ${runId}: project ${run.project_id} not found`);

  const logFile = path.join(LOGS_DIR, `run-${runId}.log`);
  const log = makeLogger(logFile);
  db.prepare("UPDATE runs SET log_path = ? WHERE id = ?").run(logFile, runId);

  const ws = path.join(WORKSPACES_DIR, String(project.id));
  const initDir = path.join(GRADLE_USER_HOME, "init.d");
  const initFile = path.join(initDir, "mrd-signing.gradle");
  let saJsonPath: string | null = null;

  const finish = (status: "success" | "failed", error: string | null = null) => {
    db.prepare(
      "UPDATE runs SET status = ?, finished_at = datetime('now'), error = ? WHERE id = ?"
    ).run(status, error, runId);
    // hygiene: remove injected secrets
    try {
      fs.rmSync(initFile, { force: true });
    } catch {}
    if (saJsonPath) {
      try {
        fs.rmSync(saJsonPath, { force: true });
      } catch {}
    }
  };

  try {
    // ---- prepare ------------------------------------------------------
    setStage(runId, "prepare");
    const pat = getSecret("GITHUB_PAT");
    const authArgs = pat ? gitAuthArgs(pat) : [];
    const redact = pat ? [pat] : [];
    const cleanUrl = project.repo_url.replace(
      /^https:\/\/([^@/]+@)?github\.com/,
      "https://github.com"
    );

    if (fs.existsSync(path.join(ws, ".git"))) {
      await runCmd(log, "git", [...authArgs, "fetch", "origin", project.branch], {
        cwd: ws,
        redact,
      });
      await runCmd(log, "git", ["checkout", project.branch], { cwd: ws });
      await runCmd(log, "git", ["reset", "--hard", `origin/${project.branch}`], { cwd: ws });
      await runCmd(log, "git", ["clean", "-fdx", "-e", ".gradle"], { cwd: ws });
    } else {
      fs.mkdirSync(ws, { recursive: true });
      await runCmd(
        log,
        "git",
        [...authArgs, "clone", "--branch", project.branch, cleanUrl, ws],
        { redact }
      );
    }

    // ---- bump ---------------------------------------------------------
    setStage(runId, "bump");
    const bump = bumpProject(ws, project.type, project.gradle_file, project.version_scheme);
    const before = `${bump.versionNameBefore} (${bump.versionCodeBefore})`;
    const after = `${bump.versionNameAfter} (${bump.versionCodeAfter})`;
    db.prepare("UPDATE runs SET version_before = ?, version_after = ? WHERE id = ?").run(
      before,
      after,
      runId
    );
    log(`bumped ${bump.file}: ${before} -> ${after}`);

    // ---- commit + push -------------------------------------------------
    setStage(runId, "commit_push");
    const msg = `chore(release): bump v${bump.versionNameAfter || bump.versionNameBefore} (${bump.versionCodeAfter})`;
    await runCmd(log, "git", ["add", "-A"], { cwd: ws });
    await runCmd(
      log,
      "git",
      ["-c", "user.name=release-bot", "-c", "user.email=release-bot@localhost", "commit", "-m", msg],
      { cwd: ws }
    );
    await runCmd(log, "git", [...authArgs, "push", "origin", `HEAD:${project.branch}`], {
      cwd: ws,
      redact,
    });

    // ---- build ----------------------------------------------------------
    setStage(runId, "build");
    const buildEnv: Record<string, string> = { GRADLE_USER_HOME };
    let profile: SigningProfile | undefined;
    if (project.signing_profile_id) {
      profile = db
        .prepare("SELECT * FROM signing_profiles WHERE id = ?")
        .get(project.signing_profile_id) as SigningProfile | undefined;
    }
    if (profile) {
      fs.mkdirSync(initDir, { recursive: true });
      fs.writeFileSync(initFile, SIGNING_INIT);
      buildEnv.MRD_KEYSTORE = profile.keystore_path;
      buildEnv.MRD_STORE_PASSWORD = decrypt(profile.store_password_enc);
      buildEnv.MRD_KEY_ALIAS = profile.key_alias;
      buildEnv.MRD_KEY_PASSWORD = decrypt(profile.key_password_enc);
      log(`signing: profile #${profile.id} "${profile.name}" (alias ${profile.key_alias})`);
    } else {
      log("signing: no signing profile configured — building with repo defaults");
    }

    if (project.type === "flutter") {
      await runCmd(log, "flutter", ["pub", "get"], { cwd: ws, env: buildEnv });
      await runCmd(log, "flutter", ["build", "appbundle", "--release"], {
        cwd: ws,
        env: buildEnv,
      });
    } else {
      const task = project.gradle_task || "bundleRelease";
      await runCmd(log, "./gradlew", [task, "--no-daemon", "--stacktrace"], {
        cwd: ws,
        env: buildEnv,
      });
    }

    const artifact = findArtifact(ws, project.artifact_glob);
    if (!artifact) throw new Error("no .aab release artifact found after build");
    db.prepare("UPDATE runs SET artifact_path = ? WHERE id = ?").run(artifact, runId);
    log(`artifact: ${artifact}`);

    // ---- upload -----------------------------------------------------------
    setStage(runId, "upload");
    let account: ServiceAccount | undefined;
    if (project.play_account_id) {
      account = db
        .prepare("SELECT * FROM service_accounts WHERE id = ?")
        .get(project.play_account_id) as ServiceAccount | undefined;
    }
    if (project.release_target === "none") {
      log("release_target=none — skipping upload");
    } else if (!account) {
      log("no Play service account configured — skipping upload");
    } else if (!project.package_name) {
      throw new Error("package_name is required for Play upload");
    } else {
      saJsonPath = path.join(TMP_DIR, `sa-${runId}.json`);
      fs.mkdirSync(TMP_DIR, { recursive: true });
      fs.writeFileSync(saJsonPath, decrypt(account.json_enc), { mode: 0o600 });
      const track = project.release_target.replace("play-", "");
      await runCmd(
        log,
        "fastlane",
        [
          "supply",
          "--aab",
          artifact,
          "--package_name",
          project.package_name,
          "--track",
          track,
          "--json_key",
          saJsonPath,
          "--skip_upload_metadata",
          "--skip_upload_images",
          "--skip_upload_screenshots",
          "--skip_upload_changelogs",
          "--timeout",
          "600",
        ],
        { redact }
      );
      log(`uploaded ${path.basename(artifact)} to Play track ${track}`);
    }

    finish("success");
    log("run finished: success");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`FAILED: ${msg}`);
    finish("failed", msg);
  } finally {
    // Best-effort notification — a Telegram hiccup must never mark the run.
    try {
      if (telegramConfigured()) {
        await notifyRunFinished(runId);
        log("telegram: notified");
      }
    } catch (e) {
      log(`telegram notify failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}
