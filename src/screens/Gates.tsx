/** The Gates: the board, the brief, and the way in. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { powerOf, TACTICS } from '@/core/combat';
import { allies, board, bossKnown, dungeonById, enemyById, entryBlock, isPractice, rankIdx } from '@/core/gates';
import { licenceHolding, licenceRequired, licensedRank } from '@/core/licence';
import { RARITY } from '@/core/gear';
import { GATE_XP, practiceAward } from '@/core/progression';
import { build, mapSeed } from '@/core/map';
import { MapView } from '@/ui/map';
import * as raid from '@/core/raid';
import * as shadows from '@/core/shadows';
import * as shop from '@/core/shop';
import * as story from '@/core/story';
import type { Dungeon, Rank } from '@/core/types';
import { RANKS } from '@/core/types';
import { dayKey, hhmmss, msUntilMidnight } from '@/core/util';
import * as vitals from '@/core/vitals';
import { arena } from '@/app/router';
import { buyLicence, priceOf, storeReady } from '@/platform/native';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, Card, Chip, Panel, RankPlate, Section, Shards, Tile, useNow, Voice } from '@/ui/components';
import { buzz } from '@/ui/feedback';
import { Glyph, Sigil } from '@/ui/icons';
import { confirm, openSheet, sys, toast, tour } from '@/ui/overlays';
import { drinkFlow, VitalsBlock } from './Profile';
import { openExchange } from './Exchange';

function coachLine(s = store.get()) {
  const v = vitals.read(s);
  if (v.locked) return 'You were carried out of the last one. Sit down. The board will have turned over by the time you are fit anyway.';
  if (v.fatigue > 50) return 'You are running on nothing. Whatever you clear like this, you will clear badly and pay for twice.';
  if (!s.gates.clears) return 'Pick something at your own grade and go in with people. Nobody clears their first gate alone, and nobody sensible tries.';
  return 'Clear one and it closes, and something else opens in its place. The board never runs dry. You do — read the assessment, and watch your fatigue.';
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

  useEffect(() => {
    if (!story.seen(s, 'gates-visited')) {
      store.update((x) => story.markOnce(x, 'gates-visited'));
      setTimeout(() => void intro(), 500);
    }
  }, []);

  return (
    <div class="stack">
      <Voice who="coach">{coachLine(s)}</Voice>
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
          <Btn kind="light" block onClick={async () => { if (await buyLicence()) { sfx.rankUp(); toast('Licence issued. The Association reads your real grade now.', 'good'); } }}>
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
          <b>{open.name} is still standing.</b>
          <p class="muted">You are {run.at} of {raid.mapOf(open, run).layers.length} steps in. Walk away now and it counts as a defeat.</p>
          <div class="row">
            <Btn kind="ghost" onClick={async () => {
              if (await confirm('Abandon the run?', 'The party is dragged out. Nothing is banked for the chambers you cleared, and you are carried out.', 'Abandon', true)) {
                store.update((x) => raid.finish(x, open, x.gates.raid!, 'defeated'));
              }
            }}>Abandon</Btn>
            <Btn kind="primary" class="grow" sound="gate" onClick={() => arena.set(open.id)}>Go Back In</Btn>
          </div>
        </Card>
      )}

      <div class="bands" role="tablist" aria-label="Filter gates by grade" data-tour="bands">
        <button type="button" role="tab" aria-selected={band === 'all'} class={`band ${band === 'all' ? 'is-on' : ''}`} onClick={() => { sfx.tap(); setBand('all'); }}>All</button>
        {RANKS.map((r) => {
          const any = gates.some((d) => d.rank === r);
          return <button type="button" role="tab" key={r} aria-selected={band === r} data-rank={r} class={`band ${band === r ? 'is-on' : ''} ${any ? '' : 'is-empty'}`} onClick={() => { sfx.tap(); if (any) setBand(r); else toast(`No ${r}-Rank gate opened today.`, 'warn'); }}>{r}</button>;
        })}
      </div>
      <div class="boardhead">
        <span class="label">{band === 'all' ? 'Open gates' : `${band}-Rank gates`}</span>
        <span class="label">Redraw <b class="num countdown">{hhmmss(msUntilMidnight())}</b></span>
        <span class="label">{s.gates.sealed.day === dayKey() ? s.gates.sealed.ids.length : 0} closed today</span>
      </div>
      <ul class="board" data-tour="board">
        {shown.map((d) => <GateRow key={d.id} d={d} />)}
      </ul>
    </div>
  );
}

function GateRow({ d }: { d: Dungeon }) {
  const s = useSave();
  const block = entryBlock(s, d);
  const locked = block === 'licence';
  const known = bossKnown(s, d);
  const boss = enemyById(d.boss);
  return (
    <li>
      <button type="button" class={`gaterow ${locked ? 'is-locked' : ''} ${s.gates.cleared.includes(d.id) ? 'is-cleared' : ''} ${isPractice(d) ? 'is-practice' : ''} ${d.id === 'DNG-HOLLOW' ? 'is-monarch' : ''}`}
        onClick={() => { sfx.tap(); if (locked) toast(`The Association will not license you for ${d.rank}-Rank yet.`, 'warn'); else openBrief(d); }}>
        <RankPlate rank={d.rank} size={34} />
        <span class="gaterow__name">{d.name}{isPractice(d) && <small class="chip">Training</small>}</span>
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
  const party = allies(d, undefined, licensedRank(s));
  const squad = isPractice(d) ? [] : shadows.squad(s);
  const hero = raid.heroSpec(s);
  // The verdict is the engine answering for itself: the gate, run headlessly.
  const proj = useMemo(() => raid.project(s, d, 24), [d.id, s.hunter.level, s.vitals.hp, s.vitals.fatigue, Object.values(s.equipped).join(), squad.map((x) => x.id).join(), s.gates.tactic]);
  const open = s.gates.raid ? dungeonById(s.gates.raid.dungeonId) : undefined;
  const map = useMemo(() => build(d, mapSeed(d, dayKey())), [d.id, dayKey()]);
  const v = raid.verdict(proj.rate);
  const block = entryBlock(s, d);
  const sh = shop.GATE_SHARDS[d.rank as Rank];
  const xp = isPractice(d) ? practiceAward(s) : GATE_XP[d.rank as Rank];
  const first = !s.gates.cleared.includes(d.id);
  const hpNow = vitals.read(s);

  const enter = async () => {
    const f = vitals.read(store.get()).fatigue;
    if (f > 20 && !isPractice(d)) {
      const cost = vitals.RAID_FATIGUE[d.rank] ?? 10;
      const want = await sys({
        title: 'Warning', kind: 'gates', glyph: 'warn', typed: false,
        lines: [`<strong>Fatigue ${f}.</strong> You are carrying the last run into this one.`, `You will fight at <strong>${Math.round(vitals.drag(f) * 100)}%</strong> of yourself. This gate adds ${cost} more.`],
        actions: [{ label: 'Rest First', value: false }, { label: 'Fatigue Potion', value: 'drink' }, { label: 'Enter Anyway', value: true, primary: true }],
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
        <Glyph name={known ? 'skull' : 'unknown'} />
        <div class="grow">
          <span class="label">Gate boss{known ? '' : ' — unidentified'}</span>
          <b>{known ? boss.name : '???'}</b>
          <small class="muted">{known ? `${boss.rank}-Rank ${boss.family} · ${boss.role} · ${powerOf(boss.base)} power` : 'Nobody who has come back out has said.'}</small>
        </div>
      </Card>

      <Section title="The assessment">
        <div class={`verdict verdict--${v.tone}`} data-tour="assess">
          <b>{v.text}</b>
          <small>The System ran this gate {proj.runs} times with this party down the marked road, fighting your turns and making your choices the way it would. Cleared {proj.cleared}.{proj.heroDown ? ` You were carried out ${proj.heroDown} times.` : ''}</small>
          {hpNow.hp < hpNow.hpMax * 0.9 && <small>You are walking in on {hpNow.hp} of {hpNow.hpMax} HP.</small>}
        </div>
        <div class="tiles">
          <Tile label="Clear" value={<span class="num">{xp} XP</span>} sub={isPractice(d) ? 'enough for Level 5' : <>and <Shards n={sh} /></>} />
          <Tile label="First clear" value={first && !isPractice(d) ? <span class="num">+{xp} XP</span> : '—'} sub={first && !isPractice(d) ? <>and <Shards n={sh * 2} />, once</> : isPractice(d) ? 'pays in kit' : 'already claimed'} />
          <Tile label="Loot" value={`${RARITY[d.rank as Rank].name}`} sub={d.rank === 'S' ? 'and below' : 'sometimes one grade up'} />
          <Tile label="Depth" value={`${map.layers.length} steps`} sub="a rest, then the boss" />
        </div>
      </Section>

      <Section title="Today’s map" right="the System’s road is marked">
        <MapView m={map} road={proj.road} compact />
        <p class="muted">The map is the same all day. Inside, you pick each step; only a rest lets you leave.</p>
      </Section>

      <Section title="Standing orders" right={party.length + squad.length ? 'allies and Shadows' : undefined}>
        <div class="chips" aria-label="Standing orders" data-tour="orders">
          {TACTICS.map((x) => <Chip key={x.key} on={s.gates.tactic === x.key} onClick={() => store.update((y) => { y.gates.tactic = x.key; })}>{x.name}</Chip>)}
        </div>
        <p class="muted">{TACTICS.find((x) => x.key === s.gates.tactic)?.desc} The assessment above already fights with these orders.</p>
      </Section>

      <Section title="Satchel" right={`${s.satchel} of ${shop.FIELD_POTION.max} field potions`}>
        <p class="muted">{s.satchel
          ? `Drink one on your turn for ${shop.FIELD_POTION.heal * 100}% of your health back. What you do not drink stays in the satchel.`
          : 'Empty. Field potions are carried in and drunk on your turn; the Exchange sells them.'}
        {s.satchel < shop.FIELD_POTION.max && <> <button type="button" class="linkish" onClick={() => { close(); openExchange(); }}>To the Exchange</button></>}</p>
      </Section>

      {block === 'open' ? open?.id === d.id
        ? <Btn kind="primary" size="lg" block sound="gate" onClick={() => { close(); arena.set(d.id); }}>Go Back In</Btn>
        : <Btn block disabled>Finish or abandon {open?.name ?? 'the open run'} first</Btn>
        : block === 'locked' ? <Btn block disabled>Carried out. Fit to enter in {Math.ceil(hpNow.lockedFor / 36e5)}h</Btn>
          : block === 'down' ? <Btn block disabled>You are in no condition to enter anything.</Btn>
            : <Btn kind="primary" size="lg" block onClick={enter} sound="none" tour="enter">Enter The Gate</Btn>}

      <Section title="Your party" right={`${1 + party.length} hunters${squad.length ? ` · ${squad.length} Shadow${squad.length === 1 ? '' : 's'}` : ''}`}>
        <ul class="partylist" data-tour="party">
          <li class="is-you"><RankPlate rank={licensedRank(s)} size={22} /><b>{s.hunter.name}</b><small>you</small><span class="num">{powerOf(hero.base)}</span></li>
          {party.map((a) => (
            <li key={a.id}><RankPlate rank={a.rank} size={22} /><b>{a.name}</b><small>{a.note ?? a.role}{rankIdx(a.rank) > rankIdx(d.rank) ? ' ▲' : rankIdx(a.rank) < rankIdx(d.rank) ? ' ▼' : ''}</small><span class="num">{powerOf(a.base)}</span></li>
          ))}
          {squad.map((x) => (
            <li key={x.id} class="is-shadow"><RankPlate rank={enemyById(x.enemyId)!.rank} size={22} /><b>{enemyById(x.enemyId)!.shadow}</b><small>shadow</small><span class="num">{powerOf(shadows.statsOf(x))}</span></li>
          ))}
        </ul>
        {!isPractice(d) && shadows.freeSlots(s) > 0 && <p class="hint">{shadows.freeSlots(s)} Shadow slot{shadows.freeSlots(s) === 1 ? '' : 's'} empty. Deploy from the Shadows screen.</p>}
        {isPractice(d) && <p class="hint">Valcorde has signed you both in. Nothing in here is dangerous; everything on this sheet is.</p>}
      </Section>

    </div>
  );
}

async function intro() {
  await tour({
    who: 'coach', title: 'What am I looking at?', steps: [
      { at: 'licence', say: 'Your Association grade. It rises with your level, and your level rises with every gate you clear. You can always go one grade above it, if you are brave.' },
      { at: 'vitals', say: 'Health and mana carry between runs and come back on their own, about five per cent an hour. Fatigue builds with every gate and drags everything you are worth down until it fades.' },
      { at: 'bands', say: 'Ten gates at a time: one of every grade, so you can see the whole ladder, and at least two at your own. Clear one and another opens in its place. The whole board redraws at midnight.' },
      { at: 'board', say: 'The one at the top is mine. The Association keeps a practice gate shut for exactly this, and I have signed us both in. Open it, read the brief, then go in.' },
    ],
  });
}
