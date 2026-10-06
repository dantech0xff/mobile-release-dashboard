import { getDb, SigningProfile, ServiceAccount } from "@/lib/db";
import {
  saveGithubPat,
  saveSigningProfile,
  deleteSigningProfile,
  saveServiceAccount,
  deleteServiceAccount,
} from "../actions";

export const dynamic = "force-dynamic";

export default function SecretsPage() {
  const db = getDb();
  const patSet = !!db.prepare("SELECT key FROM secrets WHERE key = 'GITHUB_PAT'").get();
  const profiles = db
    .prepare("SELECT * FROM signing_profiles ORDER BY id")
    .all() as SigningProfile[];
  const accounts = db
    .prepare("SELECT id, name, kind, created_at FROM service_accounts ORDER BY id")
    .all() as Omit<ServiceAccount, "json_enc">[];

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Secrets</h1>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold">GitHub PAT</h2>
        <p className="text-xs text-zinc-500">
          Used to clone and push version-bump commits. Needs <code>repo</code> (and{" "}
          <code>workflow</code> if repos have workflows affected) scope. Status:{" "}
          {patSet ? (
            <span className="text-emerald-400">configured</span>
          ) : (
            <span className="text-red-400">not set — git operations will fail for private repos</span>
          )}
        </p>
        <form action={saveGithubPat} className="flex gap-2">
          <input
            type="password"
            name="github_pat"
            placeholder={patSet ? "•••••••• (leave blank to clear)" : "ghp_..."}
            className="w-80"
          />
          <button type="submit" className="btn-secondary">
            Save
          </button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold">Signing profiles (keystores)</h2>
        {profiles.length === 0 ? (
          <p className="text-sm text-zinc-500">No profiles yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="pb-2">Name</th>
                <th className="pb-2">Alias</th>
                <th className="pb-2">Keystore</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((s) => (
                <tr key={s.id} className="border-t border-zinc-800">
                  <td className="py-2">{s.name}</td>
                  <td className="py-2 text-zinc-400">{s.key_alias}</td>
                  <td className="py-2 text-xs text-zinc-500">{s.keystore_path}</td>
                  <td className="py-2 text-right">
                    <form action={deleteSigningProfile}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="btn-danger">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={saveSigningProfile} className="grid grid-cols-1 md:grid-cols-5 gap-3 border-t border-zinc-800 pt-3">
          <div className="field">
            <label>Name</label>
            <input name="name" required placeholder="release-key" />
          </div>
          <div className="field">
            <label>Keystore file (.jks/.keystore)</label>
            <input type="file" name="keystore" required className="text-xs" />
          </div>
          <div className="field">
            <label>Key alias</label>
            <input name="key_alias" required placeholder="upload" />
          </div>
          <div className="field">
            <label>Store password</label>
            <input type="password" name="store_password" required />
          </div>
          <div className="field">
            <label>Key password (if different)</label>
            <input type="password" name="key_password" />
          </div>
          <div className="md:col-span-5">
            <button type="submit" className="btn-secondary">
              Add signing profile
            </button>
          </div>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold">Service accounts</h2>
        <p className="text-xs text-zinc-500">
          Google Play service account JSON (Play Console → Setup → API access) with release
          permission for upload. App Store Connect API key (p8) will be used for the iOS phase.
        </p>
        {accounts.length === 0 ? (
          <p className="text-sm text-zinc-500">No service accounts yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="pb-2">Name</th>
                <th className="pb-2">Kind</th>
                <th className="pb-2">Added</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t border-zinc-800">
                  <td className="py-2">{a.name}</td>
                  <td className="py-2 text-zinc-400">{a.kind}</td>
                  <td className="py-2 text-zinc-400">
                    {new Date(a.created_at + "Z").toLocaleDateString()}
                  </td>
                  <td className="py-2 text-right">
                    <form action={deleteServiceAccount}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="btn-danger">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={saveServiceAccount} className="space-y-3 border-t border-zinc-800 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="field">
              <label>Name</label>
              <input name="name" required placeholder="play-upload" />
            </div>
            <div className="field">
              <label>Kind</label>
              <select name="kind" defaultValue="play">
                <option value="play">Google Play</option>
                <option value="appstore">App Store Connect</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>JSON / key contents</label>
            <textarea
              name="json"
              required
              rows={5}
              placeholder='{"type": "service_account", ...}'
              className="font-mono text-xs"
            />
          </div>
          <button type="submit" className="btn-secondary">
            Add service account
          </button>
        </form>
      </section>
    </div>
  );
}
