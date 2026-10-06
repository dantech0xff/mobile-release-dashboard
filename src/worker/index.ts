// Release worker: cron scheduler + serial build executor.
// Run with: npx tsx src/worker/index.ts
import { getDb } from "../lib/db";
import { ensureDirs } from "../lib/env";
import { claimNextQueuedRun, enqueueDueSchedules } from "../lib/scheduler";
import { executeRun } from "../lib/pipeline";

const TICK_MS = Number(process.env.WORKER_TICK_MS || 15000);

function failInterruptedRuns() {
  const db = getDb();
  const res = db
    .prepare(
      "UPDATE runs SET status = 'failed', finished_at = datetime('now'), error = 'interrupted: worker restarted' WHERE status = 'running'"
    )
    .run();
  if (res.changes > 0) console.log(`marked ${res.changes} interrupted run(s) as failed`);
}

let busy = false;
async function tick() {
  try {
    enqueueDueSchedules();
    if (busy) return;
    const runId = claimNextQueuedRun();
    if (runId == null) return;
    busy = true;
    console.log(`executing run ${runId}`);
    try {
      await executeRun(runId);
    } catch (err) {
      console.error(`run ${runId} crashed:`, err);
    } finally {
      busy = false;
    }
  } catch (err) {
    console.error("tick error:", err);
  }
}

async function main() {
  ensureDirs();
  getDb();
  failInterruptedRuns();
  console.log(`worker started (tick ${TICK_MS}ms, data ${process.env.DATA_DIR || "./data"})`);
  setInterval(tick, TICK_MS);
  await tick();
}

main();
