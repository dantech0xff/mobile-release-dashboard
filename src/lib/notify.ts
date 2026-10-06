import { getDb, Run } from "./db";
import { decrypt } from "./crypto";

function getSecret(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value_enc FROM secrets WHERE key = ?")
    .get(key) as { value_enc: string } | undefined;
  return row ? decrypt(row.value_enc) : null;
}

export function telegramConfigured(): boolean {
  return !!(getSecret("TELEGRAM_BOT_TOKEN") && getSecret("TELEGRAM_CHAT_ID"));
}

export async function sendTelegram(text: string): Promise<void> {
  const token = getSecret("TELEGRAM_BOT_TOKEN");
  const chatId = getSecret("TELEGRAM_CHAT_ID");
  if (!token || !chatId) throw new Error("telegram not configured");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`telegram send failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
}

export async function notifyRunFinished(runId: number): Promise<void> {
  const db = getDb();
  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(runId) as
    | Run
    | undefined;
  if (!run || (run.status !== "success" && run.status !== "failed")) return;
  const project = db
    .prepare("SELECT name FROM projects WHERE id = ?")
    .get(run.project_id) as { name: string } | undefined;
  const name = project?.name ?? `project ${run.project_id}`;
  const ok = run.status === "success";

  const lines = [
    `${ok ? "✅" : "❌"} MRD run #${run.id} — ${name}`,
    `status: ${run.status} · stage: ${run.stage ?? "?"} · trigger: ${run.trigger_type}`,
  ];
  if (run.version_after) {
    lines.push(`version: ${run.version_before || "?"} → ${run.version_after}`);
  }
  if (run.started_at && run.finished_at) {
    const secs = Math.round(
      (new Date(run.finished_at + "Z").getTime() -
        new Date(run.started_at + "Z").getTime()) /
        1000
    );
    lines.push(`duration: ${Math.floor(secs / 60)}m ${secs % 60}s`);
  }
  if (run.error) lines.push(`error: ${run.error.slice(0, 300)}`);

  await sendTelegram(lines.join("\n"));
}
