import Link from "next/link";
import { getDb, Project, Run } from "@/lib/db";
import { triggerRun, toggleSchedule } from "./actions";
import { StatusBadge, fmtDate, cronHuman } from "./ui";

export const dynamic = "force-dynamic";

type Row = Project & { last_status: string | null; last_run_id: number | null };

export default function Dashboard() {
  const db = getDb();
  const projects = db
    .prepare(
      `SELECT p.*, r.status AS last_status, r.id AS last_run_id
       FROM projects p
       LEFT JOIN runs r ON r.id = (SELECT id FROM runs WHERE project_id = p.id ORDER BY id DESC LIMIT 1)
       ORDER BY p.id`
    )
    .all() as Row[];
  const recent = db
    .prepare(
      `SELECT r.*, p.name AS project_name FROM runs r JOIN projects p ON p.id = r.project_id
       ORDER BY r.id DESC LIMIT 10`
    )
    .all() as (Run & { project_name: string })[];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        <Link href="/projects/new" className="btn">
          + New project
        </Link>
      </div>

      <div className="card overflow-x-auto">
        {projects.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No projects yet. Add one to start automating releases.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="pb-2">Name</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Schedule</th>
                <th className="pb-2">Next run</th>
                <th className="pb-2">Last run</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-zinc-800">
                  <td className="py-2">
                    <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs text-zinc-500">{p.repo_url}</div>
                  </td>
                  <td className="py-2 text-zinc-400">{p.type}</td>
                  <td className="py-2 text-zinc-400">
                    {p.schedule_cron ? (
                      <div>
                        <span className="font-mono text-xs">{p.schedule_cron}</span>
                        <div className="text-xs text-zinc-500">
                          {cronHuman(p.schedule_cron)}
                          {!p.schedule_enabled && " · paused"}
                        </div>
                      </div>
                    ) : (
                      "manual"
                    )}
                  </td>
                  <td className="py-2 text-zinc-400">
                    {p.schedule_enabled && p.next_run_at ? fmtDate(p.next_run_at) : "—"}
                  </td>
                  <td className="py-2">
                    {p.last_run_id ? (
                      <Link href={`/runs/${p.last_run_id}`}>
                        <StatusBadge status={p.last_status || "queued"} />
                      </Link>
                    ) : (
                      <span className="text-zinc-600">never</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {p.schedule_cron && (
                        <form action={toggleSchedule}>
                          <input type="hidden" name="project_id" value={p.id} />
                          <button className="btn-secondary" type="submit">
                            {p.schedule_enabled ? "Pause" : "Resume"}
                          </button>
                        </form>
                      )}
                      <form action={triggerRun}>
                        <input type="hidden" name="project_id" value={p.id} />
                        <button className="btn-secondary" type="submit">
                          Run now
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="text-lg font-semibold">Recent runs</h2>
      <div className="card overflow-x-auto">
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">No runs yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="pb-2">Run</th>
                <th className="pb-2">Project</th>
                <th className="pb-2">Trigger</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Stage</th>
                <th className="pb-2">Version</th>
                <th className="pb-2">Finished</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-zinc-800">
                  <td className="py-2">
                    <Link href={`/runs/${r.id}`} className="text-blue-400 hover:underline">
                      #{r.id}
                    </Link>
                  </td>
                  <td className="py-2">{r.project_name}</td>
                  <td className="py-2 text-zinc-400">{r.trigger_type}</td>
                  <td className="py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-2 text-zinc-400">{r.stage || "—"}</td>
                  <td className="py-2 text-zinc-400">{r.version_after || "—"}</td>
                  <td className="py-2 text-zinc-400">{fmtDate(r.finished_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
