/**
 * Configure the Android (Play Store) build.
 *
 * SriSah ships as a Capacitor WebView app. There are two supported modes:
 *
 *  hosted  (recommended, fully functional)
 *      SRISAH_APP_URL=https://your-school.example.com
 *      The WebView loads your own HTTPS deployment, so sessions, CSRF protection,
 *      SameSite cookies and the content security policy behave exactly as they do in
 *      Chrome. Sign-in, homework, messages and payments all work unchanged.
 *
 *  bundled (offline shell only)
 *      No SRISAH_APP_URL. The compiled React shell is packaged inside the app. The UI
 *      renders, but account data cannot load because the app has no same-origin API.
 *
 * Usage:
 *   node scripts/android-configure.mjs            # read SRISAH_APP_URL from env/.env
 *   node scripts/android-configure.mjs --bundled  # force bundled mode
 *   node scripts/android-configure.mjs --show     # print the current configuration
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'capacitor.config.json');
const args = new Set(process.argv.slice(2));

function readEnvFile() {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith('#')) continue;
    values[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return values;
}

function parseOrigin(value, label) {
  if (!value) return null;
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${label} must be an absolute URL such as https://school.example.com`); }
  if (parsed.protocol !== 'https:') throw new Error(`${label} must use HTTPS. Google Play and SriSah both require an encrypted origin.`);
  if (parsed.username || parsed.password) throw new Error(`${label} must not contain credentials.`);
  return parsed.origin;
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const env = { ...readEnvFile(), ...process.env };
const appUrl = args.has('--bundled') ? null : parseOrigin(String(env.SRISAH_APP_URL || '').trim(), 'SRISAH_APP_URL');
const allowNavigation = String(env.SRISAH_ALLOW_NAVIGATION || '').split(',').map((value) => value.trim()).filter(Boolean);

if (args.has('--show')) {
  console.log(JSON.stringify(config, null, 2));
  process.exit(0);
}

config.android = config.android || {};
config.android.allowMixedContent = false;
config.server = config.server || {};
config.server.androidScheme = 'https';

if (appUrl) {
  config.server.url = `${appUrl}/portal`;
  config.server.cleartext = false;
  // Keep in-app navigation inside the WebView for the school's own hosts only.
  config.server.allowNavigation = [...new Set([new URL(appUrl).hostname, ...allowNavigation])];
  console.log(`Android app will load the hosted portal at ${appUrl}/portal`);
} else {
  delete config.server.url;
  delete config.server.allowNavigation;
  console.warn('Building the bundled offline shell: the app will open signed out because it has no same-origin API.');
  console.warn('Set SRISAH_APP_URL in .env to ship the fully functional hosted app.');
}

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Updated ${path.relative(root, configPath)}`);
