import { getDb, Project, SigningProfile, ServiceAccount } from "@/lib/db";
import { saveProject } from "../actions";

export default function ProjectForm({ project }: { project?: Project }) {
  const db = getDb();
  const profiles = db
    .prepare("SELECT * FROM signing_profiles ORDER BY id")
    .all() as SigningProfile[];
  const accounts = db
    .prepare("SELECT * FROM service_accounts ORDER BY id")
    .all() as ServiceAccount[];
  const p = project;

  return (
    <form action={saveProject} className="card space-y-4">
      {p && <input type="hidden" name="id" value={p.id} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="field">
          <label htmlFor="name">Name *</label>
          <input id="name" name="name" required defaultValue={p?.name} placeholder="My app" />
        </div>
        <div className="field">
          <label htmlFor="type">Project type</label>
          <select id="type" name="type" defaultValue={p?.type || "android-kotlin"}>
            <option value="android-kotlin">Android Native (Kotlin)</option>
            <option value="flutter">Flutter (Android + iOS)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="repo_url">Repo URL *</label>
          <input
            id="repo_url"
            name="repo_url"
            required
            defaultValue={p?.repo_url}
            placeholder="https://github.com/owner/repo"
          />
        </div>
        <div className="field">
          <label htmlFor="branch">Branch</label>
          <input id="branch" name="branch" defaultValue={p?.branch || "main"} />
        </div>
      </div>

      <h3 className="pt-2 text-sm font-semibold text-zinc-300">Version bump</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="field">
          <label htmlFor="version_scheme">Scheme</label>
          <select
            id="version_scheme"
            name="version_scheme"
            defaultValue={p?.version_scheme || "patch"}
          >
            <option value="patch">patch — x.y.(z+1), code+1</option>
            <option value="minor">minor — x.(y+1).0, code+1</option>
            <option value="major">major — (x+1).0.0, code+1</option>
            <option value="build-only">build only — name unchanged, code+1</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="gradle_file">Gradle file (Android)</label>
          <input
            id="gradle_file"
            name="gradle_file"
            defaultValue={p?.gradle_file || ""}
            placeholder="auto: app/build.gradle.kts"
          />
        </div>
        <div className="field">
          <label htmlFor="gradle_task">Gradle task (Android)</label>
          <input
            id="gradle_task"
            name="gradle_task"
            defaultValue={p?.gradle_task || ""}
            placeholder="bundleRelease"
          />
        </div>
      </div>

      <h3 className="pt-2 text-sm font-semibold text-zinc-300">Signing &amp; release</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="field">
          <label htmlFor="signing_profile_id">Signing profile</label>
          <select
            id="signing_profile_id"
            name="signing_profile_id"
            defaultValue={p?.signing_profile_id || ""}
          >
            <option value="">— none —</option>
            {profiles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.key_alias})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="release_target">Release target</label>
          <select
            id="release_target"
            name="release_target"
            defaultValue={p?.release_target || "play-internal"}
          >
            <option value="play-internal">Google Play — internal track</option>
            <option value="play-alpha">Google Play — alpha</option>
            <option value="play-beta">Google Play — beta</option>
            <option value="play-production">Google Play — production</option>
            <option value="none">Build only (no upload)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="play_account_id">Play service account</label>
          <select
            id="play_account_id"
            name="play_account_id"
            defaultValue={p?.play_account_id || ""}
          >
            <option value="">— none —</option>
            {accounts
              .filter((a) => a.kind === "play")
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="package_name">Package name (applicationId)</label>
          <input
            id="package_name"
            name="package_name"
            defaultValue={p?.package_name || ""}
            placeholder="com.example.app"
          />
        </div>
        <div className="field">
          <label htmlFor="artifact_glob">Artifact path hint</label>
          <input
            id="artifact_glob"
            name="artifact_glob"
            defaultValue={p?.artifact_glob || ""}
            placeholder="auto: **/release/*.aab"
          />
        </div>
      </div>

      <h3 className="pt-2 text-sm font-semibold text-zinc-300">Schedule</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="field">
          <label htmlFor="schedule_cron">Cron (weekly e.g. 0 9 * * 1)</label>
          <input
            id="schedule_cron"
            name="schedule_cron"
            defaultValue={p?.schedule_cron || ""}
            placeholder="0 9 * * 1"
          />
          <p className="text-xs text-zinc-600">
            <code>0 9 * * 1</code> = 09:00 every Monday, in the server&apos;s <code>TZ</code>.
            Leave empty for manual runs only.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300 pb-2">
          <input
            key={String(!!p?.schedule_enabled)}
            type="checkbox"
            name="schedule_enabled"
            defaultChecked={!!p?.schedule_enabled}
            className="h-4 w-4"
          />
          Enabled
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn">
          {p ? "Save" : "Create project"}
        </button>
      </div>
    </form>
  );
}
