# Web deployment guide

How to publish the unified The Throne of Wisdom public site and SriSah Schooling portal on one origin—using Docker Compose, a VPS with nginx, or a managed platform—plus HTTPS, backups, health checks and upgrades.

---

## 0. What you are deploying

SriSah is a **stateful Node application**, not a static site: it needs a long-running Node
process (sessions, CSRF, rate limits, email) and a PostgreSQL database. One origin serves
The Throne of Wisdom at `/` and `/articles`, the authenticated portal at `/portal`, and the
API under `/api`. Static-only hosts (GitHub Pages, plain S3) can serve the UI but cannot run
the API.

```
Browser ──HTTPS──► nginx/Caddy ──► Node app (:3001) ──► PostgreSQL
                    (TLS, HSTS)      server/            (row-level security)
```

---

## 1. Choose the deployment shape

| Option | Effort | Best for | Notes |
|---|---|---|---|
| **Docker Compose** (bundled) | ★ | a VPS, a school server, a workstation | one command; includes PostgreSQL, migrations and bootstrap jobs |
| Plain VPS + systemd + nginx | ★★ | full control, no Docker | use `docker/nginx/srisah.conf` as the proxy template |
| Managed container host (Fly.io, Render, Railway, Azure Container Apps) | ★★ | no server administration | you still need managed PostgreSQL; add your service as `DATABASE_URL` |
| Managed Postgres + managed Node (DigitalOcean App Platform, Heroku-style) | ★★ | teams that want managed everything | set the env vars from `.env.example` |
| Serverless functions | ★★★ | not recommended | the app keeps in-process rate-limit state and needs a persistent DB pool |

Whatever you choose, the **database must not be reachable from the internet**.

---

## 2. Before you deploy: a checklist

- [ ] A domain (or subdomain) that resolves to the server, e.g. `school.yourdomain.com`
- [ ] A TLS certificate — Let's Encrypt is free (`certbot`)
- [ ] Long, unique, URL-safe secrets for:
      `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `BOOTSTRAP_ADMIN_PASSWORD`,
      `BOOTSTRAP_JOIN_CODE`
- [ ] A verified Resend sender domain + API key (`RESEND_API_KEY`, `EMAIL_FROM`)
- [ ] Nightly database backups with a **tested** restore procedure
- [ ] A privacy policy page describing what the school collects and how to request deletion

---

## 3. Option A — Docker Compose (recommended)

The repository ships everything: PostgreSQL with the restricted app role, the migration job,
the bootstrap job and the app, plus a health check.

### 3.1 On the server

```sh
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
git clone https://github.com/oberoi230-777/SriSah.git srisah && cd srisah
cp .env.example .env
```

### 3.2 Edit `.env` for production

```dotenv
NODE_ENV=production
PORT=3001
PUBLIC_ORIGIN=https://school.yourdomain.com
PUBLIC_SITE_ORG_SLUG=srisah        # must match BOOTSTRAP_ORG_SLUG
ALLOWED_ORIGINS=https://school.yourdomain.com
COOKIE_SECURE=true
TRUST_PROXY=true                 # only if exactly one trusted proxy in front of the app

POSTGRES_DB=srisah_schooling
POSTGRES_USER=srisah_migrator
POSTGRES_PASSWORD=<48-random-chars>
APP_DB_PASSWORD=<48-different-random-chars>

RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=SriSah Schooling <no-reply@yourdomain.com>

BOOTSTRAP_ORG_NAME=SriSah Schooling
BOOTSTRAP_ORG_SLUG=srisah
BOOTSTRAP_JOIN_CODE=<private-random-code>
BOOTSTRAP_ADMIN_EMAIL=admin@yourdomain.com
BOOTSTRAP_ADMIN_NAME=School Administrator
BOOTSTRAP_ADMIN_PASSWORD=<12+ chars, upper+lower+number>

APP_BIND_ADDRESS=127.0.0.1      # do NOT publish the app port publicly; terminate TLS in nginx
APP_PORT=3001
```

### 3.3 Start it

```sh
docker compose up -d db
docker compose --profile ops run --rm migrate      # creates the schema + srisah_app role
docker compose --profile ops run --rm bootstrap    # creates the organization + admin (once)
docker compose up -d app
docker compose ps                                  # app should be "healthy"
```

### 3.4 Reverse proxy + TLS

```sh
sudo cp docker/nginx/srisah.conf /etc/nginx/sites-available/srisah.conf
sudo nano /etc/nginx/sites-available/srisah.conf        # set server_name + certificate paths
sudo ln -s /etc/nginx/sites-available/srisah.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d school.yourdomain.com
```

### 3.5 Verify

```sh
curl -s https://school.yourdomain.com/api/health
# {"ok":true,"database":"ok"}
```

Browse the public site at `https://school.yourdomain.com/`. Sign in at `/portal` with the bootstrap administrator, create a student, invite a teacher, and send yourself a real invitation email to confirm Resend delivery. Only then invite families. Public contact submissions appear in **Portal → Enquiries**; the current implementation does not send the organization an automatic notification, so assign an operator to check that inbox.

---

## 4. Option B — plain VPS (no Docker)

```sh
# Node 22 via nvm (or your distribution's package)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs

# PostgreSQL 16
sudo apt install -y postgresql-16
sudo -u postgres psql -c "CREATE ROLE srisah_migrator LOGIN PASSWORD '…' NOSUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE srisah_schooling OWNER srisah_migrator;"
sudo -u postgres psql -c "CREATE ROLE srisah_app LOGIN PASSWORD '…' NOSUPERUSER NOINHERIT NOBYPASSRLS;"
sudo -u postgres psql -d srisah_schooling -c "GRANT CONNECT ON DATABASE srisah_schooling TO srisah_app;"

git clone https://github.com/oberoi230-777/SriSah.git /opt/srisah && cd /opt/srisah
npm ci && npm run build
cp .env.example .env      # fill in production values
npm run migrate && npm run bootstrap
```

`/etc/systemd/system/srisah.service`:

```ini
[Unit]
Description=SriSah Schooling
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/srisah
EnvironmentFile=/opt/srisah/.env
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload && sudo systemctl enable --now srisah
sudo systemctl status srisah
```

Then install nginx and the proxy config exactly as in §3.4.

---

## 5. Option C — managed platforms

Set these environment variables in your host's dashboard, then run the migrate/bootstrap step
once (usually via a one-off shell or a release command):

```
NODE_ENV=production
DATABASE_URL=postgres://srisah_app:…@<managed-host>:5432/<db>        # must be NOBYPASSRLS
MIGRATION_DATABASE_URL=postgres://srisah_migrator:…@<managed-host>:5432/<db>
PUBLIC_ORIGIN=https://your-app.example.com
ALLOWED_ORIGINS=https://your-app.example.com
COOKIE_SECURE=true
TRUST_PROXY=true
RESEND_API_KEY=…
EMAIL_FROM=…
BOOTSTRAP_* = …
```

Notes that matter:

* **Single instance only** unless you add a shared rate-limit store. Rate limits and the
  in-memory windows live in the Node process; multiple replicas weaken them.
* Use the platform's "release command"/"pre-deploy hook" for `npm run migrate` so schema
  changes run exactly once per deployment.
* PostgreSQL 16 supplies `gen_random_uuid()` without a separate extension. The schema owner
  must be able to create tables, functions and RLS policies.
* Configure the health path as `/api/health` so the platform restarts a broken instance.

---

## 6. Operations

### Backups

```sh
# nightly logical backup (cron)
pg_dump --format=custom --no-owner \
  "postgres://srisah_migrator:…@127.0.0.1:5432/srisah_schooling" \
  > /var/backups/srisah/srisah-$(date +%F-%H%M).dump

# keep 30 days
find /var/backups/srisah -name '*.dump' -mtime +30 -delete
```

**Test the restore quarterly** into a scratch database:

```sh
createdb srisah_restore_test
pg_restore --no-owner --clean --if-exists -d srisah_restore_test /var/backups/srisah/<file>.dump
```

Copy backups off the host (object storage) — a backup on the same disk is not a backup.

### Upgrades

```sh
git pull
npm ci && npm run build
npm run migrate                 # or: docker compose --profile ops run --rm migrate
sudo systemctl restart srisah   # or: docker compose up -d app
curl -s https://school.yourdomain.com/api/health
```

Migrations are recorded in `schema_migrations`; take a backup before every upgrade.

### Monitoring

| What | How |
|---|---|
| Uptime | poll `https://…/api/health` every minute (UptimeRobot, Better Stack, your own cron) |
| Errors | capture `journalctl -u srisah` or `docker compose logs -f app` |
| Email | watch the Resend dashboard for bounces and complaints |
| Database | `pg_isready`, connection count, disk space |

### Security posture (already implemented — keep it that way)

* HTTPS only; `COOKIE_SECURE=true` in production (the app also forces `Secure` cookies when
  `NODE_ENV=production`).
* Session cookies are `HttpOnly`, `SameSite=Lax`, and prefixed `__Host-`.
* Mutating requests require a CSRF token **and** an allow-listed `Origin`.
* Security headers: `nosniff`, `X-Frame-Options: DENY`, a strict CSP,
  `Referrer-Policy`, `Permissions-Policy`.
* Scrypt password hashing, hashed one-time tokens, 12-hour sessions, rate limits on auth and
  public enquiry endpoints.
* Row-level security in PostgreSQL for every student-scoped table.
* The database port is never published; the app connects as a restricted role.

### Horizontal scaling checklist

Before running a second app instance, add: a shared rate limiter (Redis), sticky sessions or
stateless tokens, and a load balancer that forwards `X-Forwarded-Proto`.

---

## 7. Common deployment mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| `DATABASE_URL` points at the schema owner or a superuser | row-level security silently stops applying | use the `srisah_app` role; verify with `SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user` |
| `PUBLIC_ORIGIN` has a trailing slash or a path | the API refuses to start | use a bare origin: `https://school.yourdomain.com` |
| `ALLOWED_ORIGINS` does not include `PUBLIC_ORIGIN` | every mutation fails with 403 | list both, comma-separated |
| Cookies missing after login behind a proxy | `TRUST_PROXY` wrong, or the proxy drops `X-Forwarded-Proto` | set `TRUST_PROXY=true` for one trusted hop and configure the proxy headers |
| Emails never arrive | `RESEND_API_KEY`/`EMAIL_FROM` missing, or the domain is unverified | verify the sender domain (SPF/DKIM) in Resend |
| `npm start` before `npm run build` | the server has no UI to serve | build during deployment |
| Publishing PostgreSQL port 5432 | database exposed to the internet | bind to `127.0.0.1`, use private networking |
| Forgetting bootstrap | no organization, so nobody can register | run `npm run bootstrap` once |

See also: [Troubleshooting](TROUBLESHOOTING.md) and
[Operations](OPERATIONS.md).
