/**
 * Smoke test: plays a brand-new hunter from the splash screen through the
 * interview, Basic Training, the first Daily Quest and the practice Gate, in
 * a real Chromium at phone size. Fails on any console error or a step that
 * never arrives. Screenshots land in e2e/out/.
 *
 *   npm run build && npm run smoke
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

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
  await page.waitForSelector('.quest');
  await drain();
  await snap('quests');

  // The first Daily Quest.
  for (let i = 0; i < 3; i++) {
    await page.locator('.qitem__row').nth(i).click();
    await page.locator('.qitem__log .btn').first().click();
    await sleep(250);
  }
  await page.locator('text=Claim Daily Quest').click();
  await drain();
  await snap('quest-cleared');

  // The interview.
  await nav('training');
  await sleep(300);
  await snap('training-new');
  await page.locator('text=Begin Interview').click();
  for (let q = 0; q < 9; q++) {
    await sleep(250);
    if (await visible('.contract')) {
      for (let k = 0; k < 4; k++) await page.locator('.choice').nth(k).click();
      await hold('.contract .holdbtn', 2900);
      break;
    }
    const choices = page.locator('.choices .choice');
    if (await choices.count()) {
      const multi = await page.locator('.choice--multi').count();
      if (!multi) await choices.nth(1).click();
      else if (q === 4) await choices.nth(0).click();
    }
    await page.locator('text=Continue').click();
  }
  await page.waitForSelector('text=Enter The Association', { timeout: 10000 });
  for (const f of await page.locator('.fold__head').all()) await f.click();
  await snap('reveal');
  await page.locator('text=Enter The Association').click();
  await drain();
  await snap('training-uncertified');

  // Basic Hunter Training.
  await page.locator('text=Begin Basic Hunter Training').click();
  await sleep(600);
  await drain();
  await snap('player');
  for (let ex = 0; ex < 3; ex++) {
    for (let set = 0; set < 3; set++) {
      await page.locator('.setrow__tick:not(.is-on)').first().click();
      await sleep(500);
      await drain();
      if (await visible('.rest')) await page.locator('.rest .btn--primary').click();
      await drain();
    }
    if (ex < 2) await page.locator('text=Next Exercise').click();
  }
  await page.locator('text=Finish Session').click();
  await page.waitForSelector('.player--report');
  await snap('report');
  await page.locator('.player--report .btn--primary').click();
  await drain();

  // The practice Gate.
  await nav('gates');
  await sleep(800);
  await drain();
  await snap('gates');
  await page.locator('.gaterow.is-practice').click();
  await sleep(500);
  await snap('brief');
  await page.locator('text=Enter The Gate').click();
  await page.waitForSelector('.arena');
  await sleep(1800);
  await snap('arena');
  if (await visible('.seg__btn')) await page.locator('.seg__btn', { hasText: 'Skip' }).click();
  for (let i = 0; i < 12; i++) {
    await page.waitForSelector('.arena__foot .btn', { timeout: 20000 });
    if (await visible('text=Claim The Gate')) { await page.locator('text=Claim The Gate').click(); break; }
    if (await visible('text=Carried Out')) throw new Error('LOST THE PRACTICE GATE');
    await page.locator('text=Press On').click();
    await sleep(300);
  }
  await page.waitForSelector('.arena--results');
  for (const f of await page.locator('.flip').all()) await f.click();
  await sleep(500);
  await snap('results');
  await page.locator('text=Leave The Gate').click();
  await drain();

  await nav('profile');
  await sleep(400);
  await drain();
  await snap('profile');
  await nav('shadows');
  await drain();
  await page.locator('.topbar__purse').click();
  await sleep(500);
  await snap('exchange');

  // A save from the original app is offered on first launch.
  const legacy = readFileSync('tests/fixtures/v5-save.json', 'utf8');
  const fresh = await browser.newPage({ viewport: { width: 390, height: 844 } });
  fresh.on('pageerror', (e) => errors.push(String(e)));
  fresh.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await fresh.addInitScript((json) => { if (!localStorage.getItem('arise:save')) localStorage.setItem('arise.save.v1', json); }, legacy);
  await fresh.goto(`http://localhost:${PORT}/`);
  await fresh.waitForSelector('text=Record Found', { timeout: 10000 });
  await fresh.locator('.syswin__foot .btn--primary').click();
  await fresh.waitForSelector('.topbar__name', { timeout: 10000 });
  if (!(await fresh.locator('.topbar__name').innerText()).includes('KINTUKKA')) throw new Error('LEGACY SAVE DID NOT CARRY FORWARD');
  await fresh.screenshot({ path: `${OUT}/${String(++shot).padStart(2, '0')}-legacy-import.png` });

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
