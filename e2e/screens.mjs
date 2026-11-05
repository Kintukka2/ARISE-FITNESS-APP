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
  await page.locator('.btile--equipment .btile__hit').click(); await sleep(900); await snap('equipment');
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await sleep(300); await snap('equipment-2'); await close();
  await page.locator('.btile--inventory .btile__hit').click(); await sleep(900); await snap('inventory-grid');
  await page.locator('.bagtile').first().click(); await sleep(700); await snap('item');
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await sleep(300); await snap('item-2'); await close();
  await page.locator('.bagtile[aria-label^="Warden"]').first().click(); await sleep(400);
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await sleep(300); await snap('item-set'); await close();
  // Select: the rarity chips pick every piece that can go, and the bar counts what they would pay.
  await page.locator('.bagtools__pick').click(); await sleep(200);
  // A rarity chip picked shows it, in its colour with a tick; tapped again, it unpicks its pieces.
  const chip = page.locator('.bagpick__chip[data-rarity]').first();
  await chip.click(); await sleep(300);
  if (!(await page.locator('.bagpick__chip[data-rarity].is-on').count())) throw new Error('A PICKED RARITY CHIP DOES NOT SHOW IT');
  const picked = await page.locator('.baggrid .bagtile.is-picked').count();
  await snap('inventory-select');
  await chip.click(); await sleep(300);
  if (await page.locator('.bagpick__chip[data-rarity].is-on').count()) throw new Error('TAPPING A PICKED CHIP AGAIN DID NOT UNPICK IT');
  if (picked && (await page.locator('.baggrid .bagtile.is-picked').count())) throw new Error('THE UNPICKED CHIP LEFT ITS PIECES PICKED');
  await page.locator('.bagtools__pick').click(); await sleep(200);
  await page.locator('.bag__views .seg__btn', { hasText: 'Sets' }).click(); await sleep(700); await snap('inventory-sets');
  await close();
  await page.locator('.btile--dossier .btile__hit').click(); await sleep(400); await snap('dossier'); await close();

  await nav('quests');
  await sleep(800);
  await snap('quests');
  if (!(await page.locator('.assoccard').isVisible())) throw new Error('RYN’S ASSOCIATION QUEST IS NOT ON THE QUESTS SCREEN');
  await snap('quests-full', true);
  // The veteran is C-Rank: Ascension opens at S-Rank, so neither the Trial nor the Chosen is here yet.
  if (await page.locator('.qrow--trial, .qrow--chosen').count()) throw new Error('THE TRIAL OR THE CHOSEN SHOWED BELOW S-RANK');
  // The log: a ring to each quest on the rail; a ring jumps to its quest.
  if ((await page.locator('.qrail__one').count()) < 4) throw new Error('THE QUEST RAIL DOES NOT RING EVERY QUEST');
  // Ryn's job leads the log, on his channel: his ring first on the rail, his card shaped as the log's rows.
  if (!(await page.locator('.qrail__one.is-coach').first().count())) throw new Error('RYN’S JOB HAS NO RING ON THE RAIL');
  if (!(await page.locator('.assoccard .assoccard__row').count())) throw new Error('RYN’S CARD IS NOT SHAPED AS THE LOG’S ROWS');
  if ((await page.locator('.qdaily__one').count()) !== 3) throw new Error('THE LOG DOES NOT LIST THE DAY’S THREE');
  await page.locator('.qrail__one', { hasText: 'Secret' }).click(); await sleep(700);
  if (!(await page.locator('#quest-secret').isVisible())) throw new Error('A RING DID NOT JUMP TO ITS QUEST');
  await snap('quests-jump'); await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
  for (const k of ['rank', 'spire', 'secret']) {
    await page.locator(`.qrow--${k}`).click(); await sleep(450);
    if (!(await page.locator(`.sheet.is-top .quest-${k}`).isVisible())) throw new Error(`THE ${k.toUpperCase()} ROW DID NOT OPEN ITS WINDOW`);
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
  // The board: a band to each grade, a row to each Gate; the rail filters by grade, and to the marked ones.
  if (!(await page.locator('.sheet.is-top .gband .gaterow').count())) throw new Error('THE BOARD HAS NO GATE ROWS');
  // A Gate home to a set counts its pieces held, of all; it names no set.
  if (await page.locator('.sheet.is-top .gtag.is-set').count()) throw new Error('THE BOARD STILL NAMES SETS');
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await sleep(300); await snap('board-foot');
  await page.locator('.sheet.is-top .gband-tab[data-rank]:not(.is-empty)').last().click(); await sleep(400);
  if ((await page.locator('.sheet.is-top .gband').count()) !== 1) throw new Error('A GRADE TAB DID NOT FILTER THE BOARD');
  await snap('board-grade');
  if (await page.locator('.sheet.is-top .gband-tab.is-marked').count()) { await page.locator('.sheet.is-top .gband-tab.is-marked').click(); await sleep(400); await snap('board-marked'); }
  await page.locator('.sheet.is-top .gband-tab', { hasText: 'All' }).click(); await sleep(300);
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = 0; }); await sleep(200);
  await page.locator('.sheet.is-top .gaterow:not(.is-shut):not(.is-practice)').first().click(); await sleep(800); await snap('brief', true);
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await sleep(300); await snap('brief-foot');
  // The Association's hunters are not the hunter's to order: the brief holds no standing orders.
  if (await page.locator('.sheet.is-top .chips--orders').count()) throw new Error('THE BRIEF STILL GIVES STANDING ORDERS');
  await page.locator('text=Enter The Gate').click(); await sleep(600); await drain();
  await page.waitForSelector('.arena', { timeout: 10000 });
  await page.waitForSelector('button.gnode.is-next', { timeout: 20000 });
  await sleep(400); await snap('arena-map');
  // Orders are the Shadows screen's: the map gives none.
  if (await page.locator('.arena .chips--orders, .arena .runorders').count()) throw new Error('THE MAP STILL GIVES ORDERS');
  if (!(await page.locator('.runstrip__cells').count())) throw new Error('THE RUN STRIP HAS NO CELLS');
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
  {
    // An alert that only reports goes when it is tapped, and the rest go of themselves.
    const fyi = () => page.locator('.arena--results .sysalert.is-fyi').count();
    const n = await fyi();
    if (!n) throw new Error('THE RESULTS SHOWED NO ALERT THAT ONLY REPORTS');
    await page.locator('.arena--results .sysalert.is-fyi').first().click(); await sleep(900);
    if ((await fyi()) !== n - 1) throw new Error('A TAPPED ALERT DID NOT GO');
    await snap('raid-results-tapped', true);
    await sleep(8000);
    if (await fyi()) throw new Error('AN ALERT THAT ONLY REPORTS STAYED');
  }
  await page.locator('text=Leave The Gate').click(); await drain();

  // A block of the Spire, on Auto, if the gate before it left the hunter fit to go in: its brief from its Weekly Quest.
  await nav('quests');
  await page.locator('.qrow--spire').click(); await sleep(500);
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
    // A run is a Gate's: entered from Quests, it still takes the Gates' orange.
    const accent = () => page.evaluate(() => { const c = getComputedStyle(document.documentElement); return [c.getPropertyValue('--accent').trim(), c.getPropertyValue('--ember').trim()]; });
    { const [a, e] = await accent(); if (a !== e) throw new Error(`THE SPIRE'S RUN IS NOT IN THE GATES' ORANGE (${a} against ${e})`); }
    await snap('spire-turn');
    await autoToResults();
    await sleep(600); await snap('spire-results', true);
    // Turn the loot over first: leaving with it face down asks, and the drain would answer Reveal All.
    await revealLoot();
    const climb = page.locator('.arena--results .btn.climb');
    if (await page.locator('.arena--results.is-cleared').count()) {
      // A floor taken offers the next ones, straight from the results.
      if (!(await climb.count())) throw new Error('A FLOOR TAKEN DID NOT OFFER THE NEXT FLOORS');
      const [, to] = (await climb.innerText()).match(/floors (\d+) to \d+/i) ?? [];
      if (!to) throw new Error('CLIMB ON DOES NOT NAME THE NEXT FLOORS');
      await climb.scrollIntoViewIfNeeded(); await snap('spire-climb-offer');
      await climb.click(); await sleep(600); await drain();
      await page.waitForSelector('button.gnode.is-next', { timeout: 20000 });
      if (!new RegExp(`floors ${to} to`, 'i').test(await page.locator('.arena__head').innerText())) throw new Error('CLIMBING ON DID NOT OPEN THE NEXT FLOORS');
      await sleep(400); await snap('spire-climbed');
      await autoToResults(); await sleep(400); await revealLoot();
    }
    await page.locator('text=Leave The Gate').click(); await drain();
  } else await close();

  await nav('shadows');
  await snap('shadows', true);
  await sleep(600);
  // The Army is one tile: the squad's slots over the reserve. There is no Squad tile beside it.
  if (await page.locator('.btile--squad').count()) throw new Error('THE SQUAD IS STILL A TILE OF ITS OWN');
  await page.locator('.btile--army .btile__hit').click(); await sleep(700); await snap('army'); await snap('army-full', true);
  await page.locator('.sheet.is-top .roster__row .roster__who').first().click(); await sleep(1200); await snap('shadow-detail');
  // The card runs past the fold: its stats, skills, record and release, scrolled to.
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await sleep(900); await snap('shadow-detail-2');
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = 0; }); await sleep(200);
  // Naming from the card: the System's line, the field across the window, and the two acts under it.
  await page.locator('.sheet.is-top .btn', { hasText: /^(Name|Rename)$/ }).click(); await sleep(400);
  if (!(await page.locator('.syswin .namefield__input').isVisible())) throw new Error('THE NAME WINDOW DID NOT OPEN');
  await page.locator('.syswin .namefield__input').click(); await page.keyboard.type('Bellion'); await sleep(200); await snap('shadow-name');
  await page.locator('.syswin .namefield .btn', { hasText: 'Cancel' }).click(); await sleep(300);
  if (await page.locator('.syswin').count()) throw new Error('CANCEL LEFT THE NAME WINDOW OPEN');
  // The card gives no orders.
  if (await page.locator('.sheet.is-top .chip--btn', { hasText: 'Army Orders' }).count()) throw new Error('THE CARD STILL GIVES ORDERS');
  await close();
  // The veteran's second Shadow stands at its cap with the Essence for Sworn: its row calls, its card holds the promotion, and the hold plays it.
  if (!(await page.locator('.sheet.is-top .roster__row.is-ready').count())) throw new Error('NO SHADOW IS WAITING TO BE PROMOTED');
  await page.locator('.sheet.is-top .roster__row.is-ready .roster__who').first().click(); await sleep(500);
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
  await close();
  // The roster makes the squad: a row's box takes a Shadow out and puts one in, and the squad's count follows.
  const count = async () => (await page.locator('.sheet.is-top .roster__count').innerText()).trim();
  const before = await count();
  await page.locator('.sheet.is-top .roster__toggle.is-on').first().click(); await sleep(250);
  if ((await count()) === before) throw new Error('TAKING A SHADOW OUT DID NOT COUNT');
  await page.locator('.sheet.is-top .roster__slot.is-free').first().click(); await sleep(700);
  if (!(await page.locator('.sheet.is-top .rostab.is-on', { hasText: 'Reserve' }).count())) throw new Error('A FREE SLOT DID NOT SHOW THE RESERVE');
  if (await page.locator('.sheet.is-top .roster__toggle.is-on').count()) throw new Error('THE RESERVE SHOWS A DEPLOYED SHADOW');
  await snap('army-reserve');
  await page.locator('.sheet.is-top .roster__toggle:not(.is-on):not(:disabled)').first().click(); await sleep(250);
  if ((await count()) !== before) throw new Error('PUTTING A SHADOW IN DID NOT COUNT');
  await page.locator('.sheet.is-top .rostab', { hasText: 'All' }).click(); await sleep(200);
  // Its sort and its grid.
  await page.locator('.sheet.is-top .roster__sort').click(); await sleep(200);
  if (!(await page.locator('.sheet.is-top .roster__sort', { hasText: 'Level' }).count())) throw new Error('THE ROSTER DID NOT SORT');
  await page.locator('.sheet.is-top .roster__view[aria-label="Grid"]').click(); await sleep(600);
  if (!(await page.locator('.sheet.is-top .rostercard').count())) throw new Error('THE GRID DID NOT SHOW');
  await page.locator('.sheet.is-top .rostergrid').scrollIntoViewIfNeeded(); await snap('army-grid');
  await page.locator('.sheet.is-top .roster__view[aria-label="List"]').click(); await sleep(200);
  for (let i = 0; i < 6 && !(await page.locator('.sheet.is-top .roster__sort', { hasText: 'Power' }).count()); i++) { await page.locator('.sheet.is-top .roster__sort').click(); await sleep(120); }
  // Drag and drop: a slot dropped on another changes places with it, the x takes one out, a reserve row
  // dropped on a free slot joins the squad, and a slot dropped on the list leaves it.
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = 0; }); await sleep(200);
  const names = () => page.locator('.sheet.is-top .roster__slot-open b').allInnerTexts();
  const drag = async (from, to, shot) => {
    const a = await from.boundingBox(), b = await to.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 6, { steps: 3 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    await sleep(200);
    if (shot) await snap(shot);
    await page.mouse.up(); await sleep(350);
  };
  const was = await names();
  if (was.length < 2) throw new Error('THE VETERAN HAS TOO FEW DEPLOYED TO SWAP');
  await drag(page.locator('.sheet.is-top .roster__slot:not(.is-free)').nth(1), page.locator('.sheet.is-top .roster__slot:not(.is-free)').nth(0), 'army-drag');
  const swapped = await names();
  if (swapped[0] !== was[1] || swapped[1] !== was[0]) throw new Error('A SLOT DROPPED ON ANOTHER DID NOT CHANGE PLACES WITH IT');
  if (await page.locator('.sheet.is-top .sp-head').count()) throw new Error('A DRAG OPENED A CARD');
  if (await page.locator('.dragghost:not([hidden])').count()) throw new Error('THE GHOST STAYED AFTER THE DROP');
  const n0 = await count();
  await page.locator('.sheet.is-top .roster__slot-x').first().click(); await sleep(250);
  if ((await count()) === n0) throw new Error('THE SLOT’S X DID NOT TAKE IT OUT');
  if (await page.locator('.sheet.is-top .sp-head').count()) throw new Error('THE X OPENED A CARD');
  await drag(page.locator('.sheet.is-top .roster__row:not(.is-on) .roster__who').first(), page.locator('.sheet.is-top .roster__slot.is-free').first());
  if ((await count()) !== n0) throw new Error('A RESERVE ROW DROPPED ON A FREE SLOT DID NOT JOIN THE SQUAD');
  await drag(page.locator('.sheet.is-top .roster__slot:not(.is-free)').first(), page.locator('.sheet.is-top .rostabs'));
  if ((await count()) === n0) throw new Error('A SLOT DROPPED ON THE LIST WAS NOT TAKEN OUT');
  // Auto Deploy puts the strongest in, and is spent once they are.
  const auto = page.locator('.sheet.is-top .btn', { hasText: 'Auto Deploy' });
  if (await auto.isEnabled()) { await auto.click(); await sleep(400); }
  if (await auto.isEnabled()) throw new Error('AUTO DEPLOY LEFT A STRONGER SQUAD UNMADE');
  await page.locator('.sheet.is-top .sheet__body').evaluate((el) => { el.scrollTop = 0; }); await sleep(200); await snap('army-edit');
  await close();
  // ARMY: ORDERS: the standing orders change and hold.
  await page.locator('.btile--orders .btile__hit').click(); await sleep(500); await snap('orders', true);
  await page.locator('.sheet.is-top .ord-card', { hasText: 'Protect The Hunter' }).click(); await sleep(250);
  if (!(await page.locator('.sheet.is-top .ord-card.is-on', { hasText: 'Protect The Hunter' }).count())) throw new Error('THE STANDING ORDERS DID NOT CHANGE');
  // The orders are the army's alone: no Shadow takes orders of its own.
  if (await page.locator('.sheet.is-top .ordrow, .sheet.is-top .chip--btn', { hasText: 'Army Orders' }).count()) throw new Error('A SHADOW STILL TAKES ORDERS OF ITS OWN');
  await close();
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
  if (!(await page.locator('.qrow--trial').isVisible())) throw new Error('THE TRIAL IS NOT ON THE QUESTS SCREEN AT S-RANK');
  if (!(await page.locator('.qrow--chosen').isVisible())) throw new Error('THE CHOSEN IS NOT ON THE QUESTS SCREEN AT S-RANK');
  // Ryn's job is done: reporting it pays, then he hands over the next.
  // A job done: its row is the report, gold, the strip along its foot naming it and its pay.
  if (!(await page.locator('.assoccard__row.is-report .assoccard__report', { hasText: 'Report To Ryn' }).count())) throw new Error('A JOB DONE IS NOT ITS OWN REPORT');
  await page.locator('.assoccard').scrollIntoViewIfNeeded(); await snap('assoc-done');
  await page.locator('.assoccard__row.is-report').click();
  await page.waitForSelector('.syswin--coach', { timeout: 5000 });
  await sleep(1800); await snap('assoc-paid');
  for (let i = 0; i < 8 && !(await page.locator('.syswin--coach', { hasText: /“?[A-Z]/ }).filter({ hasNotText: 'Received' }).count()); i++) {
    await page.locator('.syswin__foot .btn').last().click(); await sleep(600);
  }
  await sleep(1800); await snap('assoc-next');
  await drain();
  if (await page.locator('.assoccard__row.is-report').count()) throw new Error('THE REPORT LEFT THE JOB IN HAND');
  await snap('assoc-card');
  for (const k of ['trial', 'chosen']) {
    await page.locator(`.qrow--${k}`).click(); await sleep(450);
    if (!(await page.locator(`.sheet.is-top .quest-${k}`).isVisible())) throw new Error(`THE ${k.toUpperCase()} ROW DID NOT OPEN ITS WINDOW`);
    await snap(`quest-${k}`); await close(); await sleep(250);
  }
  // A whole build, as the sky draws it.
  await nav('inventory');
  await page.locator('.btile--skills .btile__hit').click(); await sleep(700); await snap('asc-skills'); await close(); await sleep(250);
  // Igris, Ascendant at the top with two stars and the Essence for a third: the Awakening panel and its hold.
  await nav('shadows');
  await sleep(600); await snap('asc-shadows', true);
  await page.locator('.btile--army .btile__hit').click(); await sleep(900); await snap('asc-army'); await snap('asc-army-full', true);
  await page.locator('.sheet.is-top .roster__view[aria-label="Grid"]').click(); await sleep(700); await snap('asc-army-grid', true);
  await page.locator('.sheet.is-top .roster__view[aria-label="List"]').click(); await sleep(300);
  await page.locator('.sheet.is-top .roster__row .roster__who', { hasText: 'Igris' }).first().click(); await sleep(900);
  if (!(await page.locator('.sheet.is-top .sp-awaken.promote').count())) throw new Error('THE AWAKENING DID NOT WAIT ON THE HUNTER');
  await page.locator('.sheet.is-top .sp-awaken').scrollIntoViewIfNeeded(); await sleep(300); await snap('shadow-awaken');
  {
    const box = await page.locator('.sheet.is-top .sp-awaken .holdbtn').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await sleep(2100); await page.mouse.up();
  }
  await page.waitForSelector('.syswin', { timeout: 6000 }); await sleep(500); await snap('shadow-awakened');
  if (!(await page.locator('.syswin', { hasText: 'has awakened' }).isVisible())) throw new Error('THE AWAKENING WAS NOT REPORTED');
  await page.locator('.syswin__foot .btn').last().click(); await sleep(300);
  await close(); await close();
  // The Ready count claims every ready Shadow at once: the System's offer, the cinematic once, and one window for all.
  // The awakening spent the Essence, so the save is given more, and two Shadows at their caps are ready again.
  await sleep(1500);
  await page.evaluate(() => { const k = 'arise-rpg:save'; const x = JSON.parse(localStorage.getItem(k)); x.shadows.essence = 200; localStorage.setItem(k, JSON.stringify(x)); });
  await page.reload(); await sleep(1400); await drain();
  await nav('shadows');
  await page.locator('.btile--army .btile__hit').click(); await sleep(900);
  if (!(await page.locator('.sheet.is-top .roster__ready').count())) throw new Error('THE READY COUNT IS NOT A BUTTON WHILE SHADOWS ARE READY');
  {
    const n = Number((await page.locator('.sheet.is-top .roster__ready b').innerText()).trim());
    await page.locator('.sheet.is-top .roster__ready').click(); await sleep(500);
    if (!(await page.locator('.syswin', { hasText: /Would you like to (promote|awaken)/ }).isVisible())) throw new Error('THE READY COUNT DID NOT OFFER TO CLAIM THEM ALL');
    await snap('claim-all-offer');
    await page.locator('.syswin__foot .btn', { hasText: /Promote All|Awaken All/ }).click();
    await page.waitForSelector('.syswin', { timeout: 12000 }); await sleep(500); await snap('claim-all-window');
    if (!(await page.locator('.syswin', { hasText: /has been promoted|has awakened/ }).isVisible())) throw new Error('CLAIMING THEM ALL WAS NOT REPORTED');
    await page.locator('.syswin__foot .btn').last().click();
    await page.waitForFunction(() => !document.querySelector('canvas.arrival'), null, { timeout: 8000 });
    await sleep(400);
    const after = await page.locator('.sheet.is-top .roster__ready b').count() ? Number((await page.locator('.sheet.is-top .roster__ready b').innerText()).trim()) : 0;
    if (after >= n) throw new Error('CLAIMING THEM ALL LEFT AS MANY WAITING');
    await snap('claim-all-after');
  }
  await close();
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
