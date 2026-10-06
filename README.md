# Mobile Release Dashboard

Self-hosted control panel that automates the weekly release cycle for your mobile projects:
**bump version → commit & push → build → sign → upload to Google Play**.

Supports **Android Native (Kotlin/Gradle)** and **Flutter (Android)**. iOS/TestFlight is on the roadmap via GitHub Actions macOS runners (the dashboard triggers and monitors the workflow).

## Architecture

One repo, two services, one shared SQLite volume — deploys as a `docker-compose` stack on Dokploy.

```
┌────────────┐        ┌─────────────────────────────────────────┐
│    web     │        │                worker                    │
│  Next.js   │  HTTP  │  scheduler (cron)  ── enqueue due runs   │
│  dashboard │───────▶│  executor (serial) ── git → bump →       │
│  :3000     │ SQLite │      build → sign → fastlane supply      │
└────────────┘        └─────────────────────────────────────────┘
        └── shared volume /data (db, logs, workspaces, keystores, gradle cache)
```

- **web** — Next.js dashboard: project registry, signing profiles, secrets, run history with live logs, manual "Run now".
- **worker** — same codebase (`src/worker`), heavyweight image with JDK 17 + Android SDK + Flutter + fastlane. Polls the run queue every 15s, **concurrency 1** (small VPS friendly), writes per-run logs.

## The pipeline

Each run executes these stages (visible per-run on the dashboard):

| Stage | What happens |
|---|---|
| `prepare` | Clone (or fetch + hard reset) the repo into `data/workspaces/<id>` |
| `bump` | `versionCode` +1 and `versionName` per scheme in `app/build.gradle[.kts]` — or `version: x.y.z+build` in `pubspec.yaml` for Flutter |
| `commit_push` | `chore(release): bump vX.Y.Z (N)` → push via GitHub PAT |
| `build` | `./gradlew bundleRelease` (configurable task) or `flutter pub get` + `flutter build appbundle` — signing injected via a Gradle init script, **no repo changes needed** |
| `upload` | `fastlane supply` → chosen Play track with your service account |

The recorded artifact is always the final `build/**/outputs/**` bundle — intermediate files like `intermediary-bundle.aab` are unsigned and skipped. `versionName` only bumps when it matches `x.y.z` (a non-semver name like `1.0` is left untouched while `versionCode`/build number still increments).

### Signing without touching your repo

The worker writes `$GRADLE_USER_HOME/init.d/mrd-signing.gradle` for the duration of a build, which force-sets `buildTypes.release.signingConfig` from your keystore (kept in `data/keystores`, encrypted credentials in the DB). Keystores and passwords never enter the repo or build logs.

## Quick start

### Docker (production / Dokploy)

```bash
cp .env.example .env   # set DASHBOARD_PASSWORD + DASHBOARD_MASTER_KEY
docker compose up -d --build
```

Then open `http://<host>:3000`. On Dokploy: create a **Compose** app pointing at this repo, add the env vars, done. Persist the `data` volume.

### Local dev

```bash
cp .env.example .env
export $(cat .env | xargs)
npm install
npm run dev            # dashboard on :3000
npm run worker         # separate terminal — needs JDK/Android SDK/Flutter for real builds
```

## Configuration

### Environment variables

| Var | Required | Purpose |
|---|---|---|
| `DASHBOARD_PASSWORD` | | Login password. Empty = auth disabled (dev only) |
| `DASHBOARD_MASTER_KEY` | ✓ | AES-256-GCM key for secrets at rest. Keep stable, losing it = losing secrets |
| `DATA_DIR` | | Default `./data` (docker: `/data`) |
| `TZ` | | Worker cron timezone, e.g. `Asia/Ho_Chi_Minh` |

### Secrets page (in-app)

1. **GitHub PAT** — `repo` scope, used for clone + push.
2. **Signing profiles** — upload `.jks/.keystore` + alias + passwords.
3. **Service accounts** — Google Play JSON key (Play Console → Setup → API access, grant release permission). The app must already exist on Play Console — first upload can't be automated.
4. **Telegram notifications** — bot token (from `@BotFather`) + chat id (from `@userinfobot` or `getUpdates`). Once configured, the worker messages you after every run — success or failure — with project, version bump, duration, and error. A "Send test message" button verifies the setup.

### Per-project fields

| Field | Notes |
|---|---|
| Type | `android-kotlin` or `flutter` |
| Version scheme | `patch` (x.y.z+1) · `minor` · `major` · `build-only` |
| Gradle file / task | Auto-detected (`app/build.gradle.kts`, `bundleRelease`) — override if non-standard |
| Signing profile | Optional — repo defaults used if unset |
| Release target | Play `internal`/`alpha`/`beta`/`production`, or `none` (build only) |
| Package name | `applicationId` — required for Play upload |
| Schedule | 5-field cron in worker `TZ`, e.g. `0 9 * * 1` = Mondays 09:00 |

## Roadmap

- **P1**: Android-Kotlin end-to-end + manual runs + logs ✓
- **P2 (this)**: Flutter Android (`pub get` + `appbundle`) + Telegram notifications + schedule pause/resume + human-readable cron + TZ-aware timestamps ✓
- **P3**: iOS → TestFlight via `workflow_dispatch` to a `macos-latest` GitHub Actions job in each app repo (App Store Connect API key already accepted on the secrets page)

## Security notes

- Secrets are AES-256-GCM encrypted at rest (`DASHBOARD_MASTER_KEY`), decrypted only into per-run temp files and wiped afterwards.
- The PAT is passed to git via `http.extraheader` per-invocation — never persisted to `.git/config`.
- Single-user auth by design; put it behind a private network (Tailscale) or a strong password + HTTPS.
