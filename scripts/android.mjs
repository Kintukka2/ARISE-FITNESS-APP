/**
 * Generate the Android shell from the web build. `android/` is build output:
 * regenerated every time, never committed, never hand-edited.
 *
 *   node scripts/android.mjs            # android/ ready for Android Studio
 *   node scripts/android.mjs --apk      # ...and a debug APK (needs the Android SDK)
 *   node scripts/android.mjs --bundle   # ...and a release AAB, signed if ARISE_KEYSTORE is set
 *
 * Signing reads ARISE_KEYSTORE, ARISE_KEYSTORE_PASSWORD, ARISE_KEY_ALIAS, ARISE_KEY_PASSWORD.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const known = new Set(['--apk', '--bundle']);
for (const a of args) if (!known.has(a)) { console.error(`Unknown argument ${a}`); process.exit(2); }

const run = (cmd, cwd = '.') => { console.log(`$ ${cmd}`); execSync(cmd, { stdio: 'inherit', cwd }); };
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const [maj, min, pat] = version.split('.').map(Number);
const code = maj * 10000 + min * 100 + pat;

run('npm run build');
rmSync('android', { recursive: true, force: true });
run('npx cap add android');
run('npx --yes @capacitor/assets@3 generate --android --iconBackgroundColor "#04060f" --splashBackgroundColor "#04060f"');

// The white status-bar silhouette the reminders use.
const DPI = { 24: 'mdpi', 36: 'hdpi', 48: 'xhdpi', 72: 'xxhdpi', 96: 'xxxhdpi' };
for (const [px, dpi] of Object.entries(DPI)) {
  const dir = `android/app/src/main/res/drawable-${dpi}`;
  mkdirSync(dir, { recursive: true });
  copyFileSync(`resources/android/notify-${px}.png`, `${dir}/ic_stat_arise.png`);
}

// Version, portrait, and release signing from the environment.
const gradle = 'android/app/build.gradle';
let g = readFileSync(gradle, 'utf8');
g = g.replace(/versionCode \d+/, `versionCode ${code}`).replace(/versionName "[^"]*"/, `versionName "${version}"`);
if (process.env.ARISE_KEYSTORE) {
  g = g.replace(/buildTypes \{/, `signingConfigs {
        release {
            storeFile file(System.getenv("ARISE_KEYSTORE"))
            storePassword System.getenv("ARISE_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ARISE_KEY_ALIAS")
            keyPassword System.getenv("ARISE_KEY_PASSWORD")
        }
    }
    buildTypes {`).replace(/release \{\n(\s+)minifyEnabled/, `release {\n$1signingConfig signingConfigs.release\n$1minifyEnabled`);
}
writeFileSync(gradle, g);
const manifest = 'android/app/src/main/AndroidManifest.xml';
writeFileSync(manifest, readFileSync(manifest, 'utf8').replace('<activity', '<activity\n            android:screenOrientation="portrait"'));

run('npx cap sync android');
if (!existsSync('android/app/src/main/assets/public/index.html')) throw new Error('The web build did not land in android/.');

if (args.has('--apk')) run('./gradlew assembleDebug', 'android');
if (args.has('--bundle')) run('./gradlew bundleRelease', 'android');
console.log(`Android ${version} (${code}) ready in android/`);
