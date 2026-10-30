/**
 * Smoke test: plays a brand-new hunter from the splash screen through the
 * licence, the Awakening, the practice Gate and a first real Gate, in a real
 * Chromium at phone size. Fails on any console error or a step that never
 * arrives. Screenshots land in e2e/out/.
 *
 *   npm run build && npm run smoke
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4179;
const OUT = 'e2e/out';
mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve());
  server.on('exit', reject);
  setTimeout(resolve, 4000);
});

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

let shot = 0;
const snap = async (name) => page.screenshot({ path: `${OUT}/${String(++shot).padStart(2, '0')}-${name}.png` });
const sleep = (ms) => page.waitForTimeout(ms);
const visible = (sel) => page.locator(sel).first().isVisible().catch(() => false);
async function hold(sel, ms) {
  const box = await page.locator(sel).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
}

/** Close whatever the System has put on screen: tours, windows, holds. */
async function drain(max = 60) {
  let quiet = 0;
  for (let i = 0; i < max && quiet < 5; i++) {
    await sleep(140);
    if (await visible('.sysgate .holdbtn')) { quiet = 0; await hold('.sysgate .holdbtn', 5600); await sleep(1700); continue; }
    if (await visible('.syswin__foot .btn--primary')) { quiet = 0; await page.locator('.syswin__foot .btn--primary').first().click(); continue; }
    if (await visible('.syswin__foot .btn')) { quiet = 0; await page.locator('.syswin__foot .btn').last().click(); continue; }
    if (await visible('.syswin')) { quiet = 0; await page.locator('.syswin').first().click(); await sleep(150); continue; }
    if (await visible('.tour')) { quiet = 0; await page.locator('.tour').click({ position: { x: 20, y: 20 } }); continue; }
    quiet++;
    continue;
  }
}
async function tapCoachUntil(sel, max = 30) {
  for (let i = 0; i < max && !(await visible(sel)); i++) { await page.locator('.coachcard').first().click(); await sleep(140); }
  if (!(await visible(sel))) throw new Error(`NEVER ARRIVED: ${sel}`);
}
const nav = (k) => page.locator(`[data-nav="${k}"]`).click();

/** Open a gate from the board, play it through, and leave. Only the practice gate must be won. */
async function raidGate(row, name) {
  await page.locator(row).first().click();
  await sleep(500);
  await snap(`${name}-brief`);
  await page.locator('text=Enter The Gate').click();
  await drain();
  await page.waitForSelector('.arena');
  await sleep(1800);
  await snap(`${name}-arena`);
  if (await visible('.seg__btn')) await page.locator('.seg__btn', { hasText: 'Skip' }).click();
  for (let i = 0; i < 12; i++) {
    await page.waitForSelector('.arena__foot .btn', { timeout: 20000 });
    if (await visible('text=Claim The Gate')) { await page.locator('text=Claim The Gate').click(); break; }
    if (await visible('text=Carried Out')) {
      if (name === 'practice') throw new Error(`LOST ${name.toUpperCase()}`);
      await page.locator('text=Carried Out').click();
      break;
    }
    await page.locator('text=Press On').click();
    await sleep(300);
  }
  await page.waitForSelector('.arena--results');
  for (const f of await page.locator('.flip').all()) await f.click();
  await sleep(500);
  await snap(`${name}-results`);
  await page.locator('text=Leave The Gate').click();
  await drain();
}

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('.awaken--splash');
  await sleep(2600);
  await snap('splash');
  await page.locator('.awaken--splash').click();

  await tapCoachUntil('#hunter-name');
  await page.fill('#hunter-name', 'Kintukka');
  await snap('licence');
  await page.locator('form button[type=submit]').click();
  await tapCoachUntil('text=Leave The Office');
  await snap('handover');
  await page.locator('text=Leave The Office').click();

  await page.waitForSelector('.sysgate .holdbtn', { timeout: 8000 });
  await sleep(300);
  await snap('awakening');
  await drain();

  // The Gates are home, and the practice gate is first on the board.
  await page.waitForSelector('.gaterow.is-practice', { timeout: 10000 });
  await drain();
  await snap('gates');
  await raidGate('.gaterow.is-practice', 'practice');
  if (!(await page.locator('.xpbar__label').innerText()).includes('LV 5')) throw new Error('THE PRACTICE GATE DID NOT LAND ON LEVEL 5');

  // Spend the points it paid.
  await nav('profile');
  await sleep(400);
  await drain();
  await snap('profile-points');
  await page.locator('text=Auto-Allocate').click();
  await page.locator('.syswin__foot .btn--primary').click();
  await drain();
  await snap('profile');

  // A real gate, at E.
  await nav('gates');
  await sleep(400);
  await drain();
  const before = await page.locator('.xpbar__label').innerText();
  // Win or lose it pays: a defeat still pays a share.
  await raidGate('.gaterow:not(.is-locked):not(.is-practice)', 'first-gate');
  if ((await page.locator('.xpbar__label').innerText()) === before) throw new Error('A GATE PAID NO EXPERIENCE');

  await nav('shadows');
  await drain();
  await page.locator('.topbar__purse').click();
  await sleep(500);
  await snap('exchange');

  if (errors.length) throw new Error('CONSOLE ERRORS:\n' + errors.join('\n'));
  console.log(`smoke green · ${shot} screenshots in ${OUT}/`);
} catch (e) {
  await snap('failure').catch(() => {});
  console.error(e);
  if (errors.length) console.error('console errors:\n' + errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
