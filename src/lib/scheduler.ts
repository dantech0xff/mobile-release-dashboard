import { Cron } from "croner";
import { getDb, Project } from "./db";

export function nextRunAt(cron: string, from = new Date()): string | null {
  try {
    const c = new Cron(cron, { paused: true });
    const next = c.nextRun(from);
    return next ? next.toISOString() : null;
  } catch {
    return null;
  }
}

export function isValidCron(cron: string): boolean {
  try {
    new Cron(cron);
    return true;
  } catch {
    return false;
  }
}

export function enqueueRun(projectId: number, trigger: "schedule" | "manual"): number {
  const db = getDb();
  const res = db
    .prepare("INSERT INTO runs (project_id, trigger_type, status) VALUES (?, ?, 'queued')")
    .run(projectId, trigger);
  return Number(res.lastInsertRowid);
}

// Insert queued runs for projects whose schedule is due; recompute their next_run_at.
export function enqueueDueSchedules(now = new Date()): number {
  const db = getDb();
  const due = db
    .prepare(
      "SELECT * FROM projects WHERE schedule_enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?"
    )
    .all(now.toISOString()) as Project[];

  let enqueued = 0;
  for (const p of due) {
    enqueueRun(p.id, "schedule");
    const next = p.schedule_cron ? nextRunAt(p.schedule_cron) : null;
    db.prepare("UPDATE projects SET next_run_at = ? WHERE id = ?").run(next, p.id);
    enqueued++;
  }
  return enqueued;
}

export function claimNextQueuedRun(): number | null {
  const db = getDb();
  const tx = db.transaction(() => {
    const row = db
      .prepare("SELECT id FROM runs WHERE status = 'queued' ORDER BY id LIMIT 1")
      .get() as { id: number } | undefined;
    if (!row) return null;
    db.prepare(
      "UPDATE runs SET status = 'running', started_at = datetime('now') WHERE id = ?"
    ).run(row.id);
    return row.id as number;
  });
  return tx();
}
