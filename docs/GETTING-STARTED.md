# Getting started — from a fresh clone to a signed-in portal

This guide takes you from "I just downloaded the project" to "I am signed in as the school
administrator with a working database". Follow it top to bottom. It takes about 20 minutes
the first time.

Two paths are covered:

* **Path A — Windows** (the project already ships `setup-srisah-windows.bat`, `.ps1` scripts)
* **Path B — macOS / Linux / WSL**

Everything else in the documentation assumes you completed this guide.

---

## 0. What you need

| Requirement | Why | Check with |
|---|---|---|
| Node.js **22 or newer** | runs the API, build, tests and locked Capacitor CLI toolchain | `node -v` |
| npm 10 or newer | installs dependencies | `npm -v` |
| PostgreSQL **16 or newer** | the database (row-level security needs 15+) | `psql --version` |
| Python 3 (optional) | only to regenerate the app icons | `python3 -V` |
| JDK 21 + Android SDK (optional) | only to build the Android app | `java -version` |

> No PostgreSQL? You can still start the API and see the sign-in screen, but nothing will
> load. For a zero-install database for testing, see
> [Build & test → Using PGlite](BUILD-AND-TEST.md#optional-a-postgresql-server-with-no-install).

---

## 1. Install the dependencies

```sh
npm ci
```

`npm ci` installs exactly the versions in `package-lock.json`. It takes 1–3 minutes.

---

## 2. Create the database and its two roles

SriSah deliberately uses **two** database connections:

| Role | Used by | Must be |
|---|---|---|
| `srisah_migrator` (owner) | `npm run migrate`, `npm run bootstrap` | owner of the tables |
| `srisah_app` (application) | the running API server | `NOSUPERUSER`, `NOBYPASSRLS`, **not** the table owner |

Why: PostgreSQL skips row-level security for a table's owner. If the API connected as the
owner, every family could theoretically read every other family's records. The restricted
role is what makes per-family isolation real.

### Path A — Windows (automated)

Open PowerShell **as Administrator** in the project folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-srisah-db.ps1
```

The script creates the database and both roles, then prints the two connection strings
you need in the next step. If PostgreSQL asks for a password, use the
one you chose when you installed PostgreSQL (the installer usually sets `postgres`).

If you already ran it and forgot the password, `reset-postgres-password.ps1` (and
`reset-postgres-password.bat`) can reset it.

### Path B — macOS / Linux / WSL

```sh
sudo -u postgres psql <<'SQL'
CREATE ROLE srisah_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'migration-secret-CHANGE-ME';
CREATE DATABASE srisah_schooling OWNER srisah_migrator;
CREATE ROLE srisah_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'app-secret-CHANGE-ME';
GRANT CONNECT ON DATABASE srisah_schooling TO srisah_app;
SQL

```

Use **URL-safe** passwords (letters, digits, `-`, `_`) or percent-encode reserved
characters such as `@`, `:` and `/`.

---

## 3. Create your `.env`

```sh
cp .env.example .env      # Windows: copy .env.example .env
```

Open `.env` and set, at minimum:

```dotenv
MIGRATION_DATABASE_URL=postgres://srisah_migrator:migration-secret-CHANGE-ME@127.0.0.1:5432/srisah_schooling
DATABASE_URL=postgres://srisah_app:app-secret-CHANGE-ME@127.0.0.1:5432/srisah_schooling
PUBLIC_ORIGIN=http://localhost:5173
PUBLIC_SITE_ORG_SLUG=srisah
ALLOWED_ORIGINS=http://localhost:5173
DEV_EMAIL_LOG=true

BOOTSTRAP_ORG_NAME=SriSah Schooling
BOOTSTRAP_ORG_SLUG=srisah
BOOTSTRAP_JOIN_CODE=choose-a-private-family-enrollment-code
BOOTSTRAP_ADMIN_EMAIL=admin@yourdomain.com
BOOTSTRAP_ADMIN_NAME=School Administrator
BOOTSTRAP_ADMIN_PASSWORD=ChooseAStrongPassword1
```

* `BOOTSTRAP_ADMIN_PASSWORD` must be **12+ characters** with an uppercase letter, a
  lowercase letter and a number. The bootstrap refuses weak values.
* `BOOTSTRAP_JOIN_CODE` is the code you give to verified families so they can self-register.
  Treat it like a password.
* `.env` is git-ignored. Never commit it.

---

## 4. Create the schema

```sh
npm run migrate
```

Expected output:

```
applied 001_core.sql
```

The migration is idempotent — running it again prints `skip 001_core.sql`. Migrations are
recorded in the `schema_migrations` table.

---

## 5. Create your organization and administrator (once)

```sh
npm run bootstrap
```

Expected output:

```
Created organization srisah and verified admin admin@yourdomain.com.
Store the organization join code securely and remove bootstrap secrets from the runtime environment.
```

Keep the join code and admin password in a password manager.

---

## 6. Start the app

```sh
npm run dev
```

You will see two processes:

```
[dev:api] SriSah Schooling listening on 0.0.0.0:3001
[dev:web] VITE v6.4.3  ready in 400 ms   ➜  Local: http://localhost:5173/
```

Open **<http://localhost:5173>** for The Throne of Wisdom public site. Open **<http://localhost:5173/portal>** and sign in with your `BOOTSTRAP_ADMIN_EMAIL` and
`BOOTSTRAP_ADMIN_PASSWORD`. You should land on the **Admin dashboard** with the violet
SriSah sidebar, and the pages will be empty because the database intentionally contains no
student records.

### Verify the API directly

```sh
curl -s http://localhost:3001/api/health
# {"ok":true,"database":"ok"}
```

---

## 7. Your first fifteen minutes as administrator

Do these in order; each one unlocks the next.

1. **Create a student.** *Students → Add student.* First name, grade, country, curriculum and
   at least one subject are required. Subjects are limited to Mathematics, Science and English.
2. **Invite a teacher.** *Students → Accounts & teaching assignments → Invite an account*: give the name
   and email. In development, the activation link is printed in the `dev:api` console
   instead of being emailed — copy it.
3. **Open the link in a private window**, choose a password, and you are signed in as that
   teacher.
4. **Assign the teacher to the student.** *Students → Accounts & teaching assignments → Assign a teacher.* Pick the teacher,
   the student and the subject. A teacher sees **only** learners explicitly assigned to them.
5. **Invite the student.** From the student profile, invite the student's own email address;
   the same console-log trick gives you the activation link.
6. **Create a class, homework and a test result** as the teacher (or as admin) so the parent
   and student portals have something to show.
7. **Register a parent.** Sign out, choose *Create a family account*, and enter the
   organization code (`BOOTSTRAP_ORG_SLUG`, i.e. `srisah`) and the family enrollment code
   (`BOOTSTRAP_JOIN_CODE`). Verify the link from the API console. The parent then creates the
   child profile, or an administrator links the parent to an existing child from *Students*.

---

## 8. Every day after that

```sh
npm run dev        # start API + portal
npm test           # run the automated tests before you push a change
npm run build      # produce the production web assets in web/dist
```

* Changed a database migration? Re-run `npm run migrate`.
* Changed the React code? `npm run dev` hot-reloads automatically.
* Need the Android app? Continue with
  [Build & test](BUILD-AND-TEST.md#android-builds) and then
  [Play Store deployment](PLAY-STORE-DEPLOYMENT.md).

---

## Common first-run problems

| Symptom | Cause | Fix |
|---|---|---|
| `DATABASE_URL is required.` | `.env` missing or in the wrong folder | create `.env` in the repository root (next to `package.json`) |
| `password authentication failed for user "srisah_app"` | wrong password, or the role was created with a special character that was not percent-encoded | reset the role password, use URL-safe characters |
| `permission denied for schema public` | the migration granted privileges before the role existed, or a managed database reset grants | re-run `npm run migrate`; on managed databases ask your provider to grant the role |
| `Production email is required…` | `NODE_ENV=production` without Resend settings | set `RESEND_API_KEY` and `EMAIL_FROM`, or develop with `NODE_ENV=development` |
| Account is pending / cannot sign in | email has not been activated | parents use their verification link; invited teachers/students use their invitation link to set a password (`DEV_EMAIL_LOG=true` prints links locally) |
| Portal loads but every page shows an error | the API is not running, or the Vite proxy target is wrong | check `npm run dev` shows both processes; the API must be on port 3001 |

More: [Troubleshooting](TROUBLESHOOTING.md).
