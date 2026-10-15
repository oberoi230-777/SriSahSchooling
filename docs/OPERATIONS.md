# Operations and maintenance guide

This guide covers a first install, organization onboarding, routine school operations, privacy/access controls, backup/restore and Android release checks. Keep it with the deployment owner; do not put passwords, student data, backups or email API keys in this repository.

## 1. Local PostgreSQL roles

Use a migration/schema-owner connection only for migration and bootstrap commands. The web process must use a separate non-owner role with `NOSUPERUSER`, `NOBYPASSRLS` and no ownership of application tables. The app role cannot create/drop schema objects. The migration grants table/sequence privileges and the security functions to `srisah_app`.

For a local PostgreSQL cluster, connect as a database administrator and create a database owner plus the restricted app login (substitute strong, URL-safe secrets):

```sql
CREATE ROLE srisah_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'migration-secret';
CREATE DATABASE srisah_schooling OWNER srisah_migrator;
CREATE ROLE srisah_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'app-secret';
GRANT CONNECT ON DATABASE srisah_schooling TO srisah_app;
```

PostgreSQL 16 has built-in `gen_random_uuid()`; no extension is needed. Do not grant the app role `SUPERUSER`, `BYPASSRLS`, table ownership or the migration URL.

Set in `.env`:

```dotenv
MIGRATION_DATABASE_URL=postgres://srisah_migrator:migration-secret@127.0.0.1:5432/srisah_schooling
DATABASE_URL=postgres://srisah_app:app-secret@127.0.0.1:5432/srisah_schooling
```

Use URL-safe secrets or percent-encode reserved characters. `DATABASE_SSL=true` and `MIGRATION_DATABASE_SSL=true` enable certificate-verified TLS connections; configure these for remote PostgreSQL.

## 2. First school setup and onboarding

1. Configure the database URLs, `PUBLIC_ORIGIN`, `ALLOWED_ORIGINS`, email settings and bootstrap fields in `.env`.
2. Apply the schema with `npm run migrate`. Migrations are recorded in `schema_migrations`; back up before each later schema update.
3. Run `npm run bootstrap` once. It creates the organization, enrollment-code hash and initial verified administrator. Store the admin password and family enrollment code in an approved password manager; remove bootstrap credentials from the runtime environment after bootstrap.
4. Sign in as the admin. From **Students**, create real student profiles, invite teacher/student accounts, assign each teacher to the specific learner(s) and subject(s), and link additional verified parent accounts by email. Teachers who are still pending can be assigned, but they cannot sign in until they activate their invitation.
5. Give the family enrollment code only to verified families. A parent can register, verify their email and create a child profile; that parent is linked automatically. A verified parent needing access to an administrator-created/previously existing child must be linked by an administrator. Student login is issued by the parent from that child's profile or by an administrator.
6. A teacher's roster becomes available only after an administrator assigns that teacher to a learner. Revoke assignments promptly when teaching responsibility changes.

No demo profiles are seeded. Create explicitly synthetic test profiles in a non-production database for acceptance checks.

## 3. Email, sessions and enrollment-code rotation

- Production email uses Resend. Set `RESEND_API_KEY` and a verified `EMAIL_FROM`; confirm the sender domain's SPF/DKIM setup with the email provider. Test verification, password reset, parent invitation and teacher/student invitation end to end.
- All one-time tokens are stored as SHA-256 hashes, expire after two hours and can only be used once. If delivery failed after creating an account, resend a pending teacher invitation from the admin roster, or submit the same email again for a still-pending student invitation.
- Use HTTPS only. Production session cookies are `Secure`, `HttpOnly`, `SameSite=Lax` host cookies. The frontend sends a separate CSRF header and the API verifies the request origin.
- To rotate the family enrollment code, change `BOOTSTRAP_JOIN_CODE` to a new random value in the protected deployment environment and run the bootstrap job again using the same organization slug and existing bootstrap admin email. Bootstrap updates the stored hash; existing parent accounts remain active. Distribute the new code out of band and remove the old value from secret stores/logs.
- Password reset revokes the account's existing sessions. For suspected account compromise, suspend the user and revoke sessions through the approved DBA/support process, then issue a reset link.
- Rate limits are in-process. If running multiple app replicas, add a shared rate-limit store (for example Redis) and review limits at the reverse proxy.

## 4. Privacy and access review

The API derives organization, role and user identity from the server-validated session; it never trusts a role or student ID supplied by the browser. Student-specific reads/writes execute inside a transaction with per-request PostgreSQL settings and RLS predicates. API role checks are defense in depth; RLS still checks each student record. The database app role must remain a non-owner, non-superuser and non-`BYPASSRLS` role.

RLS currently scopes:

- **Student:** only rows for the student's `linked_user_id`.
- **Parent:** rows for students connected through `student_guardians`.
- **Teacher:** rows for students in `teacher_assignments`; teacher write policies require the same assignment.
- **Admin:** records within that admin's `org_id`.
- **Messages, invoices, submissions, attendance, reports and progress:** inherit the student access policy rather than being authorized by a guessed UUID.

Recommended access review:

- Review teacher assignments and verified guardian links at each term change.
- Remove stale teacher assignments immediately. A student whose profile is deleted is suspended and their active sessions are revoked; dependent student learning records are deleted by FK cascade. The audit event records that the deletion action occurred, but not the deleted content.
- Before deleting student records, confirm the school's lawful retention/erasure policy and export/backup requirements. The admin profile's **Delete records** action is destructive and cannot be undone without a database restore.
- Review admin accounts and access to the family enrollment code; use unique accounts, MFA at the identity/email provider where available, and a password manager.
- Logs should not include passwords, session tokens, one-time tokens or homework/message bodies. Keep database audit records and operational logs access-controlled and retained according to school policy.
- This software does not determine whether the school's consent, privacy notice, retention schedule or data-processing agreements satisfy local law. Obtain the school's legal/privacy review before using real student data.

## 5. Backups, restore and upgrades

Back up PostgreSQL daily (and before each migration) to encrypted, access-controlled storage outside Git and outside the application host. Example custom-format backup from a machine with `pg_dump` and access to the migration URL:

```sh
umask 077
mkdir -p backups
pg_dump --format=custom --no-owner --file="backups/srisah-$(date -u +%Y%m%dT%H%M%SZ).dump" "$MIGRATION_DATABASE_URL"
```

Test a restore regularly into an isolated database; an untested dump is not a recovery plan. Example restore into a freshly created target database as the DBA/migration role:

```sh
createdb --owner=srisah_migrator srisah_restore_test
pg_restore --no-owner --clean --if-exists --dbname="$RESTORE_DATABASE_URL" backups/srisah-YYYYMMDDTHHMMSSZ.dump
```

`pg_restore --clean` is destructive to the target. Never point it at production when practicing.

Upgrade procedure:

1. Read the release notes and inspect new SQL/API authorization changes.
2. Take and verify a fresh backup.
3. Build and run `npm test`; run the PostgreSQL RLS integration test against a disposable database with the restricted app role.
4. Run `npm run migrate` (or the Compose `migrate` job), deploy the same release, then check `/api/health` and parent/student/teacher smoke flows.
5. Monitor service, database and email-provider errors. If the release fails, restore the known-good backup or deploy a reviewed forward-fix; there are no automatic destructive down-migrations.

Compose commands:

```sh
docker compose ps
docker compose logs --tail=200 app
docker compose logs --tail=200 db
docker compose --profile ops run --rm migrate
docker compose down             # stops services; preserves the named DB volume
docker compose down -v          # DESTRUCTIVE: also deletes PostgreSQL data
```

Keep image tags and tested database snapshots with the school's change record. Do not run `docker compose down -v` for routine maintenance.

## 6. Local commands and health checks

```sh
npm ci
npm run migrate
npm run bootstrap
npm run dev
npm test
npm run test:integration
npm run build
npm start
```

The integration test creates temporary users, students, guardians, teacher assignments, homework, submissions and invoices, then verifies that parents, students and teachers cannot see each other's records and teachers cannot write to unassigned students. It skips without both database URLs and refuses an owner/superuser app connection. Use a disposable database because the fixture runs cleanup against it.

Health endpoint: `GET /api/health` verifies the database connection. In production the Node service also serves the built SPA from the same origin, so `/api` calls remain same-site. Restrict `/api/health` from public internet exposure at the reverse proxy if the school requires it.

## 7. Functional scope and outside dependencies

- The invoice feature is an administrative ledger, not a payment gateway. Payment initiation, webhook authentication, refund/reconciliation handling and PCI review remain external work.
- Homework submissions are text-only. Do not store student uploads in the app container; design private object storage, malware scanning, authorization, retention and download auditing before supporting files.
- Materials are HTTPS links. Review third-party content, child-safety suitability, access controls and link availability.
- PWA offline mode serves only the app shell and static assets; it does not persist or queue student data.
- Configure a trusted reverse proxy, TLS certificates/renewal, database access controls, encrypted backups, monitored email delivery and incident-response contacts before production.
