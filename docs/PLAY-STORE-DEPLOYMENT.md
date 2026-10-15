# Google Play Store deployment — complete guide

How to take `android/` from this repository and publish **SriSah Schooling** on Google Play,
including the store listing, the data-safety form, the closed-testing requirement and the
review risks specific to an education WebView app.

Estimated first-release time: **3–5 weeks**, of which **14 days are a mandatory waiting
period** for new personal developer accounts (see §7). Do not plan a launch date before
you have read that section.

---

## 0. The short version

```sh
# 1. Deploy the web app to HTTPS first (docs/WEB-DEPLOYMENT.md) and confirm
#    https://your-school.example.com/api/health returns {"ok":true,"database":"ok"}

# 2. Point the Android app at that origin
echo 'SRISAH_APP_URL=https://your-school.example.com' >> .env
npm run android:configure

# 3. Create the upload key (once)
keytool -genkeypair -v -keystore ~/srisah-release.keystore -alias srisah \
  -keyalg RSA -keysize 4096 -validity 10000
cp android/keystore.properties.example android/keystore.properties   # then edit

# 4. Build the signed App Bundle
SRISAH_VERSION_CODE=1 SRISAH_VERSION_NAME=1.0.0 npm run android:release
# → android/app/build/outputs/bundle/release/app-release.aab

# 5. Upload the .aab in Play Console → Testing → Closed testing
```

The rest of this guide explains every one of those steps, the Play Console forms you must
complete, and what reviewers look for.

---

## 1. What you need before you start

| Requirement | Detail |
|---|---|
| Google Play developer account | one-time **US$25** registration fee, <https://play.google.com/console/signup> |
| Developer identity verification | required; for personal accounts Google also requires the *publishing developer* to be verified (rolling out from 30 September 2026). Start this early — it can take days |
| A working HTTPS deployment | Play reviewers will install your app and try to sign in; if your portal is down the release is rejected |
| Privacy policy URL | **mandatory** because the app handles personal data (names, emails, student records) |
| App icon 512×512 PNG | `web/public/icons/icon-512.png` — already generated |
| Feature graphic 1024×500 PNG | you must create this (see §8.2) |
| At least 2 phone screenshots | minimum 320 px, maximum 3840 px on the long edge |
| Support email address | shown publicly on the listing |
| Target API level 36 | already configured in `android/variables.gradle` (`targetSdkVersion = 36`) |
| App signing key | see §5 |

> **Policy check.** Google Play's rules change in August of most years (target API level) and
> occasionally in between. Before you upload, skim
> <https://support.google.com/googleplay/android-developer/answer/9859152> and the
> [Play Console policy centre](https://play.google.com/console/about/policycenter/).

---

## 2. Choose the packaging mode

A Capacitor app can ship in one of two ways. SriSah supports both, and `npm run android:configure`
switches between them.

### Mode A — hosted portal (default, fully functional) ✅

```dotenv
SRISAH_APP_URL=https://your-school.example.com
```

The WebView loads **your own HTTPS origin**, exactly like Chrome. Consequences:

* Sign-in, sessions, `SameSite=Lax` cookies, CSRF double-submit tokens, the content-security
  policy and the service worker all behave normally. **Everything works.**
* Content updates ship instantly — no new Play release needed for a UI fix.
* The app requires network connectivity to open; it is a secure client for your portal.

### Mode B — bundled shell (offline UI only)

No `SRISAH_APP_URL`. The compiled React app is packaged inside the APK/AAB. The UI renders
offline, but the app has no same-origin API, so it opens signed out and cannot load records.
Use this only as a design showcase or as the base for a future fully-offline implementation.

**Recommendation: ship Mode A.** It is the only mode that gives families a working app today,
and it is the mode this documentation assumes from here on.

### The one policy risk you must manage

Google Play's *Spam and Minimum Functionality* policy rejects apps that are "just a website"
with no additional value. A hosted WebView app can be flagged if a reviewer sees nothing more
than a login page pointing at a browser site. Reduce that risk:

* Keep the bundled shell in the APK (it is there either way) so the app boots with real UI
  even before the network responds.
* Add native capabilities that a browser shortcut does not have. SriSah already includes the
  splash screen and status-bar theming; natural next steps are **push notifications for
  homework and messages** (`@capacitor/push-notifications`) and **offline homework drafts**
  (`@capacitor/preferences`). Each one strengthens the "additional functionality" argument.
* In the store listing, describe it as the *school's official learning app*, not as
  "our website".
* Never ship an app whose only screen is a link to a marketing page — that is the classic
  rejection.

---

## 3. Prerequisites on the build machine

```sh
java -version            # must be 21
echo "$ANDROID_HOME"     # must point at an installed Android SDK
```

Installing the SDK without Android Studio is covered in
[BUILD-AND-TEST.md §4.1](BUILD-AND-TEST.md#41-one-time-prerequisites). The project targets
**API 36** (`android/variables.gradle`), which Google Play has required for new apps and
updates since **31 August 2026** — you are already compliant, and there is no extension to
request.

---

## 4. Set the identity values

Open `android/app/src/main/res/values/strings.xml`:

```xml
<string name="app_name">SriSah Schooling</string>
```

Open `capacitor.config.json` (or run `npm run android:configure`):

```json
{ "appId": "in.srisah.schooling", "appName": "SriSah Schooling" }
```

Rules that will cost you a release if you break them:

* **`appId` is permanent.** Once an app is published, the package/application ID can never be
  changed — a different ID means a different app. Decide it now; do not ship with a
  placeholder like `com.example.app`.
* The current ID, `in.srisah.schooling`, is fine. If your school owns a domain, prefer a
  reverse-domain ID you control, for example `in.yourschool.srisah`.
* Changing `appId` requires editing `capacitor.config.json`, then
  `android/app/build.gradle` (`namespace` and `applicationId`), the Java package folder
  `android/app/src/main/java/...` and `strings.xml`.

---

## 5. Create and protect the signing key

Google Play requires every bundle to be signed. Create the **upload key** once and keep it
forever.

```sh
keytool -genkeypair -v \
  -keystore ~/srisah-release.keystore \
  -alias srisah \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=SriSah Schooling, O=SriSah, L=City, ST=State, C=IN"
```

Then:

```sh
cp android/keystore.properties.example android/keystore.properties
```

```properties
storeFile=/home/you/srisah-release.keystore
storePassword=…
keyAlias=srisah
keyPassword=…
```

Golden rules:

* **Back up the keystore and both passwords** somewhere durable (password manager + offline
  copy). If you lose the upload key you can ask Google to reset it — you cannot recover it.
* **Never commit** `*.keystore`, `*.jks` or `keystore.properties`. `.gitignore` already blocks
  them; verify with `git status --short` before every push.
* On CI, prefer environment variables over the properties file:
  `SRISAH_KEYSTORE_FILE`, `SRISAH_KEYSTORE_PASSWORD`, `SRISAH_KEY_ALIAS`, `SRISAH_KEY_PASSWORD`.
* Enrol in **Play App Signing** (the default for new apps). Google holds the *app signing*
  key; your upload key stays with you and can be reset if compromised.

---

## 6. Build the App Bundle

```sh
SRISAH_VERSION_CODE=1 SRISAH_VERSION_NAME=1.0.0 npm run android:release
```

That runs, in order: the web build for Android → `cap sync android` → `gradlew bundleRelease`.
Output:

```
android/app/build/outputs/bundle/release/app-release.aab
```

Checklist before uploading:

- [ ] `web/dist-android` contains `index.html`, `assets/`, `icons/`, `manifest.webmanifest`, `sw.js`
- [ ] `android/app/src/main/assets/public/` matches it (created by `cap sync`)
- [ ] `versionCode` is **greater than** the last uploaded version (integers only, max 2100000000)
- [ ] `versionName` is what users will see, e.g. `1.1.0`
- [ ] the `.aab` is signed (`jarsigner -verify -verbose -certs app-release.aab`)
- [ ] `SRISAH_APP_URL` pointed at the **production** origin, not staging

### Optional: test the exact Play build on a device

```sh
bundletool build-apks --bundle=app-release.aab --output=srisah.apks \
  --ks=~/srisah-release.keystore --ks-key-alias=srisah
bundletool install-apks --apks=srisah.apks
```

Or simply use the debug APK from `npm run android:apk` for functional testing and the
internal-testing track for the signed bundle.

---

## 7. Play Console: create the app and upload

### 7.1 Create the app

1. Play Console → **Create app**.
2. App name: `SriSah Schooling`. Default language: English (India) or English (US).
3. Type: **App**. Free (you cannot switch to paid later).
4. Accept the developer programme policies and US export laws.

### 7.2 Dashboard tasks (Play walks you through these)

| Task | What to enter for SriSah |
|---|---|
| App access | "All functionality is available without special access? **No**" — then provide a working **test admin account** (email + password) and the sign-in steps. Reviewers must be able to reach the portal. **This is the single most common rejection cause for school apps.** |
| Ads | No ads |
| Content rating | Complete the questionnaire: category *Education*; no violence, no user-generated public content, no data sharing with third parties. Expect **Everyone / 3+** |
| Target audience | Age groups 13+ (or 5+ if the school operates a junior programme). If you select **children under 13**, you enter the *Families* programme with much stricter rules (no personal data collection without verified consent) — for a school app used by minors, choose the target audience carefully and, where possible, keep the app **for parents and teachers** and keep students on the supervised web portal |
| News app | No |
| COVID-19 apps | No |
| Data safety | see §8.3 — mandatory |
| Government apps | No |
| Financial features | **No** (the invoice screen is a ledger only; no payments are collected) |
| Health | No |
| Privacy policy | paste your HTTPS privacy-policy URL |
| Store settings | category *Education*, tags *Education*, contact email |

### 7.3 Upload to a testing track first

Play Console → **Testing → Internal testing → Create new release** → upload the `.aab` →
add yourself as a tester → install from the opt-in link → run the
[Android testing checklist](ANDROID-TESTING.md) on a real device.

Then move to **Closed testing** (see §7.4), and finally **Production**.

### 7.4 The 12-testers / 14-days rule (read this or lose three weeks)

If your developer account is a **personal** account created **after 13 November 2023**, Google
requires a completed closed test before it will grant production access:

* **at least 12 testers** on real devices with real Google accounts, **opted in** — emulators,
  duplicate accounts and bots do not count;
* **continuously opted in for 14 consecutive days**;
* the 14-day clock starts only after the release is approved *and* 12 testers have joined;
* if the count drops below 12, their time resets; recruit **16–20** people so drop-outs do not
  cost you the window;
* internal testing does **not** count;
* the rule is per app **and** per account — your next app needs its own closed test.

Organization/company accounts and personal accounts created on or before 13 November 2023 are
exempt. If your school has a legal entity, an **organization account** (with a D-U-N-S number)
avoids the whole process.

Plan for it: recruit 16+ teacher/parent testers, publish the closed test, wait 14 days, then
**Publishing overview → Request production access** and answer the questionnaire honestly
(describe the portal, the closed-test feedback, the target audience).

### 7.5 Production release

1. **Production → Create new release** → upload the same `.aab` (or a newer one).
2. Release name: `1.0.0`.
3. Release notes (max 500 characters each, per language).
4. Countries/regions: select India (and any others you serve).
5. **Send for review.** Typical first review: 1–7 days; expect longer for education apps with
   a login wall.

---

## 8. The store listing

### 8.1 Copy you can adapt

**App name (30 characters max)**
```
SriSah Schooling
```

**Short description (80 characters max)**
```
Homework, classes, attendance and progress for SriSah families and teachers.
```

**Full description (4000 characters max)**
```
SriSah Schooling is the official learning app for SriSah students, parents and teachers.

Everything a family needs to follow learning progress, in one secure place:

FOR PARENTS
• Daily teacher updates and observations
• Homework, submissions and teacher feedback
• Test results, progress reports and improvement plans
• Attendance records and upcoming class schedule
• Secure messages with your child's teachers
• Fee invoices and payment status (ledger view)

FOR STUDENTS
• Your classes, homework and learning materials
• Submit homework and receive feedback
• See your test results and progress
• Practice plans built for your next goal

FOR TEACHERS
• The roster of learners assigned to you
• Schedule classes, assign homework, record attendance
• Share learning updates and practice plans
• Review submissions and give feedback

PRIVACY FIRST
• Role-based access: parents see only their own children, teachers only their assigned learners
• Everything runs over HTTPS with secure, revocable sessions
• No advertising, no third-party trackers, no data sold

Access is provided by SriSah. Parents receive a family enrollment code from the school;
teacher and student accounts are issued by the school administrator.
```

### 8.2 Graphics

| Asset | Size | Tip |
|---|---|---|
| App icon | 512×512 PNG | use `web/public/icons/icon-512.png` |
| Feature graphic | 1024×500 PNG/JPEG | violet background `#3c1f7a`, the book logo and the words "SriSah Schooling — Learn. Improve. Achieve." |
| Phone screenshots | 2–8, 320–3840 px | use the violet UI: dashboard, homework, progress, messages. Capture at 1080×1920 |
| Tablet screenshots | optional but improves ranking on tablets | the layout is responsive; capture at 1200×1920 |
| Promo video | optional | skip for the first release |

Take screenshots from a **real device or an emulator** with real (but synthetic) test data —
never real student names or photos. Redact emails and phone numbers.

### 8.3 Data safety form (answers for SriSah)

| Question | Answer |
|---|---|
| Does your app collect or share user data? | **Yes** (collected, not shared) |
| Data types collected | *Personal info*: name, email address, user IDs · *App activity*: in-app actions (homework submissions, messages) · *App info and performance*: crash logs (only if you enable crash reporting) |
| Data shared with third parties | **No** (email delivery through Resend is a *service provider* that acts on your behalf; declare it as a processor, not a data sale) |
| Is data encrypted in transit? | **Yes** — HTTPS only, cleartext is blocked in `network_security_config.xml` |
| Can users request data deletion? | **Yes** — state the process (email the school administrator; accounts and records are deleted on request) |
| Is data collected for advertising? | No |
| Is data collection optional? | Account data is required to use the service; everything else is optional |
| Committed to Play Families policy? | Only if you selected an under-13 target audience |

Keep these answers consistent with your privacy policy — mismatches are a common suspension
cause.

### 8.4 Content rating questionnaire

Category **Education / Reference**. Answer *No* to violence, sexuality, language, controlled
substances, gambling and simulated gambling. Answer **Yes** to "does the app allow users to
share information or communicate?" (the messages feature) and to "does the app allow users to
interact online?" — the rating stays low (Everyone / 3+) but the declaration must be truthful.

---

## 9. Releasing updates

```sh
# 1. ship any server-side change first — hosted mode updates instantly
# 2. bump the Android version
SRISAH_VERSION_CODE=2 SRISAH_VERSION_NAME=1.1.0 npm run android:release
```

Then Play Console → **Production → Create new release → upload → review**.

| Rule | Detail |
|---|---|
| `versionCode` | must increase every upload; it is what Play uses to compare builds |
| `versionName` | user-visible; semantic versioning is fine |
| Staged rollout | use 10% → 50% → 100% for risky changes |
| Target API | must be 36+ for uploads; re-check every August |
| Data safety | update the form whenever you add a data type (for example push tokens) |
| Stop rollouts | **Halt rollout** stops new installs; you cannot un-publish a version already installed |

Because the app is a WebView client, most bug fixes need **no** Play release at all — deploy
the server and every installed app picks up the change on next launch. Only native changes
(icon, splash, permissions, new plugin) require a new bundle.

---

## 10. Review rejections and how to avoid them

| Rejection reason | Cause | Prevention |
|---|---|---|
| "App access" / cannot evaluate | reviewer could not sign in | provide a working test account **and** keep it active; mention the enrollment code needed |
| Minimum functionality / Spam | app looked like a bare website wrapper | ship the bundled shell, add native features (§2), describe it as the school's official app |
| Data safety mismatch | declared "no data collected" while collecting names/emails | fill the form as in §8.3 |
| Broken functionality | API unreachable during review | keep the deployment up and monitored; check `/api/health` |
| Missing privacy policy | no URL, or one that does not mention the app | host a policy page describing what SriSah collects and how to delete it |
| Target API too low | built with an old SDK | this project targets 36 — do not lower it |
| Sensitive permissions | requesting location/camera/storage without need | SriSah requests only `INTERNET` |
| Families policy violation | collecting data from under-13s without a Families-compliant flow | prefer a 13+ / parent-and-teacher audience, or implement verifiable parental consent |

If a release is rejected, fix the issue, bump `versionCode`, rebuild and resubmit. Repeated
rejections can lead to account suspension, so treat the reviewer notes as the priority.

---

## 11. Cost and timeline summary

| Item | Cost | Time |
|---|---|---|
| Play registration | US$25 once | minutes (verification: 1–3 days) |
| Identity/organization verification | free | 1–14 days |
| Web deployment | from US$5/month VPS, or free tiers | 1 day |
| Closed testing | free | **14 consecutive days** (personal accounts) |
| First review | free | 1–7 days |
| Each update | free | hours to 3 days |

Realistic first launch: **3–5 weeks** end to end, dominated by verification and the closed
test.

---

## 12. After launch

* Watch **Play Console → Android vitals** for crashes and ANRs.
* Set up the account-deletion route you promised in the data-safety form.
* Monitor your API uptime; a dead API makes the installed app look broken.
* Keep an eye on the annual target-API deadline every August.
* Revisit permissions and the data-safety form each time you add a native feature.
