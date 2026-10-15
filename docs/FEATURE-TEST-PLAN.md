# Feature test plan

Run this plan against a disposable PostgreSQL database and a non-production deployment with email delivery configured. Do not mark a case complete until it has been executed and recorded by the school operator.

## Automated checks

Run `npm run verify` for the database-free gate. Database-backed API/migration flows can be checked with a disposable PostgreSQL-compatible test database; RLS acceptance still requires a real PostgreSQL server and a restricted app role. The result block at the end records what was actually run in this workspace.

- [x] Unit tests in `tests/security.test.js`: email normalization, opaque-token shape/hash, password policy, scrypt verification.
- [x] End-to-end role journey in `tests/api.e2e.test.js` (`npm run test:e2e`): 18 HTTP scenarios covering registration, verification, invitations, CSRF, origin rejection, all four roles, teaching/review workflows, contact enquiries, journal CRUD/publication, password reset and logout. The recent local run used PGlite; see the result note for its RLS limitation.
- [x] PostgreSQL integration test in `tests/postgres.integration.test.js` (`npm run test:integration`): parent, student and teacher row isolation, parent invoice/homework isolation, student submission visibility and denied cross-student teacher writes. Requires separate migration and restricted app URLs.
- [x] Browser render smoke test in `tests/render.smoke.mjs` (`npm run test:render`): the compiled public homepage, a published-article dialog and portal sign-in render against stubbed APIs with zero runtime errors; keyboard Escape/focus restoration, violet theme and no external-font dependency are checked.
- [x] Production build with `npm run build`.
- [x] Android-target web bundle with `npm run android:build:web` completed successfully.
- [x] `android:configure` smoke check against a placeholder HTTPS origin confirms the hosted WebView URL targets `/portal` (the committed config was restored afterward).
- [ ] Capacitor sync, APK/AAB build and physical-device check. Not run in this workspace.
- [x] Dependency audit with `npm audit` (0 vulnerabilities after updating the toolchain and constraining the vulnerable xcode/uuid dependency).

> Row-level-security assertions only run when `DATABASE_URL` uses a non-owner,
> non-superuser, `NOBYPASSRLS` role. The suites report a diagnostic instead of a false pass
> when the connection can bypass RLS.

## Account lifecycle

- [ ] Register a parent with the correct organization slug/family code; confirm a `pending` account is not accepted at login before email verification.
- [ ] Verify the one-time email link; confirm a session starts and the parent can create a student profile.
- [ ] Attempt registration with a wrong enrollment code and an already-used email; confirm no account or data is exposed.
- [ ] Invite a student from a linked profile; accept the one-time link, set a password, sign in and confirm only the linked student is returned by `/api/students`.
- [ ] Invite a teacher as admin; confirm the teacher is pending until activation, can be assigned before activation, and can sign in only after activation.
- [ ] Resend a pending teacher invitation and a still-pending student invitation; confirm a fresh token invalidates the old one.
- [ ] Request password reset for an existing and non-existing email; confirm the response is generic. Reset with a valid one-time link and confirm old sessions are revoked.
- [ ] Try invalid, expired and reused verification/reset/invitation links; confirm they cannot activate accounts, set passwords or create sessions.
- [ ] Sign out; confirm the session cookie is revoked and subsequent protected API requests return `401`.

## Student records and role access

- [ ] Parent A creates two students; confirm both appear in that parent's picker and profile area.
- [ ] Parent B creates or is linked to a different student; use Parent B's session to request Parent A's student UUID from profile, dashboard, classes, homework, attendance, tests, updates, reports, improvement, messages and invoices. Confirm `404`, empty result or denied access—never record data.
- [ ] Student A signs in; request Student B's UUID from each student-scoped read endpoint. Confirm no cross-student result.
- [ ] Teacher A is assigned to Student A; confirm only assigned learners appear in the roster, picker and dashboard.
- [ ] Teacher A tries to create homework, a test, attendance, learning update, improvement action or class enrollment for unassigned Student B. Confirm denial and no persisted record.
- [ ] Remove Teacher A's assignment; confirm subsequent reads/writes to that student's records are denied.
- [ ] Link a second verified parent account to a student as admin; confirm both linked parents can read that student's information, and neither can read unlinked students.
- [ ] Delete a student as admin after confirming retention rules; confirm linked student sessions are revoked and dependent records are removed. Confirm the audit event remains.

## Learning workflows

- [ ] Admin/teacher schedules a future class for one or more accessible students; confirm it appears in the correct parent/student schedule and does not appear in unrelated accounts.
- [ ] Teacher assigns homework; confirm only the selected learner/family and assigned teacher can read it.
- [ ] Student submits text work; confirm it appears to the student, linked parent and assigned teacher. Submit an update and confirm it replaces the current submission without creating a second row.
- [ ] Teacher reviews work, saves optional score/feedback and marks `Needs revision`; confirm the student can update and resubmit. Mark reviewed; confirm the student's edit action is hidden.
- [ ] Teacher records a test with valid score/max score; reject negative scores and scores above max. Confirm reports/dashboard recalculate from saved data.
- [ ] Mark attendance for an enrolled student/class; confirm it appears only to accessible roles and affects report percentages.
- [ ] Share a learning update and improvement action; confirm data appears for the correct learner and a student/parent can mark an action complete.
- [ ] Send a message as parent, student and assigned teacher; confirm only linked/assigned roles can read it, current-user styling uses sender ID, and unassigned teacher access is denied.
- [ ] Add an HTTPS learning material; confirm organization users can view it. Reject non-HTTPS resource URLs.
- [ ] Create and read an invoice ledger record; confirm only the linked parent/admin can see it. Confirm no payment is attempted or represented as collected.
- [ ] Submit an enquiry and process its status as admin; confirm teacher, parent and student accounts cannot read the organization enquiry inbox.

## Public website, contact and journal

- [ ] Open `/` signed out; confirm the public homepage, story, services, learning guidance, contact details and public-site links render without a session.
- [ ] Open `/portal`; confirm only the authenticated learning portal is shown. Use the public-site link from the sign-in screen and the portal navigation to move between surfaces.
- [ ] Submit the contact form with invalid and valid data; confirm client-side validation, sending state, clear error/success state, and an inbox row under the configured organization. Confirm administrators check the inbox because there is no automatic notification email.
- [ ] As admin, open **Website journal**, save a draft and confirm it is hidden from `/articles`; publish it and confirm it appears; edit/unpublish and confirm it disappears; delete it and confirm the public page no longer returns it after cache expiry.
- [ ] Test journal loading, empty, server error and category-filter states. Open an article dialog using keyboard and pointer; verify focus containment, Escape/close behavior, and focus restoration.
- [ ] At mobile widths, test menu and forms; enable reduced motion and disable WebGL to confirm the CSS artwork fallback remains visible and no essential content depends on motion.

## Android / PWA and release

- [ ] Complete the role privacy checks in `docs/ANDROID-TESTING.md` on a physical Android device over HTTPS.
- [ ] Install from Chrome; confirm standalone launch, sign-in, keyboard usability, portrait/landscape layout and safe-area spacing.
- [ ] Offline, confirm only the application shell/static assets load; no student/API records are served from cache and no write is queued.
- [ ] Check database backup and restore in a disposable environment, health endpoint, email delivery, logs and rollback plan before real-school use.

## Authoring-environment result

Verified in this workspace: all three unit tests pass; the public-homepage/article-dialog/portal render smoke test passes; the production Vite build passes; `npm audit` reports zero vulnerabilities; migrations `001_core.sql` and `002_public_website.sql` applied successfully to a temporary PostgreSQL 18 WASM (PGlite) database; all 18 end-to-end HTTP scenarios pass against that database. The PGlite socket reports its own superuser context even when the client URL names `srisah_app`, so the API suite explicitly skipped RLS-isolation assertions; the separate RLS integration test still needs a real PostgreSQL instance with a non-owner, non-superuser, `NOBYPASSRLS` application role. The Android-target web bundle and `/portal` configuration smoke check passed; no Capacitor sync, APK/AAB build or physical-device check is claimed. Production email delivery, live contact notifications, privacy/legal copy review, deployment, backups and restore have not been tested here.
