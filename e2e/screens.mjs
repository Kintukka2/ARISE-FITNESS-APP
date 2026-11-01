/**
 * Visual tour: loads the veteran fixture and screenshots every screen and the
 * main sheets, at phone size, into e2e/out/screens/. Fails on console errors.
 *
 *   npm run build && node scripts/run.mjs scripts/fixture.ts && node e2e/screens.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const PORT = 4181;
const OUT = 'e2e/out/screens';
mkdirSync(OUT, { recursive: true });
const save = readFileSync('e2e/fixtures/veteran.json', 'utf8');

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => { server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r()); setTimeout(r, 4000); });

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript((json) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('arise-rpg:save', json); sessionStorage.setItem('seeded', '1'); } }, save);

const sleep = (ms) => page.waitForTimeout(ms);
const snap = (name, full = false) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
async function drain() {
  for (let i = 0, quiet = 0; i < 40 && quiet < 4; i++) {
    await sleep(150);
    if (await page.locator('.syswin__foot .btn').first().isVisible().catch(() => false)) { quiet = 0; await page.locator('.syswin__foot .btn').last().click(); continue; }
    if (await page.locator('.syswin').first().isVisible().catch(() => false)) { quiet = 0; await page.locator('.syswin').first().click(); continue; }
    if (await page.locator('.tour').isVisible().catch(() => false)) { quiet = 0; await page.locator('.tour').click({ position: { x: 10, y: 10 } }); continue; }
    quiet++;
  }
}
const close = () => page.locator('.sheet.is-top .iconbtn[aria-label="Close"]').first().click();
const nav = async (k) => { await page.locator(`[data-nav="${k}"]`).click(); await sleep(400); await drain(); };

/** Hand the rest of a run to the System and wait for its results. */
async function autoToResults() {
  await page.locator('.seg__btn', { hasText: 'Skip' }).click();
  await page.locator('.seg__btn', { hasText: 'Auto' }).click();
  for (let i = 0; i < 200; i++) {
    await page.waitForSelector('.arena__foot .btn, .arena--results, .syswin, .arena__map, .arena__field', { timeout: 30000 });
    if (await page.locator('.arena--results').isVisible().catch(() => false)) break;
    if (await page.locator('.syswin').first().isVisible().catch(() => false)) { await drain(); continue; }
    if (await page.locator('.arena__foot >> text=Claim The Gate').isVisible()) { await page.locator('.arena__foot >> text=Claim The Gate').click(); break; }
    if (await page.locator('.arena__foot >> text=Carried Out').isVisible()) { await page.locator('.arena__foot >> text=Carried Out').click(); break; }
    await sleep(800);
  }
  await page.waitForSelector('.arena--results');
}

try {
  await page.goto(`http://localhost:${PORT}/`);
  await sleep(1200);
  await drain();

  await nav('inventory');
  await snap('inventory', true);
  await page.locator('.status .linkish').click(); await sleep(400); await snap('class', true); await close();
  await page.locator('.sysframe.inventory').scrollIntoViewIfNeeded(); await sleep(300); await snap('inventory-grid');
  await page.locator('.invtile').first().click(); await sleep(400); await snap('item'); await close();
  await page.locator('.invtile[aria-label^="Warden"]').first().click(); await sleep(400);
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await sleep(300); await snap('item-set'); await close();
  await page.locator('[aria-label="Hunter dossier"]').click(); await sleep(400); await snap('dossier', true); await close();

  await nav('quests');
  await snap('quests', true);
  // The veteran has opened Ascension and sent a Chosen out: both are quests, and only quests.
  if (!(await page.locator('.sysframe.quest-trial').isVisible())) throw new Error('THE TRIAL IS NOT ON THE QUESTS SCREEN');
  if (!(await page.locator('.sysframe.quest-chosen').isVisible())) throw new Error('THE CHOSEN IS NOT ON THE QUESTS SCREEN');

  await nav('gates');
  await snap('gates', true);
  if (!(await page.locator('.ascension').isVisible())) throw new Error('THE ASCENSION CARD IS MISSING FROM THE GATES SCREEN');
  if (await page.locator('.ascension', { hasText: /To open Ascension|Face The Trial|opens again tomorrow|Chosen in the world/ }).count()) throw new Error('THE TRIAL OR THE CHOSEN IS STILL ON THE GATES SCREEN');
  // The Pale Spire's next block, beside the board.
  await page.locator('.spirecard').click(); await sleep(800); await snap('spire-brief', true);
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = 420; }); await sleep(300); await snap('spire-assess'); await close();
  await page.locator('.gaterow:not(.is-locked):not(.is-practice)').first().click(); await sleep(800); await snap('brief', true);
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await sleep(300); await snap('brief-orders');
  await page.locator('text=Enter The Gate').click(); await sleep(600); await drain();
  await page.waitForSelector('.arena', { timeout: 10000 });
  await page.waitForSelector('button.gnode.is-next', { timeout: 20000 });
  await sleep(400); await snap('arena-map');
  await page.locator('button.gnode.is-next').first().click();
  await page.waitForSelector('.turnbar', { timeout: 20000 });
  await drain();
  await sleep(400); await snap('arena-turn');
  await autoToResults();
  for (const f of await page.locator('.flip').all()) await f.click();
  await sleep(600); await snap('raid-results', true);
  await page.locator('text=Leave The Gate').click(); await drain();

  // A block of the Spire, on Auto, if the gate before it left the hunter fit to go in.
  await page.locator('.spirecard').click(); await sleep(600);
  if (await page.locator('text=Enter The Gate').isVisible()) {
    await page.locator('text=Enter The Gate').click(); await sleep(600); await drain();
    await page.waitForSelector('.arena', { timeout: 10000 });
    await page.waitForSelector('button.gnode.is-next', { timeout: 20000 });
    await page.locator('button.gnode.is-next').first().click();
    await page.waitForSelector('.turnbar', { timeout: 20000 });
    await drain();
    if (!/floor \d+ of \d+/i.test(await page.locator('.arena__head').innerText())) throw new Error('THE SPIRE DID NOT COUNT FLOORS');
    await snap('spire-turn');
    await autoToResults();
    await sleep(600); await snap('spire-results', true);
    await page.locator('text=Leave The Gate').click(); await drain();
  } else await close();

  await nav('shadows');
  await snap('shadows', true);
  await page.locator('.shadowrow__main').first().click(); await sleep(400); await snap('shadow-detail'); await close();
  await page.locator('.topbar__purse').click(); await sleep(400); await snap('exchange', true); await close();
  await page.locator('.topbar__cog').click(); await sleep(400); await snap('settings', true);

  if (errors.length) throw new Error('CONSOLE ERRORS:\n' + errors.join('\n'));
  console.log(`screens green · ${OUT}/`);
} catch (e) {
  await snap('failure').catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
