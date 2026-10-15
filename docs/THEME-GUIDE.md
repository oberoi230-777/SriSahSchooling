# Theme guide — the violet / purple brand

SriSah now ships a violet/purple brand instead of the original forest-green one. This guide
explains exactly where every colour lives, what was changed, how to change it again, and how
the icons and splash screens are produced.

---

## 1. The palette

All seven brand colours are declared once, at the top of the main stylesheet
(`web/src/styles.css`). **Changing these seven values re-skins the entire app**, including
the browser build and the Android app.

```css
:root {
  --violet:        #3c1f7a;  /* sidebar, splash screen, deep brand surfaces   */
  --violet-dark:   #2a1455;  /* pressed states, deep gradients                */
  --violet-soft:   #53309c;  /* hover on dark surfaces                        */
  --purple:        #6d3fd1;  /* primary buttons, links, active navigation     */
  --purple-bright: #c9a7ff;  /* accents and highlights on dark backgrounds    */
  --purple-pale:   #f1eafd;  /* tinted chips, badges, table stripes           */
  --canvas:        #f7f5fc;  /* page background                               */

  /* supporting neutrals, tinted violet so the greys match the brand */
  --white:         #ffffff;
  --ink:           #221636;  /* headings and body text                        */
  --ink-soft:      #37294d;
  --muted:         #6f6385;  /* secondary text                                */
  --muted-light:   #8d819f;
  --line:          #eae5f5;  /* borders                                       */
  --line-dark:     #ddd5ee;
}
```

Two extra variables drive interactive states:

```css
:root {
  --focus-ring:     0 0 0 3px rgba(109, 63, 209, .28);
  --brand-gradient: linear-gradient(135deg, #6d3fd1 0%, #8f5cf0 100%);
}
```

### Contrast (WCAG)

| Foreground | Background | Ratio | Level |
|---|---|---|---|
| `#ffffff` text | `#3c1f7a` sidebar | **12.6:1** | AAA |
| `#c9a7ff` accent | `#3c1f7a` sidebar | **6.3:1** | AA (large + normal) |
| `#ffffff` text | `#6d3fd1` primary button | **6.4:1** | AA |
| `#4a2596` text | `#ffffff` dark button | **10.5:1** | AAA |
| `#221636` body text | `#f7f5fc` canvas | **15.7:1** | AAA |
| `#6f6385` secondary text | `#f7f5fc` canvas | **5.1:1** | AA |
| `#6d3fd1` link | `#f7f5fc` canvas | **5.9:1** | AA |

Every text pair the UI actually uses meets WCAG 2.1 AA. If you change a colour, keep the
foreground/background ratio at **4.5:1 or better** for body text and **3:1** for large text.

---

## 2. What was changed

| Surface | Before (green) | After (violet) | File |
|---|---|---|---|
| Brand tokens | `--forest`, `--green`, `--green-bright`, `--green-pale` | `--violet`, `--purple`, `--purple-bright`, `--purple-pale` | `web/src/styles.css`, `src/styles.css` |
| Sidebar gradient | `#173d32 → #12342b` | `#3c1f7a → #2a1455` | `web/src/styles.css` |
| Primary button | `#48356a` | `#6d3fd1` (hover `#5c33bb`) | `web/src/styles.css` |
| Brand mark / logo chip | green→lime gradient | `#c9a7ff → #8f5cf0` gradient | `web/src/styles.css` |
| Active navigation | green tint | `rgba(157,120,240,.22)` + `#b98cff` bar | `web/src/styles.css` |
| Focus rings | none | 2px `#6d3fd1` outline + soft ring | `web/src/styles.css` (brand layer at the end) |
| Every tint, border, chart and chip colour | green/teal family | hue-remapped to 262° at identical lightness | both stylesheets |
| Browser chrome colour | `#173d32` | `#3c1f7a` | `web/index.html`, `index.html` |
| PWA manifest | `theme_color #173d32`, green icons | `#3c1f7a`, violet icons | `web/public/manifest.webmanifest` |
| App icon + favicon | green book | violet book | `web/public/icons/*`, `android/app/src/main/res/**` |
| Android theme + splash | white/green stock Capacitor | violet brand, violet splash | `android/app/src/main/res/values/*` |
| Android launch screen | stock Capacitor splash | gradient violet with the book logo | `android/app/src/main/res/drawable*/splash.png` |

Nothing else about the layout, spacing, typography or behaviour changed. The conversion was
done by

1. remapping every **green/teal** colour to **hue 262° at the same saturation and lightness**,
   so every tint, shade and gradient keeps its contrast, and
2. re-stating the accent surfaces (buttons, links, focus rings, sidebar, navigation) with the
   new brand values, and
3. leaving **semantic** colours untouched: reds stay red (errors, absent, overdue), ambers
   stay amber (warnings, needs-revision), yellows stay yellow. A "needs revision" badge must
   never look like a brand colour.

A second copy of the stylesheet lives at `src/styles.css`. That file belongs to the original
standalone design mock-up (see `README.txt`) and is **not** part of the shipped build; it was
converted too so the two never look different.

---

## 3. Change the theme again (3 minutes)

1. Open `web/src/styles.css` and edit the seven variables (and the neutrals if you like).
2. If you changed the *primary* purple, also update these four places so the native app
   matches:
   * `web/index.html` and `index.html` → `<meta name="theme-color">`
   * `web/public/manifest.webmanifest` → `theme_color` and `background_color`
   * `android/app/src/main/res/values/colors.xml` → `colorPrimary`, `colorPrimaryDark`,
     `colorAccent`, `ic_launcher_background`
   * `android/app/src/main/res/values/styles.xml` → splash background colour
3. Rebuild:

```sh
npm run build          # browser build
npm run android:sync   # copy the new UI into the Android project
```

Useful extras while experimenting:

* `--canvas` controls the page background (light violet today).
* `--line` / `--line-dark` control every border and divider.
* `--ink` / `--muted` control text; keep `--muted` at 4.5:1 against `--canvas`.
* `.sidebar` in the same file holds the dark navigation gradient.
* The block at the **end** of the file (`SriSah violet brand layer`) is where accent
  overrides live — edit it there rather than hunting through 1,400 lines.

### Add a dark mode (optional)

The app is light-only today. To add dark mode you would duplicate the token block into a
`@media (prefers-color-scheme: dark)` block and set `--canvas: #150c28; --white: #1e1338;
--ink: #f3eeff; --line: #33245a`. Nothing else in the CSS needs to change because everything
is token-driven — verify with `npm run test:render`, which fails if the compiled stylesheet
loses the violet accent.

---

## 4. Icons and splash screens

All icons are generated from one vector description, so they can never drift apart.

```
tools/make-icons.py            ← the generator (pure Python, no image libraries)
web/public/icons/icon.svg      ← the source artwork (512×512, also shipped as a favicon source)
```

Regenerate everything:

```sh
npm run icons          # python3 tools/make-icons.py
```

What it writes:

| Output | Purpose |
|---|---|
| `web/public/icons/icon-192.png`, `icon-512.png` | PWA manifest, Android Chrome install |
| `web/public/icons/icon-maskable-192.png`, `icon-maskable-512.png` | Android adaptive/maskable install icon |
| `web/public/icons/apple-touch-icon.png` | iOS/iPadOS home-screen icon |
| `android/.../mipmap-*/ic_launcher.png`, `ic_launcher_round.png` | legacy Android launcher icon (48dp at 5 densities) |
| `android/.../mipmap-*/ic_launcher_foreground.png` | adaptive-icon foreground (108dp canvas, 72dp safe zone) |
| `android/.../drawable*/splash.png` | launch screens, portrait + landscape, 5 densities |

It takes about **7 minutes** because it anti-aliases every pixel in pure Python, and only the
`mipmap-*` outputs need re-running when you tweak the adaptive icon. Speed it up when
iterating:

```sh
ONLY=foreground python3 tools/make-icons.py   # adaptive foregrounds only
ONLY=splash     python3 tools/make-icons.py   # launch screens only
ONLY=web        python3 tools/make-icons.py   # browser/PWA icons only
```

To change the artwork itself, edit `web/public/icons/icon.svg` for the browser and the
geometry block (`# --- geometry ---`) at the top of `tools/make-icons.py` for the rasters.
The generator draws: rounded violet square → two book pages → spine → three rule lines per
page → a bookmark ribbon.

---

## 5. Where the theme shows up per surface

| Surface | What the user sees |
|---|---|
| Browser (desktop) | violet sidebar, violet primary buttons, light violet canvas, violet focus rings |
| Browser (mobile) | same, plus violet `theme-color` status bar on Android Chrome |
| Installed PWA | violet Android status bar, violet splash background, maskable violet icon |
| Native Android app | violet splash screen with the book logo, violet status bar, violet launcher icon, violet task-switcher header |
| Print / "Print view" button | forced white background, navigation and toasts hidden (print styles at the end of the stylesheet) |
| Windows scripts | unaffected (command-line only) |

---

## 6. Verifying the theme

```sh
npm run test:render
```

This compiles the real application and asserts that

* the sign-in screen renders without runtime errors,
* `#6d3fd1` is present in the compiled stylesheet, and
* the legacy forest green `#173d32` no longer appears anywhere in the CSS.

To check the public design, open <http://localhost:5173>. To check the portal theme, open <http://localhost:5173/portal> — the sidebar should be deep violet and the "Sign in securely" button bright purple.
