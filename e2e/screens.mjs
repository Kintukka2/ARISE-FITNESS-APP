/**
 * Visual tour: loads the veteran fixture and screenshots every screen and the
 * main sheets, at phone size, into e2e/out/screens/; then the ascended fixture,
 * for Ascension, the Trial and the Chosen. Fails on console errors.
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
const ascended = readFileSync('e2e/fixtures/ascended.json', 'utf8');

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => { server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r()); setTimeout(r, 4000); });

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const errors = [];
/** A fresh phone with a save on it. Every helper below drives the one opened last. */
async function phone(raw) {
  // Health, mana and fatigue recover by the hour from when the fixture was written: they start from now,
  // so every run sees the hunter as the fixture left them.
  const seeded = JSON.parse(raw);
  if (seeded.vitals) seeded.vitals.at = Date.now();
  const json = JSON.stringify(seeded);
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.addInitScript((j) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('arise-rpg:save', j); sessionStorage.setItem('seeded', '1'); } }, json);
  return p;
}
let page = await phone(save);

const sleep = (ms) => page.waitForTimeout(ms);
/** Turn over every piece of loot on the results, and wait for the high grades to finish gathering themselves. */
async function revealLoot() {
  for (let n = 0; n < 12 && (await page.locator('.flip.is-down').count()); n++) { await page.locator('.flip.is-down').first().click(); await page.waitForTimeout(80); }
  await page.waitForFunction(() => !document.querySelector('.flip.is-charging, .flip.is-down'), null, { timeout: 8000 });
}
const snap = (name, full = false) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
async function drain() {
  for (let i = 0, quiet = 0; i < 40 && quiet < 4; i++) {
    await sleep(150);
    // A Shadow left lingering asks before the Gate is left; the tour leaves it.
    if (await page.locator('.syswin--app', { hasText: 'A Shadow Lingers' }).isVisible().catch(() => false)) { quiet = 0; await page.locator('.syswin__foot .btn', { hasText: 'Leave Anyway' }).click(); continue; }
    if (await page.locator('.syswin__foot .btn').first().isVisible().catch(() => false)) { quiet = 0; await page.locator('.syswin__foot .btn').last().click(); continue; }
    if (await page.locator('.syswin').first().isVisible().catch(() => false)) { quiet = 0; await page.locator('.syswin').first().click(); continue; }
    if (await page.locator('.tour').isVisible().catch(() => false)) { quiet = 0; await page.locator('.tour').click({ position: { x: 10, y: 10 } }); continue; }
    quiet++;
  }
}
const close = () => page.locator('.sheet.is-top .iconbtn[aria-label="Close"]').first().click();
/** Use the nav bar as a player would: close whatever sheet is over it first (a level-up's Allocate opens Status). */
const nav = async (k) => {
  for (let i = 0; i < 5 && (await page.locator('.sheet.is-top .iconbtn[aria-label="Close"]').first().isVisible().catch(() => false)); i++) {
    await page.locator('.sheet.is-top .iconbtn[aria-label="Close"]').first().click(); await sleep(250);
  }
  await page.locator(`[data-nav="${k}"]`).click(); await sleep(400); await drain();
};

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
  await sleep(900);
  await snap('inventory');
  await snap('inventory-full', true);
  await page.locator('.btile--status .btile__hit').click(); await sleep(400); await snap('status', true);
  // A potion held is drunk before one is bought, and its offer can be told not to ask again.
  if (!(await page.locator('.sheet.is-top .pip.is-held').count())) throw new Error('THE HELD POTION DOES NOT SHOW');
  await page.locator('.sheet.is-top .pip.is-held').first().click(); await sleep(400);
  if (!(await page.locator('.syswin', { hasText: 'Would you like to drink?' }).isVisible())) throw new Error('A HELD POTION WAS NOT OFFERED TO DRINK');
  await page.locator('.syswin .dontask').click(); await sleep(150); await snap('drink-offer');
  await page.locator('.syswin__foot .btn', { hasText: 'Cancel' }).click(); await sleep(300);
  await page.locator('.sheet.is-top .status .linkish').click(); await sleep(400); await snap('class', true); await close(); await close();
  await page.locator('.btile--stats .btile__hit').click(); await sleep(400); await snap('stats', true);
  // Stats reads, Status spends: no Allocate here. A fight's number explains itself, and the radar gives a stat's value.
  if (await page.locator('.sheet.is-top .btn', { hasText: 'Allocate' }).count()) throw new Error('THE STATS SHEET STILL ALLOCATES');
  await page.locator('.sheet.is-top .ia-radar__hit').nth(3).click(); await sleep(200);
  if (!(await page.locator('.sheet.is-top .ia-radar__label.is-on').count())) throw new Error('THE RADAR DID NOT SHOW A VALUE');
  await page.locator('.sheet.is-top .statsheet__radar').scrollIntoViewIfNeeded(); await snap('stats-radar');
  if (await page.locator('.sheet.is-top .sysfield__why').count()) throw new Error('A FIGHT NUMBER EXPLAINED ITSELF BEFORE IT WAS TAPPED');
  await page.locator('.sheet.is-top .sysfield.has-help').nth(4).click(); await sleep(200);
  if (!(await page.locator('.sheet.is-top .sysfield.is-open .sysfield__why').isVisible())) throw new Error('A FIGHT NUMBER DID NOT EXPLAIN ITSELF');
  await page.locator('.sheet.is-top .sysfield.is-open').scrollIntoViewIfNeeded(); await sleep(200); await snap('stats-help');
  await close();
  // The skill tree: the tile calls while a point has somewhere to go, and a point spent is reported on its card.
  if (!(await page.locator('.btile--skills.is-call').count())) throw new Error('THE SKILLS TILE DOES NOT CALL FOR ITS POINTS');
  await page.locator('.btile--skills .btile__hit').click(); await sleep(700); await snap('skills'); await snap('skills-full', true);
  const can = page.locator('.sheet.is-top .st-node.is-open, .sheet.is-top .st-node.is-can').first();
  await can.scrollIntoViewIfNeeded(); await can.click(); await sleep(250);
  await page.locator('.sheet.is-top .st-card .btn', { hasText: /^(Learn|Level Up)$/ }).click(); await sleep(450);
  if (!(await page.locator('.sheet.is-top .st-card__flash').isVisible())) throw new Error('A SKILL POINT SPENT WAS NOT REPORTED');
  await snap('skills-learn');
  // A skill left out swaps in for one taken in.
  // Nothing is chosen when the sheet opens or a Path changes; a second tap on a node puts its card away.
  const arc = page.locator('.sheet.is-top .st-node[aria-label^="Sundering Arc"]');
  if (!(await arc.evaluate((el) => el.classList.contains('is-sel')))) await arc.click();
  await sleep(200);
  await page.locator('.sheet.is-top .st-card .btn', { hasText: 'Swap In' }).click(); await sleep(200);
  await page.locator('.sheet.is-top .st-loadout').scrollIntoViewIfNeeded(); await snap('skills-swap');
  await page.locator('.sheet.is-top .st-slot').first().click(); await sleep(300);
  if (!(await page.locator('.sheet.is-top .st-slot', { hasText: 'Sundering Arc' }).count())) throw new Error('SWAP IN DID NOT TAKE A SLOT');
  // Another Path, chosen on the sky.
  await page.locator('.sheet.is-top .st-skywrap').scrollIntoViewIfNeeded();
  await page.locator('.sheet.is-top .st-sky__hit').nth(1).click(); await sleep(450);
  if (!(await page.locator('.sheet.is-top .st-pathhead', { hasText: 'Bastion' }).count())) throw new Error('THE SKY DID NOT CHOOSE A PATH');
  if (await page.locator('.sheet.is-top .st-card').count()) throw new Error('A NEW PATH OPENED WITH A NODE ALREADY CHOSEN');
  await snap('skills-bastion');
  await close();
  await page.locator('.btile--equipment .btile__hit').click(); await sleep(400); await snap('equipment'); await close();
  await page.locator('.btile--inventory .btile__hit').click(); await sleep(400); await snap('inventory-grid');
  await page.locator('.invtile').first().click(); await sleep(400); await snap('item'); await close();
  await page.locator('.invtile[aria-label^="Warden"]').first().click(); await sleep(400);
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await sleep(300); await snap('item-set'); await close(); await close();
  await page.locator('.btile--dossier .btile__hit').click(); await sleep(400); await snap('dossier'); await close();

  await nav('quests');
  await sleep(800);
  await snap('quests');
  if (!(await page.locator('.assoccard').isVisible())) throw new Error('RYN’S ASSOCIATION QUEST IS NOT ON THE QUESTS SCREEN');
  await snap('quests-full', true);
  // The veteran is C-Rank: Ascension opens at S-Rank, so neither the Trial nor the Chosen is here yet.
  if (await page.locator('.btile--trial, .btile--chosen').count()) throw new Error('THE TRIAL OR THE CHOSEN SHOWED BELOW S-RANK');
  for (const k of ['rank', 'spire', 'secret']) {
    await page.locator(`.btile--${k} .btile__hit`).click(); await sleep(450);
    if (!(await page.locator(`.sheet.is-top .quest-${k}`).isVisible())) throw new Error(`THE ${k.toUpperCase()} TILE DID NOT OPEN ITS WINDOW`);
    await snap(`quest-${k}`); await close(); await sleep(250);
  }

  await nav('gates');
  await snap('gates', true);
  if (await page.locator('.btile--ascension').count()) throw new Error('THE ASCENSION TILE SHOWED BELOW S-RANK');
  // The hunter's condition under Valcorde's line, its potions one tap away; no Condition tile.
  if (await page.locator('.btile--condition').count()) throw new Error('THE CONDITION TILE IS STILL ON THE GATES SCREEN');
  if ((await page.locator('.vitalstrip .vrow').count()) < 3) throw new Error('THE CONDITION STRIP IS NOT UNDER VALCORDE');
  await page.locator('.vitalstrip .pip').nth(1).click(); await sleep(400);
  if (!(await page.locator('.syswin', { hasText: /Would you like to (purchase|drink)\?/ }).isVisible())) throw new Error('A POTION ON THE CONDITION STRIP DID NOT OFFER ITSELF');
  await snap('gates-potion');
  await page.locator('.syswin__foot .btn', { hasText: 'Cancel' }).click(); await sleep(300);
  await page.locator('.btile--grade .btile__hit').click(); await sleep(400); await snap('grade'); await close();
  // The Pale Spire is a Weekly Quest, not a Gates tile.
  if (await page.locator('.btile--spire').count()) throw new Error('THE PALE SPIRE IS STILL ON THE GATES SCREEN');
  await page.locator('.btile--board .btile__hit').click(); await sleep(600); await snap('board', true);
  await page.locator('.sheet.is-top .btile.is-gate:not(.is-shut):not(.is-practice) .btile__hit').first().click(); await sleep(800); await snap('brief', true);
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await sleep(300); await snap('brief-foot');
  // The Association's hunters are not the hunter's to order: the brief holds no standing orders.
  if (await page.locator('.sheet.is-top .chips--orders').count()) throw new Error('THE BRIEF STILL GIVES STANDING ORDERS');
  await page.locator('text=Enter The Gate').click(); await sleep(600); await drain();
  await page.waitForSelector('.arena', { timeout: 10000 });
  await page.waitForSelector('button.gnode.is-next', { timeout: 20000 });
  await sleep(400); await snap('arena-map');
  // The orders for the next fight are on the map, between fights, and changing them holds.
  if (!(await page.locator('.runorders .chip--btn').count())) throw new Error('THE MAP DOES NOT OFFER ORDERS FOR THE NEXT FIGHT');
  await page.locator('.runorders .chip--btn', { hasText: 'Finish The Weakest' }).click(); await sleep(200);
  if (!(await page.locator('.runorders .chip--btn.is-on', { hasText: 'Finish The Weakest' }).count())) throw new Error('THE ORDERS DID NOT CHANGE');
  await page.locator('.runorders').scrollIntoViewIfNeeded(); await snap('arena-orders');
  await page.locator('button.gnode.is-next').first().click();
  await page.waitForSelector('.turnbar', { timeout: 20000 });
  await drain();
  await sleep(400); await snap('arena-turn');
  // An action's ? shows what it does, in full, without using it.
  await page.locator('.act__info').first().click(); await sleep(250);
  if (!(await page.locator('.actinfo').isVisible())) throw new Error('A SKILL DID NOT SHOW WHAT IT DOES');
  await snap('arena-skill-info');
  await page.locator('.act__info').first().click(); await sleep(150);
  if (await page.locator('.actinfo').count()) throw new Error('A SKILL’S DETAILS DID NOT CLOSE');
  await autoToResults();
  await revealLoot();
  await sleep(600); await snap('raid-results', true);
  await page.locator('text=Leave The Gate').click(); await drain();

  // A block of the Spire, on Auto, if the gate before it left the hunter fit to go in: its brief from its Weekly Quest.
  await nav('quests');
  await page.locator('.btile--spire .btile__hit').click(); await sleep(500);
  await page.locator('.sheet.is-top .btn', { hasText: /^Brief: Floors/ }).click(); await sleep(800); await snap('spire-brief', true);
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = 420; }); await sleep(300); await snap('spire-assess');
  if (await page.locator('text=Enter The Gate').isVisible()) {
    await page.locator('text=Enter The Gate').click(); await sleep(600); await drain();
    await page.waitForSelector('.arena', { timeout: 10000 });
    await page.waitForSelector('button.gnode.is-next', { timeout: 20000 });
    await page.locator('button.gnode.is-next').first().click();
    // A floor the party clears before the hunter's turn comes back to the map with no turn to give.
    await sleep(1200);
    await page.waitForSelector('.turnbar, button.gnode.is-next', { timeout: 20000 });
    await drain();
    if (!/floor \d+ of \d+/i.test(await page.locator('.arena__head').innerText())) throw new Error('THE SPIRE DID NOT COUNT FLOORS');
    await snap('spire-turn');
    await autoToResults();
    await sleep(600); await snap('spire-results', true);
    // Turn the loot over first: leaving with it face down asks, and the drain would answer Reveal All.
    await revealLoot();
    await page.locator('text=Leave The Gate').click(); await drain();
  } else await close();

  await nav('shadows');
  await snap('shadows', true);
  await sleep(600);
  await page.locator('.btile--army .btile__hit').click(); await sleep(600); await snap('army', true);
  await page.locator('.sheet.is-top .btile.is-shadow .btile__hit').first().click(); await sleep(1200); await snap('shadow-detail');
  // The card runs past the fold: its stats, skills, record and release, scrolled to.
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await sleep(900); await snap('shadow-detail-2');
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = 0; }); await sleep(200);
  // Naming from the card: the System's line, the field across the window, and the two acts under it.
  await page.locator('.sheet.is-top .btn', { hasText: /^(Name|Rename)$/ }).click(); await sleep(400);
  if (!(await page.locator('.syswin .namefield__input').isVisible())) throw new Error('THE NAME WINDOW DID NOT OPEN');
  await page.locator('.syswin .namefield__input').click(); await page.keyboard.type('Bellion'); await sleep(200); await snap('shadow-name');
  await page.locator('.syswin .namefield .btn', { hasText: 'Cancel' }).click(); await sleep(300);
  if (await page.locator('.syswin').count()) throw new Error('CANCEL LEFT THE NAME WINDOW OPEN');
  await close();
  // The veteran's second Shadow stands at its cap with the Essence for Sworn: its tile calls, its card holds the promotion, and the hold plays it.
  if (!(await page.locator('.sheet.is-top .btile.is-shadow.is-ready').count())) throw new Error('NO SHADOW IS WAITING TO BE PROMOTED');
  await page.locator('.sheet.is-top .btile.is-shadow.is-ready .btile__hit').first().click(); await sleep(500);
  await snap('shadow-promote');
  {
    const box = await page.locator('.sheet.is-top .promote .holdbtn').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await sleep(2300); await page.mouse.up();
  }
  for (const [ms, name] of [[900, 'promote-1'], [1500, 'promote-2'], [1300, 'promote-3'], [1100, 'promote-4']]) { await sleep(ms); await snap(name); }
  await page.waitForSelector('.syswin', { timeout: 8000 });
  await sleep(500); await snap('promote-window');
  if (!(await page.locator('.syswin', { hasText: 'has been promoted' }).isVisible())) throw new Error('THE PROMOTION WAS NOT REPORTED');
  await page.locator('.syswin__foot .btn').last().click();
  await page.waitForFunction(() => !document.querySelector('canvas.arrival'), null, { timeout: 8000 });
  await sleep(400); await snap('shadow-promoted');
  if (await page.locator('.sheet.is-top .promote').count()) throw new Error('THE PROMOTION STAYED ON THE CARD');
  await close(); await close();
  // The squad sheet puts a Shadow in and takes one out, and its header counts as it goes.
  await page.locator('.btile--squad .btile__hit').click(); await sleep(400); await snap('squad');
  if (await page.locator('.sheet.is-top', { hasText: 'Squad slots:' }).count()) throw new Error('THE SQUAD SHEET STILL LISTS ITS SLOTS BY RANK');
  const head = async () => (await page.locator('.sheet.is-top .syshead__title').innerText()).replace(/\s+/g, ' ');
  const before = await head();
  await page.locator('.sheet.is-top .squadrow__act.is-minus').first().click(); await sleep(250);
  if ((await head()) === before) throw new Error('TAKING A SHADOW OUT DID NOT COUNT');
  await page.locator('.sheet.is-top .squadrow__act.is-plus:not(:disabled)').first().click(); await sleep(250);
  if ((await head()) !== before) throw new Error('PUTTING A SHADOW IN DID NOT COUNT');
  await snap('squad-edit'); await close();
  await page.locator('.topbar__purse').click(); await sleep(400); await snap('exchange', true); await close();
  await page.locator('.topbar__cog').click(); await sleep(400); await snap('settings', true);
  await page.locator('.sheet.is-top >> text=How Arise Works').click(); await sleep(400);
  await page.locator('.sheet.is-top .fold__head').first().click(); await sleep(300); await snap('guide');

  // ---------------------------------------------------------------- the ascended hunter: S-Rank, three levels open
  page = await phone(ascended);
  await page.goto(`http://localhost:${PORT}/`);
  await sleep(1200);
  await drain();
  await nav('quests');
  await sleep(600);
  await snap('asc-quests', true);
  if (!(await page.locator('.btile--trial').isVisible())) throw new Error('THE TRIAL IS NOT ON THE QUESTS SCREEN AT S-RANK');
  if (!(await page.locator('.btile--chosen').isVisible())) throw new Error('THE CHOSEN IS NOT ON THE QUESTS SCREEN AT S-RANK');
  // Ryn's job is done: reporting it pays, then he hands over the next.
  await page.locator('.assoccard .btn', { hasText: 'Report To Ryn' }).click();
  await page.waitForSelector('.syswin--coach', { timeout: 5000 });
  await sleep(1800); await snap('assoc-paid');
  for (let i = 0; i < 8 && !(await page.locator('.syswin--coach', { hasText: /“?[A-Z]/ }).filter({ hasNotText: 'Received' }).count()); i++) {
    await page.locator('.syswin__foot .btn').last().click(); await sleep(600);
  }
  await sleep(1800); await snap('assoc-next');
  await drain();
  if (await page.locator('.assoccard .btn', { hasText: 'Report To Ryn' }).count()) throw new Error('THE REPORT LEFT THE JOB IN HAND');
  await snap('assoc-card');
  for (const k of ['trial', 'chosen']) {
    await page.locator(`.btile--${k} .btile__hit`).click(); await sleep(450);
    if (!(await page.locator(`.sheet.is-top .quest-${k}`).isVisible())) throw new Error(`THE ${k.toUpperCase()} TILE DID NOT OPEN ITS WINDOW`);
    await snap(`quest-${k}`); await close(); await sleep(250);
  }
  // A whole build, as the sky draws it.
  await nav('inventory');
  await page.locator('.btile--skills .btile__hit').click(); await sleep(700); await snap('asc-skills'); await close(); await sleep(250);
  await nav('gates');
  if (!(await page.locator('.btile--ascension').isVisible())) throw new Error('THE ASCENSION TILE IS MISSING AT S-RANK');
  if (await page.locator('.gatesgrid', { hasText: /To open Ascension|Face The Trial|opens again tomorrow|Chosen in the world/ }).count()) throw new Error('THE TRIAL OR THE CHOSEN IS ON THE GATES SCREEN ITSELF');
  // The first open walks the hunter through the sheet, a part at a time.
  await page.locator('.btile--ascension .btile__hit').click();
  await page.waitForSelector('.tour__card--app', { timeout: 5000 });
  for (let i = 1; await page.locator('.tour').isVisible().catch(() => false); i++) {
    await sleep(350); await snap(`ascension-tour-${i}`);
    await page.locator('.tour').click({ position: { x: 10, y: 10 } });
    if (i > 8) throw new Error('THE ASCENSION WALKTHROUGH DID NOT END');
  }
  await sleep(300); await snap('ascension', true);
  // Setting a mark is the System's offer.
  await page.locator('.sheet.is-top .marks .btn').first().click(); await sleep(500); await snap('mark-offer');
  if (!(await page.locator('.syswin.sysframe', { hasText: 'Would you like to set this mark?' }).isVisible())) throw new Error('THE MARK IS NOT OFFERED IN THE SYSTEM’S WINDOW');
  await page.locator('.syswin__foot .btn', { hasText: 'Cancel' }).click(); await sleep(400);
  // The proof is done, so the Trial stands open from here: its brief is the System's, and the Association sends no one.
  await page.locator('.sheet.is-top .btn', { hasText: 'Face The Trial' }).click(); await sleep(800);
  await snap('trial-brief', true);
  if (await page.locator('.sheet.is-top', { hasText: 'Association file' }).count()) throw new Error('THE TRIAL CARRIES AN ASSOCIATION FILE');
  if (await page.locator('.sheet.is-top .partylist li:not(.is-you):not(.is-shadow)').count()) throw new Error('AN ASSOCIATION HUNTER IS IN THE TRIAL');
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await sleep(300); await snap('trial-brief-party');

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
