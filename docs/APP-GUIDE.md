# SriSah Schooling — full app guide

Every screen, every role, every action. Use this as the school's operations manual and as the
script for training staff, parents and students.

**Contents**
[1. Concepts](#1-concepts) ·
[2. Accounts and sign-in](#2-accounts-and-sign-in) ·
[3. Administrator](#3-administrator) ·
[4. Parent](#4-parent) ·
[5. Student](#5-student) ·
[6. Teacher](#6-teacher) ·
[7. Every form, field by field](#7-every-form-field-by-field) ·
[8. What each role can and cannot see](#8-what-each-role-can-and-cannot-see) ·
[9. Offline, printing and mobile](#9-offline-printing-and-mobile)

---

## 1. Concepts

| Term | Meaning |
|---|---|
| **Organization** | one school or tuition centre. All data belongs to exactly one organization. |
| **Student profile** | the learner's record (grade, curriculum, subjects, goals, progress). A profile is *not* a login. |
| **Linked account** | the student login attached to a profile. The portal knows who "me" is through this link. |
| **Guardian link** | the record that lets a parent account see a specific student. Created automatically when a parent creates the child, or by an admin for an existing child. |
| **Teacher assignment** | "this teacher teaches this learner this subject". A teacher sees **only** assigned learners. |
| **Enrollment code** | the private code a family uses to self-register. One per organization; rotate it if it leaks. |
| **Portal / role** | the four interfaces: Admin, Parent, Student, Teacher. The sidebar changes with the signed-in role. |

> **No demo data.** The database starts empty by design. Every learner in the portal was
> created by a real administrator or parent.

---

## 2. Accounts and sign-in

### 2.1 How each kind of account is created

| Who | How the account appears | Who does it |
|---|---|---|
| **Administrator** | created once by `npm run bootstrap` | the deployment owner |
| **Parent** | self-registers with the organization code + family enrollment code, then verifies email | the parent |
| **Teacher** | invited by an administrator; activates through a one-time email link and sets a password | admin invites, teacher activates |
| **Student** | invited from the student profile (or by an admin); activates through a one-time link | parent or admin invites, student activates |

### 2.2 The sign-in screen

`Create a family account` requires four values: full name, organization code (the school slug,
e.g. `srisah`), family enrollment code, email and password. Password rules: **12+ characters**
with an uppercase letter, a lowercase letter and a number.

Links in account emails point at the portal and are **single use, valid for two hours**:

| Link | Purpose |
|---|---|
| `?verify=…` | confirms a parent's email address |
| `?invite=…` | activates a teacher or student account and sets its password |
| `?reset=…` | sets a new password after "Forgot password?" |

A password reset **revokes every existing session** for that account.

### 2.3 Session behaviour

Sessions last **12 hours**, are stored server-side (revocable), and the cookie is `HttpOnly`,
`SameSite=Lax` and `Secure` in production. The portal additionally sends a CSRF token with
every write. Signing out clears both cookies immediately. Inactivity does not log you out
before 12 hours; closing the browser does not either.

---

## 3. Administrator

The admin portal has four navigation groups: **Workspace**, **Teaching**, **Administration**
and the shared learning pages.

### 3.1 Workspace

| Page | What it shows | Actions |
|---|---|---|
| **Dashboard** | organization totals: number of students, upcoming classes, submissions awaiting review, and an attendance percentage (or a single learner's dashboard once you pick one) | pick a learner from the student selector |
| **Students** | the learner directory with profile cards | create a student, edit a profile, delete records, invite the learner to the student portal, invite a teacher, link a verified parent, assign a teacher to a learner, resend a pending invitation |
| **Enquiries** | the admissions inbox | set status: `new → contacted → enrolled → closed` |

**Assigning a teacher is what grants access.** Until a teacher is assigned to a learner, that
learner is invisible to them.

### 3.2 Teaching (admin and teacher share these)

Classes, homework, tests, attendance, progress tracking and learning materials. As admin you
can create content for any learner in the organization.

### 3.3 Administration

| Page | Purpose |
|---|---|
| **Parent communication / Messages** | the per-learner conversation thread with parents and teachers |
| **Payments** (invoices) | create invoice **ledger** entries: number, amount in minor units, ISO currency, due date. SriSah does **not** collect money — pair it with your payment provider. |
| **Reports** | a printable progress summary for one learner: scores, attendance, homework completion, teacher observations |
| **Account profile** | your own admin details |

### 3.4 The first-run admin checklist

1. Create student profiles (first name, grade, country, curriculum, ≥1 subject).
2. Invite teachers and activate them.
3. Assign each teacher to the learners they teach, subject by subject.
4. Invite students from their profile.
5. Link additional verified parents by email (grandparents, guardians).
6. Schedule classes, assign homework, record attendance and share a learning update so every
   portal has content.
7. Distribute the family enrollment code only to verified families.
8. Record everything in the school's release log: date, who changed what, and why.

### 3.5 Operating rhythm

| Cadence | Task |
|---|---|
| Daily | read the enquiries inbox; answer parent messages; review submissions |
| Weekly | check attendance outliers; add learning updates; verify teachers recorded tests |
| Monthly | access review — remove assignments for staff who left, suspend leavers, confirm every parent link is still correct |
| Termly | export/archive reports, rotate the enrollment code if it was shared too widely, test a backup restore |

---

## 4. Parent

Sign in as a parent and the sidebar shows: *Child dashboard, Daily updates, Attendance,
Homework, Test results, Progress reports, Improvement plan, Upcoming classes, Messages,
Fees & payments, Student profile.*

| Page | What a parent sees and can do |
|---|---|
| **Child dashboard** | greeting, the selected child's homework completed percentage, average test score, attendance percentage, upcoming classes, recent teacher updates and the next practice steps. Use the **child selector** (top of the page) to switch between linked children. |
| **Daily updates** | teacher observations: what was learned, strengths, next steps, optional concept score |
| **Attendance** | each class with present / late / absent / excused status and the attendance percentage |
| **Homework** | assignments with due dates, submission status (`pending`, `submitted`, `reviewed`, `needs revision`), the child's submitted text and the teacher's feedback and score |
| **Test results** | every recorded assessment, score out of maximum, teacher note, and an overall average |
| **Progress reports** | a printable summary — use **Print view** |
| **Improvement plan** | practice steps with rhythm ("10 minutes daily"), due date and completion |
| **Upcoming classes** | scheduled online classes with time, duration and the meeting link |
| **Messages** | private thread with the teaching team for that learner. Your own messages are styled as "mine". |
| **Fees & payments** | the invoice ledger: number, amount, currency, due date, status |
| **Student profile** | edit the learner's details; invite the student to sign in; see which teachers are assigned |

**A parent can only ever see their own linked children.** Trying another learner's identifier
returns nothing — the database refuses the row before the API even sees it.

### Parent first-run checklist

1. Register with the school code + family enrollment code from the school.
2. Open the verification link from your email.
3. Create your child's profile (grade, curriculum, subjects, goals).
4. Invite your child to the student portal with their email address.
5. Confirm you can see homework, attendance and messages — if not, ask the school to assign a
   teacher and link your account.

---

## 5. Student

Sidebar: *My dashboard, My classes, Homework, Tests, Learning materials, My progress,
Practice plan, Teacher feedback, Messages, My profile.*

| Page | What a student sees and can do |
|---|---|
| **My dashboard** | own homework progress, test average, attendance, next classes, latest teacher feedback |
| **My classes** | scheduled sessions with the "Open online class" link |
| **Homework** | every assignment. **Submit** opens a text box; submitting (or resubmitting after `needs revision`) sends the work to the teacher |
| **Tests** | own results with score and teacher note |
| **Learning materials** | resources shared by teachers, filtered by subject |
| **My progress** | strengths and results together with next steps |
| **Practice plan** | practice steps; mark one **complete** when done |
| **Teacher feedback** | the learning updates written for this learner |
| **Messages** | the thread with teachers and parents |
| **My profile** | grade, curriculum, subjects, goals — read-only for students |

Students cannot create classes, assign homework, record attendance, add test results or write
learning updates: the API rejects those calls with `403 Forbidden`, and the database agrees.

---

## 6. Teacher

Sidebar: *Dashboard, Students, Classes, Homework, Tests, Attendance, Progress tracking,
Learning materials, Parent communication, Messages, Reports.*

| Page | What a teacher does |
|---|---|
| **Dashboard** | roster size, upcoming classes, submissions waiting for review, attendance percentage |
| **Students** | **the roster of assigned learners only** — if a learner is missing, ask the admin for an assignment |
| **Classes** | schedule a class: subject, title, topic, start time, duration (10–240 min), learners, HTTPS meeting link |
| **Homework** | assign homework with due date, instructions; review submissions, write feedback, give a 0–100 score, mark `reviewed` or `needs revision` |
| **Tests** | record results: subject, test/topic, score, maximum score, teacher note, date |
| **Attendance** | mark present / late / absent / excused for a class + learner, with an optional note |
| **Progress tracking** | the same progress view an admin sees, restricted to assigned learners |
| **Learning materials** | add HTTPS resources (link, document, video, interactive) for a subject |
| **Parent communication / Messages** | the per-learner conversation |
| **Reports** | printable per-learner progress report |

### Teacher workflow that matches the data model

1. Admin assigns you to a learner and a subject → the learner appears in **Students**.
2. Schedule a class → the learner (and their parents) see it in the class list.
3. Assign homework → it appears immediately for learner and parents with status `pending`.
4. Record attendance when the class happens.
5. Review the submission → feedback + `reviewed` or `needs revision`.
   `Needs revision` returns the work to the student, who can resubmit.
6. Record the test result and write a **learning update** with strengths and next steps.
7. Add practice steps so the improvement plan stays current.

---

## 7. Every form, field by field

### Student profile (parent, admin)
| Field | Required | Rules |
|---|---|---|
| First name | yes | ≤ 80 characters |
| Last name | no | ≤ 80 |
| Grade / Year level | yes | Grade 1–12 or Year 1–12 |
| Country | yes | ≤ 100 |
| School | no | ≤ 180 |
| Curriculum | yes | free text, e.g. CBSE, ICSE, IB, State board (≤ 120) |
| Current academic level | no | ≤ 800, e.g. "confident with fractions" |
| Subjects | yes | one or more of Mathematics, Science, English |
| Learning goals | no | ≤ 1500 |
| Areas needing improvement | no | one per line, up to 12 |

### Class (teacher, admin)
Subject (required, one of the three), title (required ≤ 160), topic, curriculum, start time
(required, must be in the future), duration 10–240 minutes (default 45), learners (1–40),
meeting link (**must be `https://`**).

### Homework (teacher, admin)
Learner (required), subject (required), title (required ≤ 180), instructions (≤ 3000), due
date. Students submit **text** only — file upload is intentionally not implemented, because
uploads need storage, scanning and retention rules first.

### Test result (teacher, admin)
Learner, subject, test or topic (required ≤ 180), score (required, 0 ≤ score ≤ maximum),
maximum score (> 0), teacher note, date taken (defaults to today).

### Attendance (teacher, admin)
Class (required, must be a real class), learner (required, must be enrolled in that class),
status (present / late / absent / excused), note (≤ 500). Marking the same learner again
updates the existing record.

### Learning update (teacher, admin)
Learner, subject, title, summary of what was learned (≤ 2500), teacher observation (≤ 1800),
strengths (one per line), next steps (one per line), optional concept check score / maximum.

### Practice step / improvement plan (teacher, admin)
Learner, subject, title, description (≤ 1200), practice rhythm (≤ 160, e.g. "10 min daily"),
due date.

### Learning material (teacher, admin)
Subject, title, curriculum, grade/year, description, HTTPS resource URL, resource type
(link / document / video / interactive).

### Invoice — ledger only (admin)
Learner, invoice number (unique per organization, ≤ 60), amount **in minor units** (e.g.
`450000` = ₹4,500.00), ISO currency (`INR`, `USD`, …), due date.

### Invitations
* **Invite a teacher / invite an account:** email + full name + account type, or learner for a
  student account.
* **Invite this learner to the student portal:** the student's email address.
* **Link a verified parent:** parent email (must already be a verified, active parent in this
  organization), relationship, and whether they are the primary contact.

---

## 8. What each role can and cannot see

The authority is enforced **twice**: in the API (role checks) and in PostgreSQL (row-level
security). Even if a request guessed a valid student identifier, the database would return
nothing.

| Data | Parent | Student | Teacher | Admin |
|---|---|---|---|---|
| Student profiles | only linked children | only own profile | only assigned learners | all in the organization |
| Homework, tests, attendance, updates, practice steps | linked children | own records | assigned learners | all |
| Messages | linked children | own thread | assigned learners | all |
| Invoices | linked children | — | — | all |
| Admissions enquiries | — | — | — | all |
| Create/edit student profile | own children | — | — | all |
| Assign homework, record tests/attendance, write updates & materials | — | — | assigned learners | all |
| Schedule classes | — | — | assigned learners | all |
| Submit homework | — | own | — | — |
| Delete a student record | — | — | — | yes |
| Invite an account | their child's student account | — | — | teachers + students |

---

## 9. Offline, printing and mobile

**Offline.** The installable app caches the application shell (HTML, CSS, JS, icons) so it
opens without a network. It deliberately **never** caches API responses or student records,
and it does not queue writes: if you submit homework while offline, the submission fails
clearly and you retry when you are back online. This is a privacy decision, not a bug.

**Printing.** Every list page has a **Print view** button. Print styles hide the sidebar,
top bar and toasts and force a white background — ideal for progress reports and invoices.

**Mobile.** The layout is responsive from 320 px upward and uses a bottom tab bar for quick
navigation. Install via Chrome's *Install app* (see
[Android testing](ANDROID-TESTING.md)), or use the Play Store build.

**Keyboard.** `Ctrl/⌘ + K` focuses the search field.
