import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, Project, Run } from "@/lib/db";
import ProjectForm from "../ProjectForm";
import { triggerRun, deleteProject, toggleSchedule } from "../../actions";
import { StatusBadge, fmtDate, cronHuman } from "../../ui";

export const dynamic = "force-dynamic";

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | Project
    | undefined;
  if (!project) notFound();

  const runs = db
    .prepare("SELECT * FROM runs WHERE project_id = ? ORDER BY id DESC LIMIT 20")
    .all(project.id) as Run[];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <p className="text-sm text-zinc-500">
            {project.repo_url} · {project.branch} · {project.type}
            {project.schedule_cron && (
              <>
                {" "}· {cronHuman(project.schedule_cron)} (
                {project.schedule_cron}) · next run:{" "}
                {project.schedule_enabled && project.next_run_at
                  ? fmtDate(project.next_run_at)
                  : "paused"}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {project.schedule_cron && (
            <form action={toggleSchedule}>
              <input type="hidden" name="project_id" value={project.id} />
              <button type="submit" className="btn-secondary">
                {project.schedule_enabled ? "Pause schedule" : "Resume schedule"}
              </button>
            </form>
          )}
          <form action={triggerRun}>
            <input type="hidden" name="project_id" value={project.id} />
            <button type="submit" className="btn">
              Run now
            </button>
          </form>
          <form action={deleteProject}>
            <input type="hidden" name="id" value={project.id} />
            <button type="submit" className="btn-danger">
              Delete
            </button>
          </form>
        </div>
      </div>

      <h2 className="text-lg font-semibold">Runs</h2>
      <div className="card overflow-x-auto">
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-500">No runs yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="pb-2">Run</th>
                <th className="pb-2">Trigger</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Stage</th>
                <th className="pb-2">Version</th>
                <th className="pb-2">Started</th>
                <th className="pb-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-zinc-800">
                  <td className="py-2">
                    <Link href={`/runs/${r.id}`} className="text-blue-400 hover:underline">
                      #{r.id}
                    </Link>
                  </td>
                  <td className="py-2 text-zinc-400">{r.trigger_type}</td>
                  <td className="py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-2 text-zinc-400">{r.stage || "—"}</td>
                  <td className="py-2 text-zinc-400">{r.version_after || "—"}</td>
                  <td className="py-2 text-zinc-400">{fmtDate(r.started_at)}</td>
                  <td className="py-2 text-red-400 max-w-xs truncate">{r.error || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="text-lg font-semibold">Configuration</h2>
      <ProjectForm project={project} />
    </div>
  );
}
