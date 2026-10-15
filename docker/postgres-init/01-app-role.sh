#!/bin/bash
# ---------------------------------------------------------------------------------------
# Creates the restricted SriSah application role the first time the PostgreSQL container
# initialises an empty data directory.
#
# The application must never connect as the schema owner or as a superuser: PostgreSQL row
# level security (RLS) is bypassed by table owners, so running the API as the database owner
# would silently disable per-family isolation. This role is deliberately NOSUPERUSER,
# NOCREATEDB, NOCREATEROLE and NOBYPASSRLS.
#
# docker-entrypoint-initdb.d scripts only run for an *empty* data directory. If you are
# upgrading an existing volume, create the role once with the SQL in docs/OPERATIONS.md.
# ---------------------------------------------------------------------------------------
set -euo pipefail

: "${APP_DB_PASSWORD:?APP_DB_PASSWORD must be set for the app role}"
: "${POSTGRES_DB:?POSTGRES_DB must be set}"
: "${POSTGRES_USER:?POSTGRES_USER must be set}"

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$APP_DB_PASSWORD" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'srisah_app') THEN
    CREATE ROLE srisah_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;
SQL

# Set the password separately so it never appears in the server log as part of a DO block.
psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --command "ALTER ROLE srisah_app WITH PASSWORD '${APP_DB_PASSWORD//\'/\'\'}';"

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --command "GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO srisah_app;"

echo "SriSah: created restricted application role srisah_app (NOSUPERUSER, NOBYPASSRLS)."
