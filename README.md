# SriSah Schooling

A unified learning and wellbeing product: The Throne of Wisdom public site and journal at `/` and `/articles`, plus the authenticated SriSah Schooling portal at `/portal`. One React application, one Express API and one organization-scoped PostgreSQL database power the public contact workflow, portal and installable/native app surfaces.

* **Violet/purple brand** throughout the portal, the installable app, the launcher icon and the
  Android splash screen.
* Public marketing site, published journal and persisted contact inbox, integrated with the React portal and Node/Express API.
* PostgreSQL row-level security keeps school and public-website records organization-scoped.
* Account email flows, HTTP-only sessions, CSRF protection, origin allow-listing, rate limits,
  security headers and audit events.
* End-to-end automated tests covering every role, plus row-level-security isolation tests and a
  browser render test.

**This project starts with an empty school database. It does not ship student demo records.**
A school administrator creates real profiles and invitations after deployment. Public contact messages are stored in the organization's admin inbox; there is no automatic contact-email notification unless you add one.

---

## Documentation

| Guide | What it covers |
|---|---|
| [Documentation index](docs/README.md) | one-page map of everything below |
| [Integration notes](docs/integration/INTEGRATION-NOTES.md) | public-site / portal boundaries, routes and integration choices |
| [Complete guide](docs/COMPLETE-GUIDE.md) | setup, logins for every role, daily workflow, tests and deployment |
| [Getting started](docs/GETTING-STARTED.md) | install, database roles, first sign-in, first 15 minutes |
| [App guide](docs/APP-GUIDE.md) | every screen and action, role by role |
| [Theme guide](docs/THEME-GUIDE.md) | the violet palette, how to change it, icons and splash screens |
| [Build & test](docs/BUILD-AND-TEST.md) | every command, what good output looks like, packaging |
| [Web deployment](docs/WEB-DEPLOYMENT.md) | Docker Compose, VPS + nginx, managed platforms, backups |
| [Play Store deployment](docs/PLAY-STORE-DEPLOYMENT.md) | keystore, App Bundle, store listing, data safety, review risks |
| [Android testing](docs/ANDROID-TESTING.md) | device checklists for the native app and the PWA |
| [Operations](docs/OPERATIONS.md) | onboarding, access reviews, backups, upgrades |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | error message → fix |
| [API reference](docs/API.md) | HTTP endpoints and payloads |
| [Feature test plan](docs/FEATURE-TEST-PLAN.md) | release acceptance checklist |

---

## What is included

**Public site** — responsive The Throne of Wisdom homepage, mindful-learning and wellbeing information, a live published-article journal, a working contact form saved to the organization inbox, and clear links into the secure portal. The public article editor is available to organization admins inside the portal.

**Parent portal** — linked-child profiles, dashboard, homework, tests, attendance, progress,
teacher updates, secure messages, class schedule and an invoice ledger.

**Student portal** — the linked student's own learning records, classes, materials,
assignments, text submissions, returned work, progress and messages.

**Teacher portal** — an assigned-student roster, classes, homework and feedback, assessment
results, attendance, learning updates, practice plans, messages and resources.

**Admin workflows** — create student profiles; invite teachers and student accounts; resend
pending invitations; assign teachers by subject; link another verified parent to a student;
schedule classes; create invoice ledger entries; triage admissions and public-contact enquiries; create, edit, publish and delete public journal articles with audit events.

**Security** — PostgreSQL row-level security plus API role checks. Students see only their own
linked record; parents see only linked children; teachers see only explicitly assigned
learners; admins see records in their organization. Sessions are HTTP-only, `SameSite=Lax`
and `Secure` in production; every mutation also requires a CSRF token and an allow-listed
origin.

**Three delivery surfaces**

| Surface | Where | How |
|---|---|---|
| Web portal | `web/dist` served by the Node server | `npm run build` |
| Installable app (PWA) | same build + `web/public/manifest.webmanifest` + service worker | install from Chrome over HTTPS |
| Native Android app | `android/` (Capacitor) | `npm run android:release` → App Bundle for Play |

---

## Requirements

* Node.js 22 or later (required by the locked Capacitor CLI toolchain)
* PostgreSQL 16 (the migration uses PostgreSQL 15+ column-specific `SET NULL` constraints)
* A verified Resend sender/API key for production account emails
* HTTPS and a TLS reverse proxy for any public deployment
* JDK 21 + Android SDK API 36 — only if you build the Android app

---

## Quick start

```sh
cp .env.example .env        # then fill in the database URLs, origins and bootstrap values
npm ci
npm run migrate             # create the schema
npm run bootstrap           # create the first organization + administrator (once)
npm run dev                 # API on :3001; public site at /, portal at /portal
```

Open <http://localhost:5173> for the public site. Sign in at <http://localhost:5173/portal> with your `BOOTSTRAP_ADMIN_EMAIL` and
`BOOTSTRAP_ADMIN_PASSWORD`. The public-site inbox and journal use `PUBLIC_SITE_ORG_SLUG` (defaults to `srisah`); make it match the bootstrapped organization slug. Detailed setup, including the two database roles:
[Getting started](docs/GETTING-STARTED.md).

---

## Production deployment (Docker Compose)

```sh
cp .env.example .env        # production values; see docs/WEB-DEPLOYMENT.md
docker compose up -d db
docker compose --profile ops run --rm migrate
docker compose --profile ops run --rm bootstrap
docker compose up -d app
curl -s https://your-host/api/health     # {"ok":true,"database":"ok"}
```

Put the app behind TLS with `docker/nginx/srisah.conf` as the template. The app port binds to
`127.0.0.1` by default and the PostgreSQL port is never published. Full walkthrough:
[Web deployment](docs/WEB-DEPLOYMENT.md).

---

## Android app

```sh
echo 'SRISAH_APP_URL=https://your-school.example.com' >> .env
npm run android:configure            # point the app at your HTTPS portal
SRISAH_VERSION_CODE=1 SRISAH_VERSION_NAME=1.0.0 npm run android:release
# → android/app/build/outputs/bundle/release/app-release.aab
```

Press-ready assets are already generated: violet launcher icons at five densities, adaptive
icon, twelve splash screens, a violet status bar and a locked-down `AndroidManifest.xml`
(cleartext HTTP blocked, backups disabled, `INTERNET` as the only permission). Publishing
instructions, store listing copy and review-risk guidance:
[Play Store deployment](docs/PLAY-STORE-DEPLOYMENT.md).

---

## Tests and build

```sh
npm test                # unit + end-to-end (DB tests skip without DATABASE_URL)
npm run test:render     # compiles and renders the real UI in jsdom
npm run verify          # unit + render + production build — the pre-push gate
npm run build           # production web assets in web/dist
```

| Suite | What it proves |
|---|---|
| `test:unit` | password policy, scrypt hashing, email normalisation, token hashing |
| `test:e2e` | 18 end-to-end HTTP scenarios across all four roles, public contact capture and journal publishing; RLS assertions require a real restricted PostgreSQL role |
| `test:integration` | PostgreSQL row-level security isolates each family and teacher |
| `test:render` | public homepage, journal dialog and portal sign-in render in jsdom with mocked API responses; no runtime errors or external font dependency |

The database-backed suites run only against a non-owner, non-superuser, `NOBYPASSRLS` role —
the same requirement as production — and they say so rather than reporting a false pass.

---

## Theme

The brand lives in seven custom properties at the top of `web/src/styles.css`:

```css
--violet: #3c1f7a;   --violet-dark: #2a1455;   --violet-soft: #53309c;
--purple: #6d3fd1;   --purple-bright: #c9a7ff; --purple-pale: #f1eafd;
--canvas: #f7f5fc;
```

Change those, run `npm run build` (and `npm run android:sync`), and the whole product —
including the Android app — re-skins. Details, contrast ratios and icon regeneration:
[Theme guide](docs/THEME-GUIDE.md).

---

## Important scope limits

* Invoice entries are a **ledger only**. Card collection, refunds, reconciliation and
  payment-provider webhooks are not implemented.
* Homework supports **text** submissions. Secure file upload/storage and virus scanning must be
  designed and tested before enabling attachments.
* Email links use Resend in production. Configure verified sender/domain records and monitor
  provider delivery.
* The Android app is a secure client for your hosted portal. It does not store school records
  on the device, and it does not work offline beyond the application shell.
* Organization admins are responsible for account onboarding, parent-child links, teacher
  assignments, legal consent, data retention and access reviews.

## Security reporting

Do not report real student data in a public issue. Send security concerns privately to the
school/service operator and rotate any exposed credentials immediately.

## License

See [LICENSE](LICENSE).
