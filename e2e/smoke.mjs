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
/** Turn over every piece of loot on the results, and wait for the high grades to finish gathering themselves. */
async function revealLoot() {
  for (let n = 0; n < 12 && (await page.locator('.flip.is-down').count()); n++) { await page.locator('.flip.is-down').first().click(); await page.waitForTimeout(80); }
  await page.waitForFunction(() => !document.querySelector('.flip.is-charging, .flip.is-down'), null, { timeout: 8000 });
}
const visible = (sel) => page.locator(sel).first().isVisible().catch(() => false);
async function hold(sel, ms) {
  const box = await page.locator(sel).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
}

/** Close whatever the System has put on screen: tours, windows, holds. */
/** The arena's pace and Auto sit behind one button in its head: open its menu and choose. */
async function setPace(which) {
  await page.locator('.pacebtn').click();
  await page.locator(`.pacemenu [data-pace="${which}"]`).click();
}
/** Take an action from the wheel: open it if it is shut, pick the slot, then tap it again to use it. */
async function act(use) {
  if (await page.locator('.turnbar .actbtn').isVisible().catch(() => false)) await page.locator('.turnbar .actbtn').click();
  const slot = page.locator(`.actwheel [data-act="${use}"]`);
  if ((await slot.getAttribute('aria-pressed')) !== 'true') {
    await slot.click(); await sleep(120);
    if (!(await page.locator('.turnbar').isVisible().catch(() => false))) throw new Error('A FIRST TAP ON A SLOT USED IT');
  }
  await slot.click();
}
async function drain(max = 60) {
  let quiet = 0;
  for (let i = 0; i < max && quiet < 5; i++) {
    await sleep(140);
    if (await visible('.sysgate .holdbtn')) { quiet = 0; await hold('.sysgate .holdbtn', 5600); await sleep(1700); continue; }
    // A Shadow left lingering asks before the Gate is left; the walk leaves it.
    if (await visible('.syswin--app:has-text("A Shadow Lingers")')) { quiet = 0; await page.locator('.syswin__foot .btn', { hasText: 'Leave Anyway' }).click(); continue; }
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
/**
 * Use the nav bar as a player would: answer any System window over it first (forging a first item
 * completes a Secret Quest, whose window waits), then close whatever sheet is over it (a level-up's
 * Allocate opens Status).
 */
async function nav(k) {
  if (await visible('.sysgate')) await drain(20);
  for (let i = 0; i < 5 && (await visible('.sheet.is-top .iconbtn[aria-label="Close"]')); i++) {
    await page.locator('.sheet.is-top .iconbtn[aria-label="Close"]').first().click();
    await sleep(250);
  }
  await page.locator(`[data-nav="${k}"]`).click();
}

/**
 * Open a gate from the board, play it through, and leave. By hand, the hunter
 * aims at a foe and strikes every turn; with `auto`, the System fights them.
 * Only the practice gate must be won.
 */
/** Today's Daily Quest counts, from the save: kind to count. */
const questCounts = () => page.evaluate(() => Object.fromEntries((JSON.parse(localStorage.getItem('arise-rpg:save') || '{}').contracts?.list ?? []).map((k) => [k.kind, k.got])));

async function raidGate(row, name, auto = false) {
  const before = await questCounts();
  await page.locator(row).first().click();
  await sleep(500);
  await snap(`${name}-brief`);
  // A Gate never walked into keeps its map unidentified, as its boss is until met.
  if (name === 'practice') {
    await page.locator('.sheet.is-top .btabs__one', { hasText: 'Map' }).click(); await sleep(400);
    if (!(await visible('.sheet.is-top .gmap-fog'))) throw new Error('THE PRACTICE BRIEF SHOWED A MAP BEFORE THE HUNTER WENT IN');
    await page.locator('.sheet.is-top .btabs__one', { hasText: 'Threat' }).click(); await sleep(300);
  }
  await page.locator('text=Enter The Gate').click();
  await drain();
  await page.waitForSelector('.arena');
  await setPace('skip');
  if (auto) await setPace('auto');
  let turns = 0;
  let resumed = false;
  let steps = 0;
  let panels = 0;
  // The practice Gate's rest: found and kept for later, then walked back to and used before the boss.
  let kept = false;
  let restedBack = false;
  for (let i = 0; i < 600; i++) {
    await page.waitForSelector('.arena__foot .btn, .turnbar, .syswin, .arena--results, button.gnode.is-next, .nodepanel', { timeout: 20000 });
    if (await visible('.arena--results')) break;
    // A rest found asks whether to rest now: the practice Gate keeps its rest for later, every other rests at once.
    if (await visible('.syswin:has-text("Would you like to rest now?")')) {
      if (name === 'practice' && !kept) {
        kept = true;
        await snap('practice-rest-found');
        await page.locator('.syswin__foot .btn', { hasText: /^Not Yet$/ }).click();
      } else await page.locator('.syswin__foot .btn', { hasText: /^Rest$/ }).click();
      await sleep(400);
      continue;
    }
    if (await visible('.syswin')) { await drain(); continue; }
    if (await visible('.arena__foot >> text=Claim The Gate')) { await page.locator('.arena__foot >> text=Claim The Gate').click(); break; }
    if (await visible('.arena__foot >> text=Carried Out')) {
      if (name === 'practice') throw new Error(`LOST ${name.toUpperCase()}`);
      await page.locator('.arena__foot >> text=Carried Out').click();
      break;
    }
    // Auto walks, fights and chooses by itself; a tap here would be a second hand on the wheel.
    if (auto) {
      if (await visible('.turnbar')) throw new Error('AUTO STILL ASKED FOR A TURN');
      await sleep(300);
      continue;
    }
    if (await visible('.turnbar')) {
      // At Skip the fight between turns takes no time, but its lines are still written to the log.
      if (turns === 1 && (await page.locator('.arena__feed li').count()) < 2) throw new Error('SKIP LEFT THE FIGHT LOG EMPTY');
      if (!turns++) {
        await snap(`${name}-turn`);
        // Aim at the last foe standing in the list, so aiming is exercised as well as striking.
        if (await visible('.unit.is-pickable')) await page.locator('.unit.is-pickable').last().click();
      }
      if (name === 'practice' && turns === 2) {
        // Leave with a turn waiting. Every order so far is in the save, so coming back
        // must land on this same turn, with everyone exactly as they stand now.
        const hp = async () => (await page.locator('.unit__hp').allInnerTexts()).join(',');
        const before = await hp();
        await sleep(400);
        await page.reload();
        await page.waitForSelector('text=Go Back In', { timeout: 10000 });
        await drain();
        await page.locator('text=Go Back In').click();
        await page.waitForSelector('.arena');
        await setPace('skip');
        await page.waitForSelector('.turnbar', { timeout: 20000 });
        await drain();
        const after = await hp();
        if (after !== before) throw new Error(`RESUMED SOMEWHERE ELSE: ${before} became ${after}`);
        await snap('practice-resumed');
        resumed = true;
      }
      await act('Strike');
      continue;
    }
    if (await visible('.nodepanel')) {
      if (!panels++) await snap(`${name}-step`);
      if (await visible('.nodepanel .choice-row')) { await page.locator('.nodepanel .choice-row').first().click(); continue; }
      // A shrine's blessings, each a card: take the first.
      if (await visible('.nodepanel button.boonc')) {
        if ((await page.locator('.nodepanel button.boonc').count()) < 1) throw new Error('A SHRINE OFFERED NOTHING');
        await snap(`${name}-shrine`);
        await page.locator('.nodepanel button.boonc').first().click();
        continue;
      }
      if (await visible('.nodepanel >> text=Press On')) { await page.locator('.nodepanel >> text=Press On').click(); continue; }
      if (await visible('.nodepanel >> text=Later')) {
        if ((await page.locator('.nodepanel .restway').count()) !== 3) throw new Error('A REST DID NOT OFFER HEAL, HONE AND STEADY');
        await page.locator('.nodepanel .restway--heal').click();
        continue;
      }
      await page.locator('.nodepanel >> text=Continue').click();
      continue;
    }
    if (name === 'practice' && kept && !restedBack && await visible('.dmap button.gnode--boss.is-next')) {
      // Walk away to the entrance, then back to the rest kept for later, and use it, once.
      await page.locator('.dmap button.gnode--entrance').click(); await sleep(600);
      // No button under the plan: the rest found is tapped on the plan, and asks.
      if (await page.locator('.arena__map .btn', { hasText: /^Rest$/ }).count()) throw new Error('A REST STILL HAS A BUTTON UNDER THE PLAN');
      await page.locator('.dmap button.droom.gnode--rest.is-restable').click(); await sleep(600);
      if (!(await visible('.syswin:has-text("Would you like to rest now?")'))) throw new Error('A REST FOUND AND KEPT DID NOT ASK WHEN TAPPED');
      await snap('practice-rest-ask');
      await page.locator('.syswin__foot .btn', { hasText: /^Rest$/ }).click(); await sleep(500);
      // Its three ways, side by side: Heal, Hone and Steady.
      if ((await page.locator('.nodepanel .restway').count()) !== 3) throw new Error('A REST DID NOT OFFER HEAL, HONE AND STEADY');
      await snap('practice-rest-ways');
      await page.locator('.nodepanel .restway--steady').click(); await sleep(500);
      if (!(await page.locator('.nodepanel >> text=Debuffs cleared').count())) throw new Error('STEADY DID NOT SAY WHAT IT GAVE');
      await page.locator('.nodepanel >> text=Continue').click(); await sleep(500);
      if (await page.locator('.dmap .droom.is-restable').count()) throw new Error('A REST COULD BE USED TWICE');
      if (!(await page.locator('.dmap .droom.is-spent').count())) throw new Error('A USED REST DID NOT SHOW AS USED');
      restedBack = true;
      await snap('practice-rested');
      continue;
    }
    if (await visible('button.gnode.is-next')) {
      if (!steps++) {
        await snap(`${name}-map`);
        // The fog: rooms not yet seen show nothing of what is in them.
        if (!(await page.locator('.dmap .droom.is-fog').count())) throw new Error('THE MAP SHOWED EVERY ROOM BEFORE IT WAS SEEN');
        if (await page.locator('.dmap .droom.is-fog:is(.gnode--fight, .gnode--event, .gnode--elite, .gnode--shrine)').count()) throw new Error('A ROOM IN THE FOG GAVE AWAY WHAT IS IN IT');
      }
      // A trap, a cache or a rest passes for an Event until the hunter stands in it.
      if (await page.locator(':is(.gnode--trap, .gnode--treasure, .dmap .gnode--rest):not(.is-here):not(.is-done)').count()) throw new Error('A TRAP, A CACHE OR A REST SHOWED ITSELF BEFORE IT WAS STEPPED ON');
      await page.locator('button.gnode.is-next').first().click();
      continue;
    }
    if (i === 599) throw new Error(`${name.toUpperCase()} NEVER FINISHED`);
  }
  if (!auto && !turns) throw new Error(`${name.toUpperCase()} NEVER GAVE A TURN`);
  if (!auto && !steps) throw new Error(`${name.toUpperCase()} NEVER SHOWED THE MAP`);
  if (name === 'practice' && !resumed) throw new Error('THE PRACTICE GATE ENDED BEFORE THE RELOAD CHECK');
  if (name === 'practice' && !restedBack) throw new Error('THE PRACTICE GATE NEVER WALKED BACK TO ITS REST');
  await page.waitForSelector('.arena--results');
  if (name !== 'practice') {
    // The results show exactly the Daily Quests the run moved, and nothing when it moved none.
    await sleep(400);
    const after = await questCounts();
    const moved = Object.keys(after).filter((k) => after[k] > (before[k] ?? 0)).sort().join();
    const shown = (await page.locator('.arena--results .questlines [data-contract]').evaluateAll((els) => els.map((e) => e.dataset.contract))).sort().join();
    if (shown !== moved) throw new Error(`THE RESULTS SHOWED DAILY QUESTS [${shown}] BUT THE RUN MOVED [${moved}]`);
    // An alert that only reports goes when it is tapped, and the rest go of themselves; one that opens something stays.
    const fyi = () => page.locator('.arena--results .sysalert.is-fyi').count();
    const n = await fyi();
    if (n) {
      await sleep(900);
      await page.locator('.arena--results .sysalert.is-fyi').first().click();
      await sleep(900);
      if ((await fyi()) !== n - 1) throw new Error('A TAPPED ALERT DID NOT GO');
      await sleep(8500);
      if (await fyi()) throw new Error('AN ALERT THAT ONLY REPORTS STAYED');
    }
  }
  // Leaving with loot face down asks first; Reveal All turns it over and stays.
  if (await visible('.flip:not(.is-open)')) {
    await sleep(700);
    await snap(`${name}-results-facedown`);
    await page.locator('text=Leave The Gate').click();
    await page.waitForSelector('.syswin--app', { timeout: 3000 });
    await snap(`${name}-leave-check`);
    await page.locator('.syswin--app .btn--primary', { hasText: 'Reveal All' }).click();
    await sleep(300 * (await page.locator('.flip').count()) + 400);
    if (await visible('.flip:not(.is-open)')) throw new Error('REVEAL ALL LEFT LOOT FACE DOWN');
  }
  await revealLoot();
  await sleep(1500);
  await snap(`${name}-results`);
  // A find turned over opens its card: a piece's, or a blueprint's.
  if (await visible('.flip.is-open')) {
    await page.locator('.flip.is-open').first().click();
    await page.waitForSelector('.sheet.is-top[aria-label^="Item:"], .sheet.is-top[aria-label^="Blueprint:"]', { timeout: 3000 }).catch(() => { throw new Error('A REVEALED FIND DID NOT OPEN ITS CARD'); });
    await page.locator('.sheet.is-top .iconbtn[aria-label="Close"]').first().click();
    await sleep(300);
  }
  await page.locator('text=Leave The Gate').click();
  await drain();
}

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('.awaken--splash');
  await sleep(2600);
  await snap('splash');
  await page.locator('.awaken--splash').click();

  // The Awakening is no screen's, so it keeps the System's cyan rather than the Gates' orange.
  if (await page.evaluate(() => document.documentElement.dataset.screen)) throw new Error('THE AWAKENING TOOK A SCREEN’S COLOUR');
  await tapCoachUntil('#hunter-name');
  await page.fill('#hunter-name', 'Kintukka');
  await snap('licence');
  await page.locator('form button[type=submit]').click();
  await tapCoachUntil('text=Leave The Office');
  await snap('handover');
  await page.locator('text=Leave The Office').click();

  // The Arrival plays before the System's first window: the lock forms, catches and breaks open.
  await page.waitForSelector('canvas.arrival');
  await sleep(6900);
  await snap('arrival');
  await page.waitForSelector('.sysgate .holdbtn', { timeout: 15000 });
  await sleep(300);
  await snap('awakening');
  await drain();

  // The Gates are home, and the practice gate is first on the board.
  await page.waitForSelector('.btile.is-gate.is-practice', { timeout: 10000 });
  await drain();
  await snap('gates');
  // Quests open with the practice gate cleared, not before.
  if (!(await page.locator('[data-nav="quests"].is-locked').isVisible())) throw new Error('THE QUESTS TAB OPENED BEFORE THE PRACTICE GATE');
  await raidGate('.btile.is-gate.is-practice .btile__hit', 'practice');
  if (!(await page.locator('.xpbar__label').innerText()).includes('LV 5')) throw new Error('THE PRACTICE GATE DID NOT LAND ON LEVEL 5');

  // Spend the points it paid. The level-up's Allocate opens the Status sheet itself; if it was closed, the Status tile does.
  if (!(await visible('.sheet.is-top .status'))) {
    await nav('inventory');
    await sleep(400);
    await drain();
    await page.locator('.btile--status .btile__hit').click();
    await sleep(400);
  }
  if (!(await page.locator('.sheet.is-top .status').isVisible())) throw new Error('THE STATUS SHEET DID NOT OPEN');
  await snap('inventory-points');
  await page.locator('text=Auto-Allocate').click();
  await page.locator('.syswin__foot .btn--primary').click();
  await drain();
  await snap('inventory');
  await page.locator('.sheet.is-top .iconbtn[aria-label="Close"]').click();
  await sleep(300);

  // The practice gate is behind the hunter, so the System has issued the day's contracts, on the Quests screen.
  if (!(await page.locator('[data-nav="quests"] .badge').isVisible())) throw new Error('THE QUESTS TAB DID NOT SAY THE DAILY QUESTS HAD ARRIVED');
  await nav('quests');
  // The first visit is when the System announces the day's Daily Quests.
  await page.waitForSelector('.syswin', { timeout: 3000 }).catch(() => { throw new Error('THE FIRST QUESTS VISIT DID NOT ANNOUNCE THE DAILY QUESTS'); });
  await sleep(1400);
  await snap('quests-arrival');
  await drain();
  // One log: the day's quests, the next rank and the Secret Quests, each opening its window.
  if ((await page.locator('.qdaily__one').count()) !== 3) throw new Error('THE SYSTEM ISSUED NO CONTRACTS');
  if (!(await visible('.qrow--rank'))) throw new Error('THE QUESTS SCREEN DID NOT SHOW THE NEXT RANK');
  if (!(await visible('.qrow--secret'))) throw new Error('THE QUESTS SCREEN DID NOT SHOW THE SECRET QUESTS');
  await sleep(800);
  await snap('quests');
  await page.locator('.qdaily').click();
  await sleep(500);
  if ((await page.locator('.sheet.is-top .contracts .contract').count()) !== 3) throw new Error('THE DAILY QUESTS TILE DID NOT OPEN ITS WINDOW');
  await snap('quests-daily');
  await page.locator('.sheet.is-top .iconbtn[aria-label="Close"]').click();
  await sleep(300);
  await page.locator('.qrow--secret').click();
  await sleep(500);
  if (!(await visible('.sheet.is-top .quest-secret .contract.is-done'))) throw new Error('THE SECRET QUESTS TILE DID NOT OPEN ITS WINDOW');
  await snap('quests-secret');
  await page.locator('.sheet.is-top .iconbtn[aria-label="Close"]').click();
  await sleep(300);
  if (await page.locator('[data-nav="quests"] .badge').isVisible()) throw new Error('THE QUESTS BADGE OUTLIVED THE VISIT');

  // A real gate, at E.
  await nav('gates');
  await sleep(400);
  await drain();
  if (await visible('.sysframe.contracts')) throw new Error('THE DAILY QUESTS ARE STILL ON THE GATES SCREEN');
  const before = await page.locator('.xpbar__label').innerText();
  // Win or lose it pays: a defeat still pays a share. The System fights this one.
  // The open Gates are one tile; it opens the board.
  await page.locator('.btile--board .btile__hit').click();
  await sleep(400);
  if (!(await visible('.sheet.is-top .gboard .gaterow'))) throw new Error('THE BOARD TILE DID NOT OPEN THE GATES');
  await snap('board');
  await raidGate('.sheet.is-top .gaterow:not(.is-shut):not(.is-practice)', 'first-gate', true);
  const firstCleared = await page.evaluate(() => JSON.parse(localStorage.getItem('arise-rpg:save') ?? '{}').gates?.clears > 0).catch(() => false);
  if ((await page.locator('.xpbar__label').innerText()) === before) throw new Error('A GATE PAID NO EXPERIENCE');

  // The first real Gate's first clear left a blueprint and its materials: the Forge forges it.
  await nav('inventory');
  await drain();
  await page.locator('.btile--forge .btile__hit').click();
  await sleep(500);
  // A clear leaves a blueprint; a party carried out leaves with nothing, and the Practice Gate's iron is all there is.
  const blueprints = await page.locator('.sheet.is-top .bprow').count();
  if (firstCleared && blueprints < 1) throw new Error('THE FIRST CLEAR LEFT NO BLUEPRINT IN THE FORGE');
  await snap('forge');
  await page.locator('.sheet.is-top .seg__btn', { hasText: 'Materials' }).click();
  await sleep(300);
  if (!(await visible('.sheet.is-top .matrow:not(.is-none)'))) throw new Error('THE PRACTICE GATE LEFT NO MATERIALS IN THE FORGE');
  await snap('forge-materials');
  await page.locator('.sheet.is-top .seg__btn', { hasText: 'Blueprints' }).click();
  await sleep(300);
  if (blueprints) {
  await page.locator('.sheet.is-top .bprow').first().click();
  await page.waitForSelector('.sheet.is-top[aria-label^="Blueprint:"]', { timeout: 3000 });
  await sleep(400);
  await snap('forge-blueprint');
  const forgeBtn = page.locator('.sheet.is-top .recipe > .btn--gold');
  if (await forgeBtn.isEnabled()) {
    const held = await page.locator('.sheet.is-top .heldrow').count();
    await forgeBtn.click();
    await sleep(1600);
    if ((await page.locator('.sheet.is-top .heldrow').count()) !== held + 1) throw new Error('FORGING PUT NO PIECE IN THE BAG');
    await snap('forge-forged');
  }
  }

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
