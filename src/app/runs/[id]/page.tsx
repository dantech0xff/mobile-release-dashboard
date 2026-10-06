import fs from "fs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, Run, Project } from "@/lib/db";
import { StatusBadge, fmtDate } from "../../ui";
import AutoRefresh from "./AutoRefresh";

export const dynamic = "force-dynamic";

export default async function RunDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Run | undefined;
  if (!run) notFound();
  const project = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(run.project_id) as Project | undefined;

  let log = "";
  if (run.log_path && fs.existsSync(run.log_path)) {
    log = fs.readFileSync(run.log_path, "utf8");
  }

  const active = run.status === "queued" || run.status === "running";

  return (
    <div className="space-y-6">
      {active && <AutoRefresh intervalMs={4000} />}
      <div>
        <h1 className="text-xl font-semibold">
          Run #{run.id} — {project?.name || run.project_id}
        </h1>
        <p className="text-sm text-zinc-500">
          {run.trigger_type} · created {fmtDate(run.created_at)} · finished{" "}
          {fmtDate(run.finished_at)}
        </p>
      </div>

      <div className="card grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-xs text-zinc-500">Status</div>
          <StatusBadge status={run.status} />
        </div>
        <div>
          <div className="text-xs text-zinc-500">Stage</div>
          {run.stage || "—"}
        </div>
        <div>
          <div className="text-xs text-zinc-500">Version</div>
          {run.version_before ? `${run.version_before} → ${run.version_after}` : "—"}
        </div>
        <div>
          <div className="text-xs text-zinc-500">Artifact</div>
          <span className="break-all text-xs">
            {run.artifact_path ? run.artifact_path.split("/").pop() : "—"}
          </span>
        </div>
      </div>

      {run.error && (
        <div className="card border-red-900 text-sm text-red-300">
          <div className="text-xs text-zinc-500 mb-1">Error</div>
          {run.error}
        </div>
      )}

      <div className="card">
        <div className="mb-2 text-xs text-zinc-500">Log</div>
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap text-xs leading-5 text-zinc-300">
          {log || "No log yet — run is queued."}
        </pre>
      </div>

      <Link href={`/projects/${run.project_id}`} className="text-sm text-blue-400 hover:underline">
        ← Back to project
      </Link>
    </div>
  );
}
