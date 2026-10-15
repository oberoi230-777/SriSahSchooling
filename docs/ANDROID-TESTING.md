# Android testing checklist

SriSah reaches Android two ways, and **both must be verified** before a school release:

1. **Native app** — the Capacitor WebView app in `android/`, published to Google Play
   (`in.srisah.schooling`).
2. **Installable PWA** — the same portal installed from Chrome over HTTPS.

Neither is an offline data app: both keep all school records on the server and cache only the
application shell.

---

## Before testing

- [ ] A production build is deployed at the HTTPS origin configured in `SRISAH_APP_URL`.
- [ ] `curl https://<origin>/api/health` returns `{"ok":true,"database":"ok"}`.
- [ ] You are using a **non-production** school/database with synthetic test data only.
- [ ] Test accounts exist: one admin, two parents with different children, two students, two
      teachers with different assignments.
- [ ] Email delivery works, or you have the development console links.
- [ ] Devices: at least one phone (Android 12 or newer), ideally one tablet, plus a large-font
      and small-screen check.

Never use real student names, photos or records in a shared test environment.

---

## Part 1 — Native app

### 1.1 Build and install

```sh
npm run android:apk                     # debug APK
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Debug builds use the `.debug` application-ID suffix, so they can coexist with a Play build.

For the exact Play artifact:

```sh
npm run android:release                 # signed .aab
# or test it locally:
bundletool build-apks --bundle=android/app/build/outputs/bundle/release/app-release.aab \
  --output=srisah.apks --ks=~/srisah-release.keystore --ks-key-alias=srisah
bundletool install-apks --apks=srisah.apks
```

### 1.2 Install and launch

- [ ] The app appears in the launcher with the violet book icon (not a generic Android icon).
- [ ] Tapping it shows the **violet splash screen** with the logo, then the portal.
- [ ] The status bar is violet with light text; the app name reads "SriSah Schooling".
- [ ] First launch shows the sign-in screen (or the loading state), not a blank white page.
- [ ] Rotate the device: the layout reflows, nothing is cut off, no restart of the app.
- [ ] Press the system back button from the dashboard: the app exits cleanly (no blank screen).
- [ ] Open the task switcher: the app thumbnail shows the violet UI, and the recents title is
      "SriSah Schooling".

### 1.3 Role and privacy smoke checks

Run the same checks against the native app that the browser receives; the WebView uses the
same cookies and the same origin, so behaviour must match exactly.

- [ ] **Parent A:** open profile, homework, results, attendance, progress, messages. Switch
      between linked children. Confirm no unlinked child is selectable or visible.
- [ ] **Parent B:** in a second account, try a known Parent A student UUID by editing a query
      in remote debugging. It must return empty/404, never data.
- [ ] **Student:** only their own records; submit homework; confirm the status changes to
      `submitted`; after the teacher marks `needs revision`, confirm resubmission works.
- [ ] **Teacher:** only assigned learners; create a class, homework, assessment, attendance and
      learning update; try an unassigned learner — it must fail.
- [ ] **Admin:** invite a teacher/student, assign a teacher, link a parent, schedule a class,
      create an invoice ledger entry, triage an enquiry.
- [ ] **Messages:** each participant sees only the thread for their learners; the signed-in
      sender is styled as "mine".
- [ ] **Auth:** invalid/expired links, verification, accepted invitations, login/logout,
      forgot/reset password, weak password rejection, rate limiting.

### 1.4 Connectivity and lifecycle

- [ ] Enable airplane mode, launch the app: the shell may render, but account data must not —
      and the failure must be a clear message, not a hang.
- [ ] Re-enable the network and retry: the portal recovers without reinstalling.
- [ ] Switch Wi-Fi ↔ mobile data mid-session: the next action still works.
- [ ] Background the app for 30 minutes, reopen: the 12-hour session is still valid.
- [ ] Rotate through several school days: no duplicate submissions from tapping Submit twice.

### 1.5 Device, accessibility and store checks

- [ ] Installation size is reasonable (the APK/AAB contains the web shell only).
- [ ] Large display/text scaling (Settings → Display → Font size *Largest*): no overlapping
      text, no unreachable buttons.
- [ ] Soft keyboard: opening a message or homework text box does not hide the input or the
      submit button (`windowSoftInputMode="adjustResize"`).
- [ ] Play Store listing renders: icon, feature graphic, screenshots, description.
- [ ] The Play **App access** form contains working credentials a reviewer can use.
- [ ] No extra runtime permissions are requested (only network access).

---

## Part 2 — Installable PWA

1. Open the HTTPS portal in Chrome for Android and sign in.
2. Chrome menu → **Install app** / **Add to Home screen** (wording varies).
3. Launch from the home screen: it must open standalone (no browser address bar).
4. Confirm the violet theme colour, the maskable icon (no white square behind the logo) and
   the splash background.
5. Repeat for parent, student and teacher accounts; test portrait and landscape.

### Offline behaviour (PWA)

- [ ] With assets loaded once, enable airplane mode and relaunch: the shell appears.
- [ ] Confirm **no** API response is served from cache — records must fail clearly.
- [ ] Restore connectivity and refresh: the portal returns without duplicate writes.

### Update behaviour (PWA)

- [ ] Deploy a small change, reopen the installed app twice: the new version appears
      (the shell cache is versioned as `srisah-shell-v2`).
- [ ] If it does not, confirm the service worker re-registered and hard-refresh once.

---

## Part 3 — Browser-based device emulation (quick pass)

Chrome DevTools device emulation is useful for CSS and viewport checks (Pixel 7, Galaxy S20,
small 320 px phone, tablet, landscape) but it does **not** replace a physical device: install
prompts, soft keyboards, real network transitions, Play services and the native splash screen
cannot be emulated.

---

## Release log (copy for each release)

| Field | Value |
|---|---|
| App version / versionCode | |
| Portal commit / release | |
| API origin | |
| Device(s), Android version | |
| Chrome / WebView version | |
| Test role(s) | |
| Closed-testing track | |
| Pass / fail + notes | |
| Tester name and date | |
