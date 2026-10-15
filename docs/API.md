# API reference

All authenticated endpoints use the same-origin `/api` base, JSON request/response bodies, an HTTP-only session cookie and a CSRF token on unsafe requests. The web client sends credentials and `X-CSRF-Token` automatically. Production requests must originate from `ALLOWED_ORIGINS`. Student-scoped endpoints also rely on PostgreSQL RLS; a guessed or unauthorized UUID is unavailable even if supplied directly.

Errors return JSON in the form `{"error":"CODE","message":"Human-readable explanation"}`. Cross-role and out-of-scope records generally return `404` to avoid confirming whether a record exists.

## Public website and journal

| Method | Path | Purpose / authorization |
|---|---|---|
| `GET` | `/api/site/config` | Public, cacheable site configuration; returns the organization slug from `PUBLIC_SITE_ORG_SLUG`. |
| `GET` | `/api/articles?organizationSlug=…` | Public published articles for the requested active organization; drafts are excluded by PostgreSQL RLS. |
| `GET` | `/api/admin/articles` | Admin-only organization journal list, including drafts. |
| `POST` | `/api/admin/articles` | Admin creates a validated draft or published article; writes an audit event. |
| `PATCH` | `/api/admin/articles/:id` | Admin edits article fields or publication state; writes an audit event. |
| `DELETE` | `/api/admin/articles/:id` | Admin deletes an article; writes an audit event. |
| `POST` | `/api/enquiries` | Public, rate-limited admission or contact submission. `enquiryType` is `admission` or `contact`; contact payloads use `name`, `email`, optional `phone`, `interest`, and `message`. |
| `GET` | `/api/enquiries` | Admin-only organization inbox for admission enquiries and public messages. |
| `PATCH` | `/api/enquiries/:id` | Admin updates enquiry status (`new`, `contacted`, `enrolled`, `closed`). |

The admin editor is in `/portal` → **Website journal**. Contact messages are persisted to the organization inbox; there is no built-in email notification to the organization when a new public message arrives.

## Authentication and account lifecycle

| Method | Path | Purpose / authorization |
|---|---|---|
| `POST` | `/api/auth/register` | Public parent registration with organization slug and family enrollment code; creates a pending parent and sends verification email. |
| `POST` | `/api/auth/verify-email` | Public one-time email verification; creates a session. |
| `POST` | `/api/auth/accept-invite` | Public one-time teacher/student invitation activation; sets the new password and creates a session. |
| `POST` | `/api/auth/login` | Public email/password login. |
| `POST` | `/api/auth/resend-verification` | Public; generic response avoids account enumeration. |
| `POST` | `/api/auth/forgot-password` | Public; generic response avoids account enumeration. |
| `POST` | `/api/auth/reset-password` | Public one-time reset token; updates password and revokes prior sessions. |
| `GET` | `/api/auth/me` | Current session user or `{user:null}`. |
| `POST` | `/api/auth/logout` | Revokes the current session and clears cookies. |

## Student profiles and administration

| Method | Path | Purpose / authorization |
|---|---|---|
| `GET` | `/api/students` | Lists only accessible student profiles. |
| `POST` | `/api/students` | Parent creates a profile and is linked as guardian; admin may create an organization profile. |
| `PATCH` | `/api/students/:id` | Parent edits a linked student; admin edits organization students. |
| `DELETE` | `/api/students/:id` | Admin-only destructive erasure; revokes a linked student account and cascades student records. |
| `POST` | `/api/students/:id/invite` | Parent/admin sends or resends an activation link for the linked student's sign-in. |
| `POST` | `/api/admin/users` | Admin creates an invited teacher or student account. Student role requires a student profile ID. |
| `POST` | `/api/admin/users/:id/resend-invite` | Admin resends an invitation to a pending teacher/student account. |
| `GET` | `/api/admin/teachers` | Admin-only organization teacher list and activation status. |
| `POST` | `/api/admin/teacher-assignments` | Admin assigns a teacher, student and subject. |
| `GET` | `/api/admin/teacher-assignments` | Admin lists assignments. |
| `DELETE` | `/api/admin/teacher-assignments` | Admin removes an assignment; JSON body contains `teacherId`, `studentId`, `subject`. |
| `POST` | `/api/admin/student-guardians` | Admin links a verified parent account to a student; body contains `studentId`, `parentEmail`, optional `relationship`, optional `isPrimary`. |
| `GET` | `/api/admin/parents` | Admin lists verified parent accounts in the organization. |

## Learning records

| Method | Path | Purpose / authorization |
|---|---|---|
| `GET` | `/api/dashboard?studentId=…` | Role-scoped summary and, when a student is selected, their accessible learning activity. |
| `GET` / `POST` | `/api/classes` | Read authorized classes / schedule an online class for accessible students. |
| `GET` / `POST` | `/api/homework` | Read accessible assignments / teacher or admin assigns homework. |
| `POST` | `/api/homework/:id/submit` | Student submits or updates text work for their own assignment. |
| `PATCH` | `/api/homework/:submissionId/feedback` | Assigned teacher/admin reviews submission; status is `reviewed` or `needs_revision`. Score is optional and is out of 100. |
| `GET` / `POST` | `/api/tests` | Read accessible test results / teacher or admin records an assessment. |
| `GET` / `POST` | `/api/attendance` | Read accessible attendance / teacher or admin marks an enrolled student for a class. |
| `GET` / `POST` | `/api/updates` | Read accessible updates / assigned teacher or admin shares learning feedback. |
| `GET` / `POST` | `/api/improvement-plan` | Read accessible practice actions / teacher or admin adds a plan. |
| `PATCH` | `/api/improvement-plan/:id` | Accessible student/parent marks an action complete; teacher/admin can update accessible actions. |
| `GET` / `POST` | `/api/messages` | Read or send messages for an accessible student's thread. |
| `GET` | `/api/reports?studentId=…` | Builds a report from the selected accessible student's records. |
| `GET` / `POST` | `/api/materials` | Read organization resources / teacher or admin adds an HTTPS link. |
| `GET` | `/api/health` | Database health check; no authentication. |
| `GET` / `POST` | `/api/invoices` | Parent/admin reads their authorized ledger rows; admin creates invoice entries. No payment is collected. |

For exact JSON validation and constraints, see `server/app.js` and `db/migrations/001_core.sql` plus `db/migrations/002_public_website.sql`. This is an API implementation reference, not a public compatibility guarantee; review route and schema changes as part of each release.
