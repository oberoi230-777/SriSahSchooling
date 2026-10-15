# SriSah: complete setup, account and operating guide

This is the shortest end-to-end route from a fresh checkout to working **public site + journal** and **admin, parent, student and teacher portal accounts**. The database starts empty; no real students or credentials are bundled. Use a disposable database and fictitious data for practice. Detailed references: [Getting started](GETTING-STARTED.md), [App guide](APP-GUIDE.md), [API](API.md), [Web deployment](WEB-DEPLOYMENT.md), [Operations](OPERATIONS.md).

## 1. Architecture and prerequisites

The public site (`/`, `/articles`) and authenticated portal (`/portal`) are lazy-loaded React experiences in `web/src/`. Vite serves them in development on `:5173`; Express (`server/`) serves the production build and `/api` on `:3001` from the same origin. Public contact enquiries and articles share the organization's PostgreSQL data boundary, while the admin portal manages the inbox and journal. Browser sessions use HTTP-only cookies plus CSRF and origin checks. The database **must** use separate owner/migration and restricted runtime logins: the runtime role must not own tables or have `SUPERUSER`/`BYPASSRLS`. Node 22+ and npm are required. Production needs HTTPS and a verified Resend sender for account email.

## 2. Install and configure locally

```sh
npm ci
cp .env.example .env
```

Create PostgreSQL roles/database as the cluster administrator (substitute *different*, strong URL-safe passwords):

```sql
CREATE ROLE srisah_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'owner-secret';
CREATE DATABASE srisah_schooling OWNER srisah_migrator;
CREATE ROLE srisah_app LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT PASSWORD 'app-secret';
GRANT CONNECT ON DATABASE srisah_schooling TO srisah_app;
```

On Linux, `sudo -u postgres psql` opens the SQL prompt. On Windows, use `setup-srisah-db.ps1` from [Getting started](GETTING-STARTED.md). PostgreSQL supplies `gen_random_uuid()` without an extension.

Edit `.env`:

```dotenv
NODE_ENV=development
PORT=3001
PUBLIC_ORIGIN=http://localhost:5173
PUBLIC_SITE_ORG_SLUG=my-school
ALLOWED_ORIGINS=http://localhost:5173
DATABASE_URL=postgres://srisah_app:app-secret@127.0.0.1:5432/srisah_schooling
MIGRATION_DATABASE_URL=postgres://srisah_migrator:owner-secret@127.0.0.1:5432/srisah_schooling
DEV_EMAIL_LOG=true
BOOTSTRAP_ORG_NAME=My School
BOOTSTRAP_ORG_SLUG=my-school
BOOTSTRAP_JOIN_CODE=private-family-code-change-me
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_NAME=School Administrator
BOOTSTRAP_ADMIN_PASSWORD=ChooseALongSecret123
```

Do not use these example secrets. URL-encode special characters in DB passwords. Never commit `.env`. `BOOTSTRAP_ORG_SLUG` is the public school code shown in the family sign-up form; set `PUBLIC_SITE_ORG_SLUG` to the same slug so public enquiries and articles route correctly. `BOOTSTRAP_JOIN_CODE` is a *different, private* family enrollment code. Distribute it only to verified families. The admin password needs 12–200 characters, uppercase, lowercase and a digit.

```sh
npm run migrate        # create tables and row-level security policies
npm run bootstrap      # create the first verified admin and school
npm run dev            # public site at /; portal sign-in at http://localhost:5173/portal
```

Check `http://localhost:3001/api/health` returns `{"ok":true,"database":"ok"}`. Browse the public site at `/`, then sign in at `/portal` using the bootstrap admin credentials. The API console prints one-time email links **only in development** with `DEV_EMAIL_LOG=true`; in production configure `RESEND_API_KEY` and verified `EMAIL_FROM`. Links expire after two hours. Keep them private.

## 3. Create logins: the order matters

**Admin:** `npm run bootstrap` creates the first admin, already email verified. Sign in with `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`. It is not a public registration route. Keep admin credentials out of client-side code; after bootstrap, remove bootstrap secrets from the running service environment. Running bootstrap again with the same slug updates the family code, not the existing admin password.

**Student profile first:** In the admin portal open **Students → Add student**. Enter first name, Grade/Year, country, curriculum and at least one supported subject (Mathematics, Science or English). A *profile* is not a login. If an admin creates this profile, it has no parent linked automatically.

**Parent login:** Give a verified family the school slug and private enrollment code through a separate secure channel. On the sign-in page they select **Join your family account**, enter full name, email, password, school slug and family code, then open the **verification email**. They can now sign in. If they create a *new* student profile themselves, they are linked as its primary guardian automatically. If the profile was created by an admin or another parent, admin must open **Students → Accounts & teaching assignments → Link a verified parent**, choose the student and enter the parent's *verified account email*. Until linked, that parent cannot see the existing learner. Do not create a duplicate profile to work around a missing link.

**Student login:** From a linked student's profile, a parent can choose **Invite this learner to the student portal**, entering the learner's email. Alternatively, admin uses **Students → Accounts & teaching assignments → Invite an account → Student**, chooses that existing profile, name and email. The student opens the **invitation link**, sets their own password and can sign in. Each profile can have only one linked student login; do not share the parent's credentials with a child. If a student already has a pending invitation, re-invite from the same profile (see note below). A child must be old enough and have school/guardian consent under your local policy.

**Teacher login:** Admin opens **Students → Accounts & teaching assignments → Invite an account → Teacher**, enters the teacher's name and email. Teacher opens invitation, sets password, then signs in. Admin then uses **Assign a teacher** on the same screen, choosing teacher, student and subject. Until assigned, the teacher has no learner roster. Remove assignments when responsibility changes. The admin can resend **pending teacher** invites from the teacher list; resend invalidates the previous link.

| Account | Who creates it | Activation | What it can access |
|---|---|---|---|
| Admin | Bootstrap job | Already verified | Its organization's records |
| Parent | Family self-registration + private code | Email verification | Only linked children |
| Student | Parent or admin invites an existing profile | Email invitation + new password | Only its linked profile |
| Teacher | Admin invitation | Email invitation + new password | Explicitly assigned learners |

**Lost links / passwords:** Pending parents use **Resend verification email** on the sign-in screen. Pending teachers can be resent by admin. Pending students can be re-invited from their profile with the **same email** by a linked parent or admin; the admin account-creation form does not resend existing student invitations. An active user uses **Forgot password?** with their account email; password reset invalidates old sessions. If an invitation is expired and the resend fails, check email delivery and the account's pending status with the operator. Do not create a second account with another email to bypass a link.

## 4. First day workflow

1. Admin creates learner profile(s), invites teacher, assigns learner + subject, links verified parent(s), and optionally invites student account(s).
2. Teacher signs in, confirms the assigned learner appears, schedules an HTTPS class, assigns homework, takes attendance, records tests and learning updates, and shares HTTPS materials.
3. Student signs in to submit **text** homework and read feedback. Once graded as *reviewed*, homework cannot be overwritten; teacher can request *needs revision* to permit resubmission.
4. Parent views each linked child's dashboard, attendance, homework, tests, progress, messages and invoice ledger. Guardian links and teacher assignments are **access controls**, not just labels.
5. Admin can add invoice ledger entries; triage family and public-contact messages under **Enquiries**; and create, edit, publish or delete public journal articles under **Website journal**. Contact messages are saved to the admin inbox; they do not trigger automatic email notifications. Invoice status is **not** a payment processor: no card charge or refund occurs.

For every screen, form and role permission, see [App guide](APP-GUIDE.md). For the endpoint payloads, see [API](API.md).

## 5. Test, build and deploy

```sh
npm run verify        # unit, render smoke and production web build
npm test              # unit + database-backed API and RLS tests
npm run build         # writes web/dist; npm start serves UI and /api together
```

**Important:** `npm test` *skips* API and RLS suites without `DATABASE_URL` and `MIGRATION_DATABASE_URL`. Run these with a **disposable, migrated PostgreSQL database** and separate owner/app roles before claiming isolation is tested. Do not run fixture tests against production. Inspect the TAP output for `# SKIP`; a zero exit code alone does not mean every suite ran. `npm run test:render` renders the real UI in jsdom, not an interactive browser or device test. Follow [Feature test plan](FEATURE-TEST-PLAN.md) and [Android testing](ANDROID-TESTING.md) for manual checks.

Production: set `NODE_ENV=production`, HTTPS `PUBLIC_ORIGIN` and matching `ALLOWED_ORIGINS`, verified Resend settings, secure cookies, database TLS where appropriate, and `TRUST_PROXY=true` only behind one trusted proxy hop. Build, migrate and bootstrap before starting the app; use [Web deployment](WEB-DEPLOYMENT.md) for Docker Compose or VPS instructions. Take encrypted backups and test restores; never expose the DB port publicly. Android requires a hosted HTTPS portal and Android toolchain; see [Play Store deployment](PLAY-STORE-DEPLOYMENT.md). The installable shell is not an offline data store. The PWA opens directly into `/portal`; offline caching contains only the public/portal shell and static assets, never API records.

## 6. Support and known boundaries

* No payments, attachment uploads, offline data sync, MFA or automated consent management. Obtain school privacy/legal approval before processing minors' records.
* Account email depends on the mail provider. If registration succeeds but delivery fails, the account may remain pending; use the matching resend path.
* The API's built-in rate limits are per process, not shared across replicas; add an external limit store or proxy rules before scaling out.
* If a page appears empty, first verify the login role, guardian/teacher assignment, selected student, `/api/health`, and whether the email was activated. See [Troubleshooting](TROUBLESHOOTING.md).
* No test suite proves there are zero bugs. Keep backups, monitor failures and re-test all four account types after changes.
