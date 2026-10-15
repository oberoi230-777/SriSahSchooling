PostgreSQL local password reset helper for Windows

WHAT IT RESETS
This resets only the PostgreSQL superuser role named `postgres`. It does not reset the SriSah app admin, `srisah_migrator`, or `srisah_app` passwords.

HOW TO RUN
1. Extract BOTH reset-postgres-password.bat and reset-postgres-password.ps1 into the same folder.
2. Right-click reset-postgres-password.bat and choose Run as administrator.
3. Enter a new password twice at the hidden prompts. Use 20+ URL-safe characters (A-Z, a-z, 0-9, hyphen, underscore).
4. The helper finds the PostgreSQL Windows service/data directory, backs up pg_hba.conf, temporarily adds a localhost-only trust rule for 127.0.0.1, changes the postgres role password, restores the original pg_hba.conf byte-for-byte, restarts PostgreSQL, then verifies the new password.
5. Use the new password when the SriSah setup helper prompts for PostgreSQL superuser password. It is not written to the SriSah .env file.

SAFETY / LIMITS
- This is for a PostgreSQL server on this Windows PC, listening on 127.0.0.1:5432, with the standard `postgres` role.
- The helper uses a temporary trust rule for local loopback only. It restores the original access rules in a finally/cleanup path and keeps a timestamped backup beside pg_hba.conf.
- If Windows is powered off or the process is forcibly terminated during the brief trust window, restore the timestamped backup over pg_hba.conf and restart the PostgreSQL service before using the database.
- If the script reports a restore failure, do not expose the database. Follow the backup path printed in the error and restore it before restart.
- It cannot reset a remote server or an instance using a nonstandard port/role without adapting the script.
