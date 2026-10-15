# Integration notes

This repository began with two products: a static public website for **The Throne of Wisdom** and a ZIP containing the **SriSah Schooling** learning portal. The original source pages, documents and assets are preserved under `legacy-site/`. The active product is now the React/Vite application in `web/`, the existing Express API in `server/`, and the PostgreSQL schema in `db/migrations/`.

## Product architecture

- `/` and `/articles` serve the public brand, service information, article journal and contact form.
- `/portal` and `/portal/...` serve the authenticated family, student, teacher and admin workflows.
- The route entry (`web/src/main.jsx`) lazy-loads the public experience or portal, so each surface keeps its own design system and code split while sharing a domain and API origin.
- Express serves the same production SPA fallback for public and portal routes. In development, Vite proxies relative `/api` calls to Express.
- The PWA opens at `/portal`, caches only the shell and fingerprinted static assets, and never caches/queues API records. Capacitor hosted mode now opens `/portal` on the configured HTTPS site.

The portal remains the authority for student, family and teaching records. Public content is not a second school database: articles and enquiries are scoped to the configured school organization.

## Integrated workflows

1. The public contact form reads `/api/site/config`, validates a contact request in the browser and submits it to the public, rate-limited `/api/enquiries` endpoint. The server validates again and persists it as an organization-scoped enquiry. Admins review, reply via their own email client, and update status in **Portal → Enquiries**. No automatic email notification is sent to the organization.
2. Public articles are loaded from `/api/articles?organizationSlug=…`; only published rows are exposed. Admins create, edit, publish/unpublish or delete articles in **Portal → Website journal**. Drafts stay private under PostgreSQL RLS; mutations are audited.
3. `/portal` keeps the original portal authentication flows, role boundaries, classwork, messaging, attendance, reports, materials, invoice ledger and account lifecycle.

Set `PUBLIC_SITE_ORG_SLUG` to the same slug used for `BOOTSTRAP_ORG_SLUG`. It defaults to `srisah`. `PUBLIC_ORIGIN` remains a bare canonical origin with no path; generated email links add `/portal` explicitly.

## Data and security boundary

- Public article reads run under an explicit organization-scoped public transaction and an RLS policy that returns published content only.
- Public enquiry writes use an explicit organization-scoped transaction. Public callers cannot read enquiries; admins can read/triage only their organization.
- Admin article writes require an authenticated admin, origin validation and the CSRF double-submit token. Create/update/delete operations are audited.
- Article body content is rendered as text, not injected as HTML. Input is length/category checked server-side and parameterized in SQL.
- Contact form guidance asks senders not to include sensitive medical or student details. The school/organization still needs to publish reviewed privacy/legal terms and retention/contact information before production launch.

## Source and backup handling

The ZIP was extracted without its `.env` entry. Its original archive is retained as a sanitized source snapshot; it contains no `.env` member. The former website source stays in `legacy-site/`, and the original `Founder.jpeg` / flyer asset names are preserved. Do not add signing keys, live student records, backups or production secrets to this repository or distributable archives.

## Verification boundaries

The public-site and portal UI render tests use mocked HTTP responses; they do not prove live email delivery or production configuration. Database migrations and all 18 API end-to-end scenarios were exercised against PGlite during this work. PGlite connects under its own superuser context, so its run is **not** evidence of RLS isolation. A real PostgreSQL test with a non-owner, non-superuser, `NOBYPASSRLS` application role remains required before deployment. No public deployment was performed.
