/** The Gates: the board, the brief, and the way in. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { powerOf, TACTICS } from '@/core/combat';
import { board, bossKnown, dungeonById, enemyById, entryBlock, isPractice, rankIdx } from '@/core/gates';
import { licenceHolding, licenceRequired, licensedRank } from '@/core/licence';
import { overCap, RARITY } from '@/core/gear';
import { GATE_XP, PRACTICE_LEVEL, practiceAward } from '@/core/progression';
import { build, mapSeed } from '@/core/map';
import * as contracts from '@/core/contracts';
import * as spire from '@/core/spire';
import * as ascension from '@/core/ascension';
import { isTrial } from '@/core/trial';
import { ASCENSION_PAY, ASCENSION_RULED, BEYOND, MARK_MAX, MARKS, WALKERS, type Mark } from '@/data/ascension';
import * as walkers from '@/core/walkers';
import * as marks from '@/core/marks';
import { SPIRE_NAME, SPIRE_TOP } from '@/data/spire';
import { GATES_LINE, GATES_TOUR } from '@/data/narrative';
import * as system from '@/ui/system';
import { MapView } from '@/ui/map';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import * as shop from '@/core/shop';
import * as story from '@/core/story';
import type { Dungeon, Rank } from '@/core/types';
import { RANKS } from '@/core/types';
import { dayKey, hhmmss, msUntilMidnight, msUntilWeek } from '@/core/util';
import * as vitals from '@/core/vitals';
import { arena } from '@/app/router';
import { buyLicence, priceOf, storeReady } from '@/platform/native';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Card, Chip, Panel, RankPlate, Section, Shards, Tile, useNow, Voice } from '@/ui/components';
import { buzz } from '@/ui/feedback';
import { Glyph, Sigil } from '@/ui/icons';
import { confirm, openSheet, sys, toast, tour } from '@/ui/overlays';
import { drinkFlow, VitalsBlock } from './Inventory';
import { openExchange } from './Exchange';

function coachLine(s = store.get()) {
  const v = vitals.read(s);
  if (v.locked) return GATES_LINE.locked;
  if (v.fatigue > 50) return GATES_LINE.tired;
  if (!s.gates.clears) return GATES_LINE.first;
  return GATES_LINE.settled;
}

export function Gates() {
  const s = useSave();
  useNow();
  const [band, setBand] = useState<'all' | Rank>('all');
  const gates = board(s);
  const mine = licensedRank(s);
  const shown = gates.filter((d) => band === 'all' || d.rank === band);
  const run = s.gates.raid;
  const open = run && dungeonById(run.dungeonId);
  const day = dayKey();
  // The board marks the Gates today's Daily Quests name, so showing it issues them, if nothing has yet.
  const named = contracts.named(s, day);

  useEffect(() => {
    if (!story.seen(s, 'gates-visited')) {
      store.update((x) => story.markOnce(x, 'gates-visited'));
      setTimeout(() => void intro(), 500);
    }
  }, []);
  useEffect(() => {
    if (contracts.contractsOpen(store.get()) && store.get().contracts.day !== day) store.update((x) => { contracts.issue(x, day); });
  }, [day, contracts.contractsOpen(s)]);

  return (
    <div class="stack">
      <Voice>{coachLine(s)}</Voice>
      <Panel title="Gates" tone="ember">
        <div class="licencecard" data-tour="licence">
          <Sigil rank={mine} size={46} />
          <div class="grow">
            <span class="label">Association grade</span>
            <b>{mine}-Rank</b>
            <small class="muted">{licenceHolding(s) ? 'Held at D without the Association Licence.' : `Gates up to ${RANKS[Math.min(5, rankIdx(mine) + 1)]}-Rank are open to you. Your grade rises with your level.`}</small>
          </div>
        </div>
        {licenceRequired(s) && licenceHolding(s) && storeReady() && (
          <Btn kind="light" block onClick={async () => { if (await buyLicence()) { sfx.rankUp(); toast('Licence issued. Gates above D-Rank are open.', 'good'); } }}>
            Association Licence · {priceOf('licence') ?? 'Buy'}
          </Btn>
        )}
        <VitalsBlock />
        <div class="tiles tiles--3" data-tour="raidstats">
          <Tile label="Entered" value={s.gates.clears + s.gates.fails + s.gates.withdrawn} />
          <Tile label="Cleared" value={s.gates.clears} />
          <Tile label="Gates taken" value={s.gates.cleared.filter((id) => id !== 'DNG-000').length} />
        </div>
      </Panel>

      {open && run && (
        <Card hot tone="ember">
          <b>{open.name} is still open.</b>
          <p class="muted">You are {run.at} of {raid.mapOf(open, run).layers.length} steps in. Abandoning it counts as being carried out.</p>
          <div class="row">
            <Btn kind="ghost" onClick={async () => {
              if (await confirm('Abandon the run?', 'You will be carried out. Nothing banked on this run is kept.', 'Abandon', true)) {
                store.update((x) => raid.finish(x, open, x.gates.raid!, 'defeated'));
              }
            }}>Abandon</Btn>
            <Btn kind="primary" class="grow" sound="gate" onClick={() => arena.set(open.id)}>Go Back In</Btn>
          </div>
        </Card>
      )}

      <SpireCard />
      <AscensionCard />

      <div class="bands" role="tablist" aria-label="Filter Gates by grade" data-tour="bands">
        <button type="button" role="tab" aria-selected={band === 'all'} class={`band ${band === 'all' ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setBand('all'); }}>All</button>
        {RANKS.map((r) => {
          const any = gates.some((d) => d.rank === r);
          return <button type="button" role="tab" key={r} aria-selected={band === r} data-rank={r} class={`band ${band === r ? 'is-on' : ''} ${any ? '' : 'is-empty'}`} onClick={() => { sfx.tap(); if (any) setBand(r); else toast(`No ${r}-Rank Gate opened today.`, 'warn'); }}>{r}</button>;
        })}
      </div>
      <div class="boardhead">
        <span class="label">{band === 'all' ? 'Open Gates' : `${band}-Rank Gates`}</span>
        <span class="label">Redraw <b class="num countdown">{hhmmss(msUntilMidnight())}</b></span>
        <span class="label">{s.gates.sealed.day === dayKey() ? s.gates.sealed.ids.length : 0} closed today</span>
      </div>
      <ul class="board" data-tour="board">
        {shown.map((d) => <GateRow key={d.id} d={d} quest={named.has(d.id)} />)}
      </ul>
    </div>
  );
}

/** The Pale Spire, beside the board: the next block up, and how the week stands. */
function SpireCard() {
  const s = useSave();
  if (!spire.spireOpen(s)) return null;
  const d = spire.nextSpire(s);
  const b = spire.blockOf(d.floor ?? 1);
  const best = spire.weekBest(s);
  const tier = spire.seasonTier(best);
  const locked = entryBlock(s, d) === 'licence';
  const left = msUntilWeek();
  const days = Math.floor(left / 864e5);
  const built = spire.builtFor(b);
  return (
    <Card class={`spirecard ${locked ? 'is-locked' : ''}`} tone="ember" onClick={() => {
      if (locked) toast(`Floors ${spire.firstFloor(b)} to ${spire.lastFloor(b)} are ${d.rank}-Rank. Your licence does not cover ${d.rank}-Rank yet.`, 'warn');
      else openBrief(d);
    }}>
      <div class="spirecard__head">
        <RankPlate rank={d.rank} size={34} />
        <div class="grow">
          <b>{SPIRE_NAME}</b>
          <small class="muted">Floors {spire.firstFloor(b)} to {spire.lastFloor(b)} next · {built <= SPIRE_TOP ? `built for Level ${built}` : `built past Level ${SPIRE_TOP}`}</small>
        </div>
        <Glyph name={locked ? 'lock' : 'up'} />
      </div>
      <div class="spirecard__week">
        <span>{best ? <>This week: <b>Floor {best}</b>{tier ? `, pays at ${tier.tier}` : ''}</> : 'Not climbed this week'}</span>
        <span class="num">{days ? `${days}d ` : ''}{hhmmss(left % 864e5)}</span>
      </div>
    </Card>
  );
}

/**
 * Ascension: the level the next run is entered at, its rules, and the marks. It shows once Ascension 1
 * is open, when there is a level to choose. Proving the next level, its Trial and the Chosen walking
 * today are quests, on the Quests screen.
 */
function AscensionCard() {
  const s = useSave();
  if (!s.ascension.unlocked) return null;
  const a = s.ascension;
  const rules = ascension.rulesAt(a.level);
  const choose = (L: number) => store.update((x) => ascension.choose(x, L));
  return (
    <Card class="ascension" tone="gold" tour="ascension">
      <div class="ascension__head">
        <Glyph name="crown" />
        <div class="grow">
          <b>Ascension {a.level ? `${a.level} · ${ascension.levelInfo(a.level).name}` : '0'}</b>
          <small class="muted">{a.level ? `Gates pay ${Math.round(ASCENSION_PAY * a.level * 100)}% more. The brief’s assessment plays every rule.` : 'The board as it stands. Choose a level to make every Gate harder, and pay more.'}</small>
        </div>
      </div>
      {a.unlocked <= ASCENSION_RULED && (
        <div class="chips" role="radiogroup" aria-label="Ascension level">
          {Array.from({ length: a.unlocked + 1 }, (_, L) => <Chip key={L} on={a.level === L} onClick={() => choose(L)}>{L}</Chip>)}
        </div>
      )}
      {a.unlocked > ASCENSION_RULED && (
        <div class="stepper" role="group" aria-label="Ascension level">
          <Btn size="sm" disabled={a.level === 0} onClick={() => choose(a.level - 1)}>−</Btn>
          <b class="num">{a.level}</b>
          <Btn size="sm" disabled={a.level >= a.unlocked} onClick={() => choose(a.level + 1)}>+</Btn>
          <Btn size="sm" kind="ghost" onClick={() => choose(0)}>0</Btn>
          <Btn size="sm" kind="ghost" onClick={() => choose(a.unlocked)}>Highest · {a.unlocked}</Btn>
        </div>
      )}
      {rules.length > 0 && <ol class="ascension__rules">{rules.map((r) => <li key={r.level}><b>{r.name}</b> {r.rule}</li>)}</ol>}
      {ascension.beyond(a.level) > 0 && (
        <small class="ascension__proof">Past Level {ASCENSION_RULED}: Foe strength +{Math.round((BEYOND.growth - 1) * 100)}% each level · +{Math.round((BEYOND.growth ** ascension.beyond(a.level) - 1) * 100)}% here</small>
      )}
      <MarkList />
    </Card>
  );
}

/** One of the Chosen holding the gate in the brief: when it shows itself, and what felling it pays. */
function ChosenCard({ d, w, level }: { d: Dungeon; w: walkers.Walker; level: number }) {
  const s = useSave();
  const pay = ascension.payShare(level);
  const felled = s.ascension.felled.includes(w.level);
  return (
    <Card class="bosscard chosencard" tone="gold">
      <Glyph name="crown" />
      <div class="grow">
        <span class="label">One of the Chosen holds this Gate</span>
        <b>{w.name}</b>
        <small class="muted">{level >= w.level ? `At Ascension ${level}, it stands in the boss’s place.` : `Appears at Ascension ${w.level} or higher.`}</small>
        <small>{felled ? `It has fallen to you before. Felled again, it pays ${shop.gateShards(d.rank, WALKERS.bounty * pay)} shards.`
          : `The first time it falls, it leaves a masterwork: a ${RARITY[d.rank as Rank].name} ${walkers.slotOf(w.level)}, perfect and ${w.level} step${w.level === 1 ? '' : 's'} past it.`}</small>
      </div>
    </Card>
  );
}

/** The marks: one for every level opened, each set for good. */
function MarkList() {
  const s = useSave();
  const waiting = marks.unset(s);
  const set = async (m: Mark) => {
    const ok = await confirm(m.name, `<strong>${marks.markText(m)}</strong>, on top of every mark already set. A mark stays where you set it.`, 'Set The Mark');
    if (!ok || !store.update((x) => marks.setMark(x, m.id))) return;
    sfx.success();
    toast(`${m.name} set.`, 'good');
  };
  return (
    <div class="marks">
      <span class="label">Marks{waiting ? ` · ${waiting} to set` : ''}</span>
      <ul class="marks__list">
        {MARKS.map((m) => {
          const n = marks.setOn(s, m.id);
          return (
            <li key={m.id} class={n ? 'is-set' : ''}>
              <div class="grow">
                <span class="marks__name"><b>{m.name}</b><span class="num muted">{n}/{MARK_MAX}</span></span>
                <small class="muted">{n ? marks.markText(m, n) : `Each: ${marks.markText(m)}`}</small>
              </div>
              {waiting > 0 && marks.canSet(s, m.id) && <Btn kind="gold" size="sm" onClick={() => void set(m)}>Set</Btn>}
            </li>
          );
        })}
      </ul>
      <small class="ascension__proof">Upgrade limit: Perfect +{overCap(s)}</small>
    </div>
  );
}

/** One Gate on the board. `quest`: one of today's Daily Quests names it. */
function GateRow({ d, quest }: { d: Dungeon; quest: boolean }) {
  const s = useSave();
  const held = walkers.walking(s, dayKey())?.gateId === d.id;
  const block = entryBlock(s, d);
  const locked = block === 'licence';
  const known = bossKnown(s, d);
  const boss = enemyById(d.boss);
  return (
    <li>
      <button type="button" class={`gaterow ${locked ? 'is-locked' : ''} ${s.gates.cleared.includes(d.id) ? 'is-cleared' : ''} ${isPractice(d) ? 'is-practice' : ''} ${d.id === 'DNG-HOLLOW' ? 'is-monarch' : ''}`}
        onClick={() => { sfx.tap(); if (locked) toast(`Your licence does not cover ${d.rank}-Rank yet.`, 'warn'); else openBrief(d); }}>
        <RankPlate rank={d.rank} size={34} />
        <span class="gaterow__name">{d.name}{isPractice(d) && <small class="chip">Training</small>}{held && <small class="chip chip--chosen">Chosen</small>}{quest && <small class="chip chip--quest">Quest</small>}</span>
        <span class="gaterow__mark">
          {locked ? <Glyph name="lock" /> : <span title={known ? boss?.name : 'Unidentified'}><Glyph name={known ? 'skull' : 'unknown'} /></span>}
        </span>
      </button>
    </li>
  );
}

// ------------------------------------------------------------------ the brief

export function openBrief(d: Dungeon) {
  openSheet({ title: d.name, tone: 'ember', render: (close) => <Brief d={d} close={close} /> });
}

function Brief({ d, close }: { d: Dungeon; close: () => void }) {
  const s = useSave();
  useNow();
  const known = bossKnown(s, d);
  const boss = enemyById(d.boss)!;
  // A Trial is fought at the level it proves, whatever is chosen: the party, the pay and the rules shown are that level's.
  const level = ascension.entryLevel(s, d, isPractice(d));
  const party = raid.alliesAt(d, dayKey(), licensedRank(s), level);
  const squad = isPractice(d) ? [] : shadows.squad(s);
  const hero = raid.heroSpec(s);
  // The verdict is the engine answering for itself: the gate, run headlessly.
  const proj = useMemo(() => raid.project(s, d, 24), [d.id, s.hunter.level, s.vitals.hp, s.vitals.fatigue, Object.values(s.equipped).join(), squad.map((x) => x.id).join(), s.gates.tactic, level]);
  const open = s.gates.raid ? dungeonById(s.gates.raid.dungeonId) : undefined;
  const map = useMemo(() => build(d, mapSeed(d, dayKey())), [d.id, dayKey()]);
  const v = raid.verdict(proj.rate);
  const block = entryBlock(s, d);
  const pay = ascension.payShare(level);
  const sh = Math.round(shop.GATE_SHARDS[d.rank as Rank] * pay);
  const xp = isPractice(d) ? practiceAward(s) : Math.round(GATE_XP[d.rank as Rank] * pay);
  const tower = spire.isSpire(d);
  const first = !tower && !s.gates.cleared.includes(d.id);
  // One of the Chosen may hold this gate today, and stand in the boss's place for a run entered high enough.
  const walker = walkers.walking(s, dayKey());
  const holds = walker?.gateId === d.id ? walker : null;
  const met = holds && level >= holds.level ? walkers.walkerOf(holds.level, d.rank as Rank) : null;
  const hpNow = vitals.read(s);

  const enter = async () => {
    const f = vitals.read(store.get()).fatigue;
    if (f > 20 && !isPractice(d)) {
      const cost = Math.round((vitals.RAID_FATIGUE[d.rank] ?? 10) * raid.fatigueShare(store.get(), level));
      const want = await sys({
        ...system.notify([
          system.counter('Fatigue', f),
          `You will fight at ${system.red(`${Math.round(vitals.drag(f) * 100)}%`)} strength.`,
          `Fatigue on entry: +${cost}`,
        ], 'gates', [{ label: 'Rest First', value: false }, { label: 'Drink Fatigue Potion', value: 'drink' }, { label: 'Enter Anyway', value: true, primary: true }]),
        glyph: 'warn', typed: false,
      });
      if (want === 'drink') { await drinkFlow('fatigue'); return; }
      if (!want) return;
    }
    close();
    store.update((x) => raid.begin(x, d));
    sfx.gate();
    buzz([26, 40, 20, 40, 90]);
    arena.set(d.id);
  };

  return (
    <div class="stack">
      <p class="muted">{d.theme}</p>
      <Card class="bosscard" tour="boss">
        <Glyph name={known || met ? 'skull' : 'unknown'} />
        <div class="grow">
          <span class="label">{met ? 'In the boss’s place' : `Gate boss${known ? '' : ': unidentified'}`}</span>
          <b>{met ? met.name : known ? boss.name : '?'}</b>
          <small class="muted">{met ? `${met.rank}-Rank ${met.family} · ${met.role} · Power ${powerOf(met.base)}` : known ? `${boss.rank}-Rank ${boss.family} · ${boss.role} · Power ${powerOf(boss.base)}` : '?'}</small>
        </div>
      </Card>
      {holds && <ChosenCard d={d} w={holds} level={level} />}

      <Section title="The assessment">
        <div class={`verdict verdict--${v.tone}`} data-tour="assess">
          <b>Assessment: {v.text}</b>
          <small>Clear rate: {Math.round(proj.rate * 100)}%{proj.heroDown ? ` · Carried out: ${Math.round((proj.heroDown / proj.runs) * 100)}%` : ''}</small>
          {hpNow.hp < hpNow.hpMax * 0.9 && <small>HP: {hpNow.hp}/{hpNow.hpMax}</small>}
          {level > 0 && <small>Ascension {level}: {ascension.rulesAt(level).map((r) => r.name).join(', ')}{ascension.beyond(level) ? ` · Foe strength +${Math.round((BEYOND.growth ** ascension.beyond(level) - 1) * 100)}%` : ''} · Pay +{Math.round((pay - 1) * 100)}%</small>}
        </div>
        <div class="tiles">
          <Tile label="Clear" value={<span class="num">{xp} XP</span>} sub={isPractice(d) ? `enough for Level ${PRACTICE_LEVEL}` : <>and <Shards n={sh} /></>} />
          {isTrial(d)
            ? <Tile label="Opens" value={`Ascension ${s.ascension.unlocked + 1}`} sub="if you win it" />
            : tower
            ? <Tile label="This week" value={`Floor ${spire.lastFloor(spire.blockOf(d.floor ?? 1))}`} sub="a new best, if you clear it" />
            : <Tile label="First clear" value={first && !isPractice(d) ? <span class="num">+{xp} XP</span> : '-- --'} sub={first && !isPractice(d) ? <>and <Shards n={sh * 2} />, once</> : isPractice(d) ? 'pays in kit' : 'already claimed'} />}
          <Tile label="Loot" value={`${RARITY[d.rank as Rank].name}`} sub={raid.homeSets(d).length ? `and a ${raid.homeSets(d).map((x) => x.id).join(' or ')} piece on a clear` : d.rank === 'S' ? 'and below' : 'sometimes one grade up'} />
          <Tile label="Depth" value={`${map.layers.length} ${isTrial(d) ? 'Chosen' : tower ? 'floors' : 'steps'}`} sub={isTrial(d) ? 'no rest between them' : 'a rest, then the boss'} />
        </div>
      </Section>

      <Section title="Today’s map" right="the System’s road is marked">
        <MapView m={map} road={proj.road} compact />
        <p class="muted">The map is fixed until midnight.</p>
      </Section>

      <Section title="Standing orders" right={party.length + squad.length ? 'allies and Shadows' : undefined}>
        <div class="chips" aria-label="Standing orders" data-tour="orders">
          {TACTICS.map((x) => <Chip key={x.key} on={s.gates.tactic === x.key} onClick={() => store.update((y) => { y.gates.tactic = x.key; })}>{x.name}</Chip>)}
        </div>
        <p class="muted">{TACTICS.find((x) => x.key === s.gates.tactic)?.desc} The assessment above already fights with these orders.{squad.filter((x) => x.tactic).length ? ` ${squad.filter((x) => x.tactic).length === 1 ? 'One Shadow keeps its own orders.' : `${squad.filter((x) => x.tactic).length} Shadows keep their own orders.`}` : ''}</p>
      </Section>

      <Section title="Satchel" right={`${s.satchel} of ${shop.FIELD_POTION.max} field potions`}>
        <p class="muted">{s.satchel
          ? `Drink one on your turn for ${shop.FIELD_POTION.heal * 100}% of your health back. What you do not drink stays in the satchel.`
          : 'Empty.'}
        {s.satchel < shop.FIELD_POTION.max && <> <button type="button" class="linkish" onClick={() => { close(); openExchange(); }}>To The Exchange</button></>}</p>
      </Section>

      {block === 'open' ? open?.id === d.id
        ? <Btn kind="primary" size="lg" block sound="gate" onClick={() => { close(); arena.set(d.id); }}>Go Back In</Btn>
        : <Btn block disabled>Finish or abandon {open?.name ?? 'the open run'} first</Btn>
        : block === 'spent' ? <Btn block disabled>You have faced the Trial today. It opens again tomorrow.</Btn>
        : block === 'locked' ? <Btn block disabled>Carried out. Fit to enter in {Math.ceil(hpNow.lockedFor / 36e5)}h</Btn>
          : block === 'down' ? <Btn block disabled>Locked out until you recover.</Btn>
            : <Btn kind="primary" size="lg" block onClick={enter} sound="none" tour="enter">Enter The Gate</Btn>}

      <Section title="Your party" right={`${1 + party.length} hunters${squad.length ? ` · ${squad.length} Shadow${squad.length === 1 ? '' : 's'}` : ''}`}>
        <ul class="partylist" data-tour="party">
          <li class="is-you"><RankPlate rank={licensedRank(s)} size={22} /><b>{s.hunter.name}</b><small>you</small><span class="num">{powerOf(hero.base)}</span></li>
          {party.map((a) => (
            <li key={a.id}><RankPlate rank={a.rank} size={22} /><b>{a.name}</b><small>{a.note ?? a.role}{rankIdx(a.rank) > rankIdx(d.rank) ? ' ▲' : rankIdx(a.rank) < rankIdx(d.rank) ? ' ▼' : ''}</small><span class="num">{powerOf(a.base)}</span></li>
          ))}
          {squad.map((x) => (
            <li key={x.id} class="is-shadow"><RankPlate rank={enemyById(x.enemyId)!.rank} size={22} /><b>{enemyById(x.enemyId)!.shadow}</b><small>Shadow</small><span class="num">{powerOf(shadows.statsOf(x))}</span></li>
          ))}
        </ul>
        {!isPractice(d) && shadows.freeSlots(s) > 0 && <p class="hint">{shadows.freeSlots(s)} Shadow slot{shadows.freeSlots(s) === 1 ? '' : 's'} empty. Deploy from the Shadows screen.</p>}
        {isPractice(d) && <p class="hint">Valcorde is in your party for this one.</p>}
      </Section>

    </div>
  );
}

async function intro() {
  await tour({
    who: 'coach', title: 'The Gates', steps: GATES_TOUR,
  });
}
