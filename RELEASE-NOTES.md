# SriSah Schooling — release notes

## 1.1.0 — violet brand + Android app + full documentation

This release makes SriSah shippable as a production web app **and** a Google Play Android app,
re-brands the whole product in violet/purple, and adds the verification and documentation
needed to run it for a real school.

### Brand

* **New violet/purple theme** across the portal, the installable app and the native Android
  app. Seven custom properties at the top of `web/src/styles.css` now drive every colour, so a
  future re-brand is a seven-line change (`docs/THEME-GUIDE.md`).
* Every green/teal value was hue-remapped to violet at identical lightness, so all tints,
  borders, charts and shadows keep their contrast. Semantic reds and ambers were deliberately
  left alone (errors and "needs revision" must not look like brand colours).
* Contrast verified: white on `#3c1f7a` = 12.6:1, white on `#6d3fd1` = 6.4:1, body text
  15.7:1, secondary text 5.1:1 — all WCAG 2.1 AA or better.
* **New app icon and splash screens**: violet gradient book logo, generated at five Android
  densities plus maskable PWA sizes and an Apple touch icon, from one vector source
  (`tools/make-icons.py`).
* Violet Android status bar, violet launch screen, violet task-switcher header.

### Android (new)

* Capacitor 8 native project in `android/`, `applicationId in.srisah.schooling`, targeting
  **API 36** (the level Google Play requires for new apps and updates since 31 Aug 2026).
* Release signing wired through `android/keystore.properties` or `SRISAH_KEY*` environment
  variables, with `minifyEnabled` + `shrinkResources` and Capacitor-aware ProGuard rules.
* Play-ready manifest: cleartext HTTP blocked by a network security config, cloud backup and
  device transfer disabled (session data never leaves the device), only the `INTERNET`
  permission requested, resizeable for tablets and foldables.
* `npm run android:configure` points the app at your hosted HTTPS origin; `npm run android:release`
  produces the signed `.aab`.
* JVM and instrumented smoke tests renamed to the real package and made release-safe.

### Functionality and correctness

* **Bigint values now serialise as numbers.** `pg` returned PostgreSQL `bigint` columns
  (invoice amounts in minor units, counts) as JSON **strings**; `server/db.js` now parses them
  to numbers once, so clients no longer need to coerce `"450000"` before formatting currency.
* **Deep links work.** `?page=homework`, `?page=attendance`, `?page=messages` … are honoured
  (used by the installable-app shortcuts) and safely ignored when the signed-in role cannot
  open that page.
* **Service worker cache versioned** to `srisah-shell-v2` so installed apps pick up the new
  brand assets instead of serving the cached green shell.

### Testing (new)

* `tests/api.e2e.test.js` — **16 end-to-end HTTP scenarios across all four roles**: parent
  registration and enrollment-code validation, email verification, invitation activation,
  CSRF enforcement, origin rejection, the complete teaching cycle (class, homework,
  attendance, test, learning update, practice step, material, message), submission review,
  `needs_revision` and resubmission, invoices, public enquiries, password reset with session
  revocation, logout, plus rejected invalid inputs (grades, scores, durations, non-HTTPS URLs).
* `tests/render.smoke.mjs` — compiles the real portal and renders it in jsdom, asserting the
  sign-in screen mounts with **zero runtime errors** and the violet theme is compiled in.
* Row-level-security assertions now declare whether the test connection actually enforces RLS
  and skip (with a diagnostic) instead of reporting a false pass.
* `MIGRATION_SET_ROLE` lets fixture setup elevate inside a transaction without ever weakening
  the application connection.
* `.github/workflows/ci.yml` runs unit, render, end-to-end and RLS tests against a real
  PostgreSQL 16 service container with the restricted `srisah_app` role, then builds the web
  and Android bundles and fails if a secret file is tracked.

### Fixed: files the previous commit referenced but did not contain

* `Dockerfile` and `docker-compose.yml` build the app, but the repository had **no
  `.gitignore`**, so `.env` and keystores were at risk of being committed.
* `docker-compose.yml` mounted `docker/postgres-init/01-app-role.sh`, which did not exist —
  so the restricted `srisah_app` role was never created and `docker compose up` could not have
  produced a working, RLS-enforcing deployment. The script is now included and tested.
* `README.md` instructed readers to copy `.env.example`, which did not exist. It does now, with
  every variable documented.
* `src/styles.css` (legacy design mock-up, not part of the build) described itself as the live
  stylesheet. It is marked as a reference and was re-themed to match.

### Documentation (new)

Eleven guides under `docs/`, indexed in `docs/README.md`:

* `GETTING-STARTED.md` — install → database roles → `.env` → migrate → bootstrap → first sign-in
  → the first fifteen minutes as administrator (Windows and macOS/Linux paths).
* `APP-GUIDE.md` — every role, every screen, every form field, and a capability matrix.
* `THEME-GUIDE.md` — the palette, contrast ratios, how to re-brand, how to regenerate icons,
  and how to add dark mode.
* `BUILD-AND-TEST.md` — every npm script, expected output, the JDK/SDK prerequisites, App
  Bundle signing, and a zero-install PostgreSQL for testing.
* `WEB-DEPLOYMENT.md` — Docker Compose, plain VPS with systemd + nginx, managed platforms,
  backups, upgrade procedure, monitoring, and the security posture to preserve.
* `PLAY-STORE-DEPLOYMENT.md` — packaging modes, keystore, App Bundle, Play Console forms,
  store-listing copy, data-safety answers, the 12-testers/14-days closed-testing rule, the
  minimum-functionality policy risk, and how to handle rejections.
* `TROUBLESHOOTING.md`, `ANDROID-TESTING.md` (rewritten for the native app), plus the existing
  API, operations and feature-test-plan guides updated.

### Upgrading

```sh
git pull
npm ci
npm run build                    # new violet web assets
npm run android:configure        # only if you build the Android app
```

No database migration is required: `db/migrations/001_core.sql` is unchanged and the schema is
identical. Existing sessions, accounts and records are unaffected.
