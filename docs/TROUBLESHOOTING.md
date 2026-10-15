# Troubleshooting

Find your error message, apply the fix. Grouped by where the problem appears.

---

## Startup and configuration

| Message / symptom | Cause | Fix |
|---|---|---|
| `DATABASE_URL is required.` | `.env` missing, or not in the repository root | `cp .env.example .env` next to `package.json` |
| `PUBLIC_ORIGIN is required.` | not set | set it to the origin users actually open, e.g. `http://localhost:5173` |
| `PUBLIC_ORIGIN must be a bare HTTP(S) origin without a path, credentials, query or fragment.` | you included a trailing slash or a path | `https://school.example.com` — no `/`, no `/app` |
| `Production PUBLIC_ORIGIN must use HTTPS.` | `NODE_ENV=production` with an `http://` origin | terminate TLS and use `https://`, or develop with `NODE_ENV=development` |
| `ALLOWED_ORIGINS must include PUBLIC_ORIGIN.` | the two lists disagree | make `ALLOWED_ORIGINS` contain `PUBLIC_ORIGIN` exactly |
| `Production email is required for verification, password recovery and invitations.` | production without email settings | set `RESEND_API_KEY` and `EMAIL_FROM` (or use `NODE_ENV=development` with `DEV_EMAIL_LOG=true`) |
| `PORT must be a valid TCP port.` | `PORT` is not a number 1–65535 | fix `.env` |
| `Missing required bootstrap settings: …` | you ran `npm run bootstrap` without the `BOOTSTRAP_*` values | fill them in, then re-run |
| `Bootstrap admin password: Use a password between 12 and 200 characters.` | weak bootstrap password | 12+ characters with upper, lower and a number |

## Database

| Message / symptom | Cause | Fix |
|---|---|---|
| `password authentication failed for user "srisah_app"` | wrong password, or special characters in the password were not percent-encoded | reset the role password; use URL-safe characters or percent-encode `@ : / ? #` |
| `role "srisah_app" does not exist` | the app role was never created | run `setup-srisah-db.ps1` (Windows) or the SQL in [Getting started §2](GETTING-STARTED.md#2-create-the-database-and-its-two-roles) |
| `database "srisah_schooling" does not exist` | database not created | create it, then `npm run migrate` |
| `permission denied for table students` | privileges granted before the role existed, or a managed database reset them | re-run `npm run migrate`; on managed hosts grant privileges as the owner |
| `permission denied for schema public` | PostgreSQL 15+ tightened default schema permissions | re-run `npm run migrate` (it grants `USAGE ON SCHEMA public`) |
| `connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running | `sudo systemctl start postgresql` / start the Windows service |
| `remaining connection slots are reserved` | too many pooled connections | lower `DB_POOL_SIZE`, or add a pooler (pgbouncer) |
| Integration test says *"DATABASE_URL must use a non-owner, non-superuser app role"* | you pointed it at the owner/superuser | use `srisah_app` for `DATABASE_URL` — that check is protecting you from a false pass |

### "Is my RLS actually enforced?"

```sql
SELECT current_user,
       r.rolsuper,
       r.rolbypassrls,
       (SELECT pg_get_userbyid(c.relowner) FROM pg_class c WHERE c.oid='public.students'::regclass) AS students_owner
FROM pg_roles r WHERE r.rolname = current_user;
```

You want `rolsuper = false`, `rolbypassrls = false`, and `students_owner` **different** from
`current_user`. Anything else and row-level security is not protecting families.

## Sign-in and accounts

| Message / symptom | Cause | Fix |
|---|---|---|
| `Email or password is incorrect.` | wrong credentials, **or** the account is not `active` | check the account status in `users`; a pending account cannot sign in |
| `Verify your email before signing in.` | account still pending | open the verification link; in development it is printed in the API console when `DEV_EMAIL_LOG=true` |
| `Check your organization name and family enrollment code.` | wrong slug or enrollment code | the slug is `BOOTSTRAP_ORG_SLUG`; the code is `BOOTSTRAP_JOIN_CODE` (it is **hashed**, so it cannot be read back from the database — reset it by re-running bootstrap) |
| `An account with that email already exists.` | duplicate email | sign in instead, or use another address. Emails are unique across the whole installation |
| `This verification link is invalid or expired.` | older than two hours, or already used | request a new one |
| `Too many requests. Please wait and try again.` | rate limit (logins: 12 per 15 min per IP) | wait, or raise the limits in `server/app.js` after a security review |
| `Request origin is not permitted.` | the browser origin is not in `ALLOWED_ORIGINS` | add the exact origin (scheme + host + port) |
| `Security token is missing or invalid.` | the CSRF cookie is blocked or stale | hard-refresh; if you use a proxy, make sure it forwards cookies and `Set-Cookie` unchanged |
| Signed in, but every page errors | API down or unreachable | `curl http://localhost:3001/api/health`; check `npm run dev` started both processes |
| Signed out unexpectedly | session expired (12 h) or was revoked by a password reset | sign in again |

## Portal behaviour

| Symptom | Cause | Fix |
|---|---|---|
| "No students yet" after signing in as a teacher | you are not assigned to any learner | ask an admin to assign you (Admin → Students → Assign a teacher) |
| A parent cannot see their child | the guardian link is missing | parent created the child themselves (link is automatic) or an admin must link them (Students → Link a verified parent) |
| A student cannot submit homework | the account is not linked to a profile, or the role is wrong | verify `students.linked_user_id` and that the user's role is `student` |
| `Choose Mathematics, Science or English.` | subjects are a fixed list of three | use exactly those values (extend `SUBJECTS` in `server/app.js` and `web/src/App.jsx` to change the list) |
| `Class link must use HTTPS.` | `http://` meeting link | use `https://` |
| `Learning materials must use HTTPS.` | `http://` resource URL | use `https://` |
| `Score must be between zero and the maximum score.` | score greater than maximum | check the entry |
| `Choose a valid upcoming class time.` | the start time is in the past | pick a future time |
| `Class duration must be 10–240 minutes.` | out-of-range duration | fix it |
| Invoice shows `450000` instead of `₹4,500` | amounts are stored in **minor units** | enter 450000 for ₹4,500.00; the UI formats it using the ISO currency |
| Amount appears as `"450000"` (a string) with an old API build | bigint serialisation before the fix in `server/db.js` | update to the current code |

## Build and tooling

| Message / symptom | Cause | Fix |
|---|---|---|
| `npm ci` fails | lockfile out of sync | `npm install`, commit `package-lock.json` |
| `vite: not found` | dependencies not installed | `npm ci` |
| Build succeeds but the portal is blank | served without the SPA fallback | make the server/host rewrite unknown paths to `index.html` |
| Old design still visible after deploy | the service worker cached the shell | the shell cache is versioned (`srisah-shell-v2`); hard-refresh, or bump `SHELL_CACHE` in `web/public/sw.js` |
| Icons look like the old green book | icons not regenerated | `npm run icons`, then `npm run android:sync` |
| `python3: not found` on `npm run icons` | Python missing | only needed for branding; install Python 3 |
| `test:render` fails with "the legacy forest-green brand colour is gone" | a green value was reintroduced | search the stylesheet for `#173d32` and replace it with a violet token |

## Android

| Message / symptom | Cause | Fix |
|---|---|---|
| App opens on the sign-in screen but nothing loads | built in **bundled** mode (no `SRISAH_APP_URL`) | set `SRISAH_APP_URL=https://your-school.example.com`, `npm run android:configure && npm run android:release` |
| App shows a blank white screen | the server origin is wrong/unreachable, or TLS is invalid | open the same URL in Chrome on the device |
| `Could not find the Android SDK` | `ANDROID_HOME`/`local.properties` missing | see [BUILD-AND-TEST §4.1](BUILD-AND-TEST.md#41-one-time-prerequisites) |
| `Unsupported class file major version 6x` | wrong JDK | install JDK 21 and select it |
| Gradle cannot download | firewall blocks `dl.google.com` / `repo1.maven.org` | allow those hosts, or build on a machine that can |
| Bundle rejected: "unsigned" | `android/keystore.properties` missing | create it, or export the `SRISAH_KEY*` variables |
| Bundle rejected by Play: version code | you re-uploaded the same `versionCode` | raise `SRISAH_VERSION_CODE` |
| Splash screen still shows the stock image | assets not synced | `npm run android:sync` before building |
| Play reviewer cannot sign in | no test account supplied | fill in the **App access** form with working credentials |

## Email

| Symptom | Cause | Fix |
|---|---|---|
| No email arrives in production | sender domain not verified, or a bad key | verify the domain (SPF/DKIM) in Resend and check the dashboard for bounces |
| No email arrives in development | by design | set `DEV_EMAIL_LOG=true` and read the link from the API console output |
| `Email provider rejected the request (401/403).` | invalid `RESEND_API_KEY` | re-issue the key |
| `Email provider rejected the request (422).` | `EMAIL_FROM` is not a verified sender | use an address on a verified domain |

Still stuck? Capture the failing request id from the API log, the exact message, and the
timestamp, then check [Operations](OPERATIONS.md) before changing anything in production.
