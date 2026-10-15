/**
 * Build the web bundle that gets packaged inside the Android app.
 *
 * Output goes to web/dist-android (see vite.config.js) so packaging the native app never
 * overwrites the browser build in web/dist. Run through `npm run android:sync`.
 */
process.env.BUILD_TARGET = 'android';
const { build } = await import('vite');
await build({ configFile: 'vite.config.js' });
