# Start here

You have the **SriSah Schooling 1.1.0** release package: a violet-branded learning portal that
runs as a web app, an installable app and a native Android app for Google Play.

Read this page first. It tells you which document to open for what you want to do.

---

## What is in this package

```
SriSah-Schooling/
├── START-HERE.md            ← you are here
├── RELEASE-NOTES.md          what changed in this release
├── README.md                 project overview
├── .env.example              copy to .env and fill in — every setting is documented
├── docs/                     ⭐ eleven guides (start with docs/README.md)
│   ├── GETTING-STARTED.md        install → database → first sign-in
│   ├── APP-GUIDE.md              every screen, role by role
│   ├── THEME-GUIDE.md            the violet palette and how to change it
│   ├── BUILD-AND-TEST.md         every command, expected output, packaging
│   ├── WEB-DEPLOYMENT.md         Docker Compose, VPS, HTTPS, backups
│   ├── PLAY-STORE-DEPLOYMENT.md  keystore → App Bundle → Play Console
│   ├── ANDROID-TESTING.md        device checklists
│   ├── TROUBLESHOOTING.md        error → fix
│   └── OPERATIONS.md, API.md, FEATURE-TEST-PLAN.md
├── server/                   Node + Express API (also serves the web UI)
├── web/                      React portal + its production build in web/dist
│   └── dist/                 ⭐ prebuilt browser bundle — ready to serve
├── src/                      legacy design mock-up (not built; kept for reference)
├── db/                       PostgreSQL schema and migration runner
├── android/                  ⭐ native Android project (Capacitor)
│   └── app/src/main/assets/  prebuilt web assets already copied in
├── tools/                    icon generator + demo data seeder
├── docker/                   nginx TLS template + PostgreSQL role init script
├── .github/workflows/ci.yml  automated tests on every push
└── tests/                    unit, end-to-end, RLS and render tests
```

**No `node_modules` is included** (npm installs it in seconds and it is platform-specific).

---

## Do this first — run it on your computer (about 20 minutes)

Full detail: **[docs/GETTING-STARTED.md](docs/GETTING-STARTED.md)**

```sh
npm ci                      # 1. install dependencies
cp .env.example .env        # 2. then edit it (database URLs + bootstrap values)
#   Windows: powershell -ExecutionPolicy Bypass -File .\setup-srisah-db.ps1
#            creates the database and both roles for you
npm run migrate             # 3. create the schema
npm run bootstrap           # 4. create the school + first administrator
npm run dev                 # 5. start the API (:3001) and the portal (:5173)
```

Open <http://localhost:5173> and sign in with your `BOOTSTRAP_ADMIN_EMAIL` and
`BOOTSTRAP_ADMIN_PASSWORD`.

The database is intentionally **empty** — no demo students ship with the product. To fill a
development instance with realistic data for a demo or screenshots:

```sh
node tools/seed-demo.mjs --url http://127.0.0.1:3001 \
  --email your-admin@email --password 'YourAdminPassword1' --yes
```

---

## Put the web app online

**[docs/WEB-DEPLOYMENT.md](docs/WEB-DEPLOYMENT.md)** — Docker Compose (recommended), or a
plain VPS with systemd + nginx. You need a domain, HTTPS and a PostgreSQL database.

Minimum viable deployment:

```sh
cp .env.example .env        # production values: HTTPS origin, strong secrets, Resend key
docker compose up -d db
docker compose --profile ops run --rm migrate
docker compose --profile ops run --rm bootstrap
docker compose up -d app
curl -s https://your-host/api/health      # {"ok":true,"database":"ok"}
```

---

## Publish the Android app to Google Play

**[docs/PLAY-STORE-DEPLOYMENT.md](docs/PLAY-STORE-DEPLOYMENT.md)** — the complete walkthrough,
including the store listing copy, the data-safety answers and the two things that catch people
out: the **12-testers / 14-day closed test** for new personal developer accounts, and the
**minimum-functionality policy** for WebView apps.

```sh
echo 'SRISAH_APP_URL=https://your-school.example.com' >> .env
npm run android:configure                          # point the app at your HTTPS portal
keytool -genkeypair -v -keystore ~/srisah-release.keystore -alias srisah \
  -keyalg RSA -keysize 4096 -validity 10000
cp android/keystore.properties.example android/keystore.properties   # then edit it
SRISAH_VERSION_CODE=1 SRISAH_VERSION_NAME=1.0.0 npm run android:release
# → android/app/build/outputs/bundle/release/app-release.aab   ← upload this to Play
```

To build the App Bundle you need **JDK 21** and the **Android SDK with API 36** installed
(see [docs/BUILD-AND-TEST.md §4.1](docs/BUILD-AND-TEST.md#41-one-time-prerequisites)).

---

## Verify everything yourself

```sh
npm run verify       # unit tests + browser render test + production build
npm test             # adds the end-to-end and RLS suites when DATABASE_URL is set
```

Recorded results for this release:

| Check | Result |
|---|---|
| `npm run test:unit` | 3 / 3 pass |
| `npm run test:e2e` (needs a database) | 17 / 17 pass — 16 scenarios across all four roles |
| `npm run test:integration` (row-level security) | pass (use a real PostgreSQL; the WASM test engine is occasionally flaky) |
| `npm run test:render` | pass — the compiled UI mounts with zero runtime errors and the violet theme |
| `npm run build` | ✅ `web/dist` — 108 kB CSS / 244 kB JS (23 kB / 70 kB gzipped) |
| `npm run android:sync` | ✅ assets copied, both Capacitor plugins registered |

---

## Change the colour, logo or name

* **Colour** — the whole product is themed from seven variables at the top of
  `web/src/styles.css` (`--violet`, `--purple`, `--canvas`, …). Change them,
  `npm run build`, done. Details and contrast ratios:
  [docs/THEME-GUIDE.md](docs/THEME-GUIDE.md).
* **Icon and splash screens** — edit `tools/make-icons.py`, then `npm run icons`
  (about 7 minutes; `ONLY=foreground|splash|web` speeds up iteration).
* **App name** — `web/public/manifest.webmanifest` (web) and
  `android/app/src/main/res/values/strings.xml` (Android).
* **Package name** — decide before publishing; it can never change afterwards
  ([Play guide §4](docs/PLAY-STORE-DEPLOYMENT.md#4-set-the-identity-values)).

---

## Safety notes

* `.env`, `android/keystore.properties`, `*.keystore` and `google-services.json` are
  git-ignored — **keep them that way**. The CI workflow fails if any of them is ever committed.
* Back up the Android upload keystore and its passwords. Losing them means the Play Console
  account has to reset the signing key.
* The application must connect to PostgreSQL as the restricted `srisah_app` role
  (`NOSUPERUSER`, `NOBYPASSRLS`, not the table owner). Connecting as the owner silently disables
  the row-level security that keeps families' records apart.
* This package contains **no student data**. Every learner record is created by your school
  after deployment.
