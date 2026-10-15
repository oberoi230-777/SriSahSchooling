# Build, test and package guide

Every command in this project, what it does, what "good" output looks like, and how to build
the shippable artefacts (public-site/portal web bundle, Android APK, Play Store App Bundle, release zip).

---

## 1. Command reference

| Command | What it does | Needs a database? |
|---|---|---|
| `npm ci` | installs exact locked dependencies | no |
| `npm run dev` | API on `:3001` + public site at `:5173/`, portal at `:5173/portal` (hot reload) | yes |
| `npm run dev:api` | API only | yes |
| `npm run dev:web` | public site + portal only | no |
| `npm run migrate` | applies `db/migrations/*.sql` (idempotent) | yes |
| `npm run bootstrap` | creates the first organization + verified admin (run once) | yes |
| `npm run build` | production browser assets → `web/dist` | no |
| `npm run preview` | serves `web/dist` on `:4173` (UI only, no API proxy) | no |
| `npm start` | production server: API + serves `web/dist` on `:3001` | yes |
| `npm test` | unit + end-to-end + RLS integration tests (DB tests self-skip) | optional |
| `npm run test:unit` | crypto/security unit tests | no |
| `npm run test:e2e` | 18 end-to-end HTTP scenarios for all four roles plus contact/article workflows | **yes** |
| `npm run test:integration` | PostgreSQL row-level-security isolation test | **yes** |
| `npm run test:render` | compiles and renders the public homepage, journal dialog and portal sign-in in jsdom | no |
| `npm run verify` | `test:unit` → `test:render` → `build` (the pre-push gate) | no |
| `npm run icons` | regenerates every PNG icon and splash screen | no |
| `npm run android:build:web` | builds the web bundle for the native app → `web/dist-android` | no |
| `npm run android:sync` | builds + copies assets and plugins into `android/` | no |
| `npm run android:apk` | debug APK for device testing | no |
| `npm run android:release` | **signed App Bundle (.aab) for Google Play** | no |
| `npm run android:open` | opens the project in Android Studio | no |
| `npm run android:configure` | points the native app at your hosted HTTPS origin | no |
| `npm run seed:demo` | fills a **development** instance with demonstration records (see below) | yes |

---

## 2. The web build

```sh
npm run build
```

Good output:

```
vite v6.4.3 building for production...
✓ 1680 modules transformed.
dist/index.html                     1.03 kB │ gzip:  0.48 kB
dist/assets/PublicSite-*.css        40.84 kB │ gzip:  9.67 kB
dist/assets/App-*.css              114.97 kB │ gzip: 23.89 kB
dist/assets/api-*.js                  6.84 kB │ gzip:  2.29 kB
dist/assets/PublicSite-*.js         28.96 kB │ gzip:  8.63 kB
dist/assets/App-*.js              102.42 kB │ gzip: 24.38 kB
dist/assets/index-*.js             154.50 kB │ gzip: 50.65 kB
dist/assets/HeroScene-*.js         488.41 kB │ gzip:123.53 kB
✓ built in 12s
```

Three things to know about the output:

* `web/dist/` is a **single-page app**. Any unknown path must fall back to `index.html`;
  the server already does this (`server/app.js`).
* Asset names are content-hashed, so they can be cached for a year. `index.html`, `sw.js` and
  `manifest.webmanifest` must **never** be cached — the service worker handles this for
  installs, and `docker/nginx/srisah.conf` shows the reverse-proxy headers.
* `npm run build` must be run before `npm start` in production; the server serves
  `web/dist`, not the source.

### Production smoke test

`npm start` serves the API **and** the compiled SPA from the same origin as soon as
`web/dist/index.html` exists, so this works with any `NODE_ENV`:

```sh
npm run build
PUBLIC_ORIGIN=http://127.0.0.1:3001 \
ALLOWED_ORIGINS=http://127.0.0.1:3001 \
DATABASE_URL=postgres://srisah_app:...@127.0.0.1:5432/srisah_schooling \
npm start

curl -s http://127.0.0.1:3001/api/health          # {"ok":true,"database":"ok"}
curl -s http://127.0.0.1:3001/ | head -5          # public-site HTML shell
curl -s http://127.0.0.1:3001/portal | head -5     # same SPA shell; React opens the portal
```

If `/` or `/portal` returns `Cannot GET`, the build is missing — run `npm run build`. Set
`NODE_ENV=production` only when you are serving over HTTPS: production forces `Secure`
cookies, which a browser will not send back over plain HTTP.

---

## 3. Testing

### 3.1 `npm run test:unit` — security primitives

Covers password policy, scrypt hashing/verification, email normalisation and token hashing.

```
# tests 3
# pass 3
# skipped 0
```

### 3.2 `npm run test:e2e` — the full role journey (needs a database)

`tests/api.e2e.test.js` starts the real Express app in-process and drives it over HTTP with
cookies, CSRF headers and an origin allow-list. It creates a throwaway organization, runs
**18 scenarios**, and deletes every fixture afterwards.

What it proves:

| # | Scenario |
|---|---|
| 1 | `/api/health` reports the database connection |
| 2 | security headers are present; unknown API paths return 401 |
| 3 | requests from a disallowed origin are rejected (403) |
| 4 | parent self-registration requires the family enrollment code and a strong password |
| 5 | email verification issues a session; a verification token cannot be reused |
| 6 | CSRF double-submit protection blocks mutations without the header |
| 7 | a parent creates a child profile; invalid grades are rejected |
| 8 | an admin invites teacher/student accounts; invitations activate with a password |
| 9 | an admin assigns a teacher to a learner |
| 10 | a teacher runs the full teaching cycle: class, homework, attendance, test, update, practice step, material, message — plus rejected HTTPS/score/duration inputs |
| 11 | a student sees only their own records, cannot schedule classes, submits homework |
| 12 | the teacher reviews the submission (`needs_revision`), the student resubmits, an unassigned teacher is refused |
| 13 | a parent reads the dashboard, report, conversation and invoice ledger; a parent cannot read the admissions inbox |
| 14 | dashboard totals include records beyond the recent-items limit |
| 15 | public admission and contact submissions validate and enter the admin inbox |
| 16 | public journal drafts stay private; admins can publish, edit and delete articles |
| 17 | password reset revokes existing sessions |
| 18 | logout clears the session |

Row-level-security assertions (teacher/student isolation) run **only when `DATABASE_URL` uses
a non-owner, non-superuser, `NOBYPASSRLS` role** — the production requirement. If your test
role bypasses RLS, the suite reports a diagnostic and skips just those assertions instead of
giving you a false pass.

```sh
DATABASE_URL=postgres://srisah_app:app@127.0.0.1:5432/srisah_test \
MIGRATION_DATABASE_URL=postgres://srisah_migrator:mig@127.0.0.1:5432/srisah_test \
npm run test:e2e
```

> Use a **disposable test database**. The suite writes and deletes real rows. Never point it
> at production.

### 3.3 `npm run test:integration` — row-level security

`tests/postgres.integration.test.js` builds two families, two teachers and two students, then
asserts that each principal sees exactly their own rows and nothing else. It refuses to run
against a superuser/owner connection, because that would report a false failure.

### 3.4 `npm run test:render` — the UI really renders

Compiles the public site and portal surfaces into a browser bundle and loads them in jsdom with stubbed API responses. It asserts the public hero, journal empty state and contact section; a published article's dialog, Escape behavior and focus restoration; the portal sign-in and return-to-site link; API loading; zero runtime errors; violet portal CSS; no legacy forest-green; and no external Google Fonts dependency. The Three.js module is replaced by a tiny test stub here; the production build verifies the real lazy-loaded scene.

Takes about 10 seconds in this workspace. It catches broken imports and render-time crashes, but is not an interactive browser or accessibility audit.

### 3.5 The pre-push gate

```sh
npm run verify      # unit tests + render test + production build
```

### 3.6 Optional: a PostgreSQL server with no install

If you cannot install PostgreSQL locally, `@electric-sql/pglite` runs a real PostgreSQL 18
engine (WebAssembly) that speaks the wire protocol, so `pg`, the migration and the API work
unchanged:

```sh
npm i --no-save --package-lock=false @electric-sql/pglite @electric-sql/pglite-socket
mkdir -p tmp
cat > tmp/pg.mjs <<'EOF'
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
const db = await PGlite.create({ dataDir: './tmp/.pglite' });
await db.exec('CREATE ROLE srisah_app LOGIN NOSUPERUSER NOBYPASSRLS;'); // first run only
const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55432, maxConnections: 20 });
await server.start();
console.log('postgres-compatible server on 127.0.0.1:55432');
EOF
node tmp/pg.mjs  # keep this terminal open
```

In another terminal run `MIGRATION_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres npm run migrate`,
then set `DATABASE_URL=postgres://srisah_app@127.0.0.1:55432/postgres` and
`MIGRATION_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres` for `npm run test:e2e`.
On subsequent runs, remove the `CREATE ROLE` line from `tmp/pg.mjs` (the database persists).

> **PGlite caveat.** The socket can accept multiple client connections but the embedded database runs under its own superuser context; using a `srisah_app` username in the URL does not create a restricted PostgreSQL session. Migrations and HTTP/business-flow tests can run, but the RLS-specific assertions are correctly **skipped**. Do not use PGlite as proof of isolation: run `npm run test:integration` with a real PostgreSQL server and distinct schema-owner / non-owner roles before production.

### 3.7 Optional: demonstration data for local testing

The application ships with an **empty** database on purpose. When you want a populated
screen for a demo, screenshots or a smoke test, use the seeder — it drives the real HTTP API
with an administrator session and therefore respects every validation rule:

```sh
node tools/seed-demo.mjs --url http://127.0.0.1:3001 \
  --email admin@yourdomain.com --password 'YourAdminPassword1' --yes
```

It creates two learners, a teacher with subject assignments, a class, homework, test results,
a learning update, a practice plan, a learning material, a message and an invoice ledger
entry. It refuses to run when `NODE_ENV=production` and requires `--yes`, so it cannot
accidentally pollute a live school.

---

## 4. Android builds

### 4.1 One-time prerequisites

| Tool | Version | Notes |
|---|---|---|
| JDK | **21** (Capacitor 8 / AGP 8.13) | `java -version` must report 21 |
| Android SDK Platform | **API 36** (Android 16) | required by Google Play since 31 Aug 2026 |
| Android SDK Build-Tools | 35.0.0+ | installed with the platform |
| `ANDROID_HOME` | path to the SDK | `echo $ANDROID_HOME` must print it |

Install the SDK pieces without Android Studio (Linux/macOS):

```sh
export ANDROID_HOME="$HOME/Android/Sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"
curl -o cmdline.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q cmdline.zip -d "$ANDROID_HOME/cmdline-tools" && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

Then create `android/local.properties`:

```properties
sdk.dir=/home/you/Android/Sdk
```

### 4.2 Point the app at your server (important)

A WebView app only gets working sessions, cookies and CSRF protection when it loads **your
own HTTPS origin**:

```dotenv
# .env
SRISAH_APP_URL=https://school.yourdomain.com
```

```sh
npm run android:configure     # writes server.url into capacitor.config.json
npm run android:sync          # builds the web assets and copies them in
```

Without `SRISAH_APP_URL` the app packages the bundled UI as an offline shell and opens on the
sign-in screen, but cannot load account data (no same-origin API). See
[Play Store deployment §2](PLAY-STORE-DEPLOYMENT.md#2-choose-the-packaging-mode) for the
trade-offs.

### 4.3 Debug APK for device testing

```sh
npm run android:apk
# → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The debug build carries the `.debug` application-ID suffix, so it installs alongside a Play
build without conflict.

### 4.4 Signed App Bundle for Google Play

```sh
# one time
keytool -genkeypair -v -keystore ~/srisah-release.keystore -alias srisah \
  -keyalg RSA -keysize 4096 -validity 10000
cp android/keystore.properties.example android/keystore.properties   # then edit it

# every release
SRISAH_VERSION_CODE=2 SRISAH_VERSION_NAME=1.1.0 npm run android:release
# → android/app/build/outputs/bundle/release/app-release.aab
```

Verify the bundle before uploading:

```sh
"$ANDROID_HOME/build-tools/36.0.0/aapt2" dump badging android/app/build/outputs/bundle/release/app-release.aab 2>/dev/null | head
# or, on the APK that bundletool generates for a device:
bundletool build-apks --bundle=app-release.aab --output=app.apks --ks=~/srisah-release.keystore --ks-key-alias=srisah
```

Full publishing walkthrough: [PLAY-STORE-DEPLOYMENT.md](PLAY-STORE-DEPLOYMENT.md).

### 4.5 What the Android build validates

`npm run android:sync` is the checkpoint that everything is wired correctly. Good output:

```
dist-android/assets/index-*.js  243.77 kB │ gzip: 69.96 kB
✔ Copying web assets from dist-android to android/app/src/main/assets/public
✔ Creating capacitor.config.json in android/app/src/main/assets
✔ Updating Android plugins
[info] Found 2 Capacitor plugins for android:
       @capacitor/splash-screen@8.0.2
       @capacitor/status-bar@8.0.2
✔ Sync finished
```

If a plugin is missing from that list, its native code is not in the APK.

---

## 5. Packaging the release zip

Create a distribution archive that contains the source, documentation and prebuilt web
assets — but never secrets or dependencies:

```sh
git archive --format=zip --prefix=SriSah-Schooling/ \
  -o SriSah-Schooling-1.0.0.zip HEAD
```

To include freshly built web assets that are not committed:

```sh
npm run build
rm -rf release && mkdir -p release/SriSah-Schooling
rsync -a --exclude node_modules --exclude .git --exclude '.env' --exclude 'android/.gradle' \
      --exclude 'android/app/build' ./ release/SriSah-Schooling/
(cd release && zip -qr ../SriSah-Schooling-1.0.0.zip SriSah-Schooling)
```

**Before sharing any zip, confirm it contains no `.env`, no `keystore.properties`, no
`*.keystore`, no `google-services.json` and no student data.** The repository `.gitignore`
already excludes all of these from Git; the check below proves it:

```sh
unzip -l SriSah-Schooling-1.0.0.zip | grep -Ei '\.env$|keystore|\.jks|google-services|node_modules' || echo "clean"
```

---

## 6. Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:

1. unit tests,
2. render smoke test,
3. production web build,
4. end-to-end tests against a **real PostgreSQL 16 service container** with the restricted
   `srisah_app` role, so row-level security is genuinely exercised.

---

## 7. Troubleshooting the build

| Symptom | Fix |
|---|---|
| `npm ci` fails on a lockfile mismatch | run `npm install` once, commit the updated `package-lock.json` |
| `vite: command not found` | dependencies missing — run `npm ci` |
| `sh: 1: python3: not found` on `npm run icons` | icons are only needed after a brand change; install Python 3 or skip |
| `Could not find the Android SDK` | set `ANDROID_HOME` **and** `android/local.properties` |
| `Unsupported class file major version` | you are on JDK 17; install and select JDK 21 |
| `Failed to install the following SDK components` | accept licences: `sdkmanager --licenses` |
| Gradle hangs on `Downloading https://repo1.maven.org/...` | the build machine cannot reach Maven Central; allow it through your firewall/proxy |
| `Execution failed for task ':app:lintVitalRelease'` | read the lint report in `android/app/build/reports/`; fix or add a targeted `lint { disable '...' }` with a comment |
| Bundle is unsigned | `android/keystore.properties` is missing or the env vars are unset; see §4.4 |

More: [Troubleshooting](TROUBLESHOOTING.md).
