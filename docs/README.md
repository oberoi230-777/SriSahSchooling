# SriSah Schooling — documentation index

Everything needed to run, brand, test, ship and operate the combined The Throne of Wisdom / SriSah Schooling product. Start with the guide that matches what you are trying to do right now.

| # | Guide | Read it when you want to… |
|---|-------|---------------------------|
| 0 | [Complete guide](COMPLETE-GUIDE.md) | configure the public site, journal, role logins, daily workflow and production checklist |
| 1 | [Getting started](GETTING-STARTED.md) | install the project, apply migrations and sign in for the first time |
| 2 | [App guide](APP-GUIDE.md) | learn what every portal screen does, role by role |
| 3 | [Theme guide](THEME-GUIDE.md) | change the violet/purple portal brand, icons and app artwork |
| 4 | [Build & test guide](BUILD-AND-TEST.md) | build, package and verify the web app and Android app |
| 5 | [Web deployment](WEB-DEPLOYMENT.md) | publish the shared-origin public site and secure portal with HTTPS, database and backups |
| 6 | [Play Store deployment](PLAY-STORE-DEPLOYMENT.md) | publish the Android app to Google Play |
| 7 | [Android testing](ANDROID-TESTING.md) | device-test the installed app and the progressive web app |
| 8 | [Operations](OPERATIONS.md) | manage onboarding, access, public enquiries, journal publishing, backups and upgrades |
| 9 | [API reference](API.md) | call or extend the authenticated and public HTTP API |
| 10 | [Feature test plan](FEATURE-TEST-PLAN.md) | sign off the release with role-by-role and public-site acceptance checks |
| 11 | [Troubleshooting](TROUBLESHOOTING.md) | fix an error message |
| 12 | [Integration notes](integration/INTEGRATION-NOTES.md) | understand the public-site / portal boundary and shared-origin architecture |

## The one-page mental model

```text
Browser ── same origin ──► Vite in development / Express in production
                              ├── / and /articles   public brand, journal, contact form
                              ├── /portal          authenticated React learning portal
                              └── /api             Express API ──► PostgreSQL 16+
                                                            organization scope + RLS

Android Capacitor WebView ── HTTPS ──► /portal on the same deployment
PWA service worker ── caches shell/static assets only; never API/student data
```

* **One product, two deliberate experiences.** The public-facing brand and content live at `/` and `/articles`; authenticated parent, student, teacher and admin workflows live at `/portal`. The route split lazy-loads each experience and preserves the existing portal.
* **Public site content follows the school boundary.** `PUBLIC_SITE_ORG_SLUG` routes enquiries and published articles to an organization. Contact submissions are stored in the admin inbox; there is no automatic email alert. Admins publish journal content in **Website journal**.
* **One database, strict learner isolation.** User transactions set role and identity; PostgreSQL RLS enforces access to each learner's records. Public article reads and public enquiry writes use explicit organization-scoped policies.
* **No demo student data.** The database starts empty on purpose. An administrator creates real profiles after deployment.

## Quick command reference

```sh
npm ci
npm run migrate         # apply every schema migration, including the public website workflow
npm run bootstrap       # create the first organization + administrator (once)
npm run dev             # public site on http://localhost:5173; portal on /portal
npm test                # unit + DB-backed HTTP/RLS suites; DB suites skip without URLs
npm run test:render     # render public homepage and portal login in jsdom
npm run build           # production web assets in web/dist
npm run android:sync    # build + copy web assets into the Android project
npm run android:release # signed Android App Bundle for Google Play
```

For the public contact and publishing endpoints, see [API reference](API.md). For setup, scripts, tests and operations, see [Complete guide](COMPLETE-GUIDE.md) and [Build & test guide](BUILD-AND-TEST.md).
