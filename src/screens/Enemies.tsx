/**
 * Who stands in the Gate, set out as the party is (`screens/Party.tsx`; the owner's call: the enemies and the party
 * alike, each a card on the brief that opens a window of its own, `VS` between them):
 * - On the brief (`EnemiesRow`), over the party's card: `Enemies` and their power at its head, the boss, the
 *   Gatekeeper and the rest of what walks in the Gate in their groups, `?` until known, and under them the habits seen,
 *   each its mark and its name. One of the Chosen holding the Gate stands in the boss's place, crowned in gold.
 * - The window (`openEnemies`), as the party's window is laid:
 *   - Their power, split by who brings it: the boss's in red, the Gatekeeper's in gold, the rest's in grey.
 *   - The Chosen out in the Gates, where one holds this one.
 *   - Their habits, a card to each, as the party's bonuses are: its mark, its name, who shows it, the one tooltip.
 *   - A row to each creature, as the party's members are: its face, what it is, where it stands and how it fights,
 *     its power, and its numbers as this Gate fields it (its tuning, the Ascension level and the Seals taken). A tap
 *     opens its card.
 */
import { powerText } from '@/ui/power';
import type { ComponentChildren } from 'preact';
import { powerOf } from '@/core/combat';
import { bossKnown, enemyById, mapKnown } from '@/core/gates';
import * as raid from '@/core/raid';
import { isTrial } from '@/core/trial';
import type { Dungeon, Enemy } from '@/core/types';
import { ROW_NAME } from '@/data/ranks';
import type { SealId } from '@/data/seals';
import { TRICKS, tricksOf, type TrickId } from '@/data/tricks';
import { useSave } from '@/store';
import { Section } from '@/ui/components';
import { HabitMark } from '@/ui/effects';
import { Glyph } from '@/ui/icons';
import { InfoTag } from '@/ui/infotag';
import { openSheet } from '@/ui/overlays';
import { Portrait } from '@/ui/portraits';
import { STYLE_GLYPH, styleOf } from '@/ui/stand';
import type { TipText } from '@/ui/tip';
import { VersusCard, type VGroup, type VMark } from '@/ui/versus';
import { bossOf, ChosenLine, openCreature } from './Brief';
import { sfx } from '@/audio/audio';

type Kind = 'boss' | 'elite' | 'mob';

/** One of the Gate's creatures as the card and the window show it: known or still `?`. */
interface Foe { key: string; kind: Kind; e: Enemy | null; name: string; what: string; power: number | null; face: ComponentChildren; chosen?: boolean }

/** Everyone who stands in the Gate: the boss (or the Chosen in its place, or the Trial's Chosen), the Gatekeeper, the rest. */
function foesOf(s: ReturnType<typeof useSave>, d: Dungeon, level: number, size = 30): Foe[] {
  const { met, who } = bossOf(s, d, level);
  const known = bossKnown(s, d);
  const seen = mapKnown(s, d);
  const boss = enemyById(d.boss)!;
  const unknown = (key: string, kind: Kind, what: string): Foe => ({ key, kind, e: null, name: '?', what, power: null, face: <Glyph name="unknown" /> });
  const head: Foe = met
    ? { key: 'chosen', kind: 'boss', e: null, name: met.name, what: 'In the boss’s place', power: powerOf(met.base), face: <Glyph name="crown" />, chosen: true }
    : isTrial(d)
      ? { key: 'trial', kind: 'boss', e: null, name: `${d.trial} Chosen`, what: 'One after another', power: who ? powerOf(who.base) : null, face: <Glyph name="crown" />, chosen: true }
      : known
        ? { key: boss.id, kind: 'boss', e: boss, name: boss.name, what: 'Gate boss', power: powerOf(boss.base), face: <Portrait id={boss.id} size={Math.round(size * 1.2)} tone="red" /> }
        : unknown('boss', 'boss', 'Gate boss');
  // The Gatekeeper stands next after the boss, then the rest of what walks in the Gate.
  const inside = isTrial(d) ? [] : [...new Set([...(d.elite ? [d.elite] : []), ...d.mobs])].map((id) => enemyById(id)).filter((e): e is Enemy => !!e);
  return [head, ...inside.map((e): Foe => {
    const kind: Kind = e.id === d.elite ? 'elite' : 'mob';
    const what = kind === 'elite' ? 'Gatekeeper' : `${e.rank}-Rank ${e.family}`;
    return seen ? { key: e.id, kind, e, name: e.name, what, power: powerOf(e.base), face: <Portrait id={e.id} size={size} tone="foe" /> } : unknown(e.id, kind, kind === 'elite' ? 'Gatekeeper' : 'Unidentified');
  })];
}

/** Every habit seen among them, once each, with who shows it and the grade its numbers are read at. */
function habitsOf(foes: Foe[]) {
  const by = new Map<TrickId, { who: string[]; grade: string }>();
  for (const f of foes) {
    if (!f.e) continue;
    for (const h of tricksOf(f.e, f.kind !== 'mob')) {
      const at = by.get(h) ?? { who: [], grade: String(f.e.rank) };
      at.who.push(f.name);
      by.set(h, at);
    }
  }
  return [...by].map(([id, v]) => ({ id, ...v }));
}

/** A habit in the one tooltip, as the fight tells it: its mark, its name, `Habit`, what it does. */
const habitTip = (id: TrickId, grade: string): TipText => ({
  title: TRICKS[id].name, kind: 'Habit', tone: 'gate',
  mark: <span class="tip__mark"><HabitMark id={id} size={17} /></span>,
  lines: [TRICKS[id].about(grade)],
});

/** A habit's mark in a hexagon lit red, as a bonus's is lit violet. */
const HabitHex = ({ id }: { id: TrickId }) => <span class="kinhex is-on is-habit"><HabitMark id={id} size={13} /></span>;

// ------------------------------------------------------------------ the brief's card

/** The enemies on the brief, one card over the party's: their power, their faces in groups, the habits seen under them. */
export function EnemiesRow({ d, level, taken }: { d: Dungeon; level: number; taken: SealId[] }) {
  const s = useSave();
  const foes = foesOf(s, d, level, 30);
  const habits = habitsOf(foes);
  const power = enemyPower(foes);
  const group = (kind: Kind, label: string): VGroup => ({ key: kind, label, faces: foes.filter((f) => f.kind === kind).map((f) => ({ key: f.key, kind: `${kind}${f.e || f.chosen ? '' : ' is-unknown'}${f.chosen ? ' is-chosen' : ''}`, face: f.face })) });
  const marks: VMark[] = habits.map((h) => ({ key: h.id, mark: <HabitHex id={h.id} />, name: TRICKS[h.id].name }));
  const said = [
    `Enemies: ${foes.map((f) => (f.e || f.chosen ? `${f.name}, ${f.what}` : f.what)).join('; ')}`,
    power === null ? 'Power unknown' : `Power ${powerText(power)}`,
    habits.length ? `Habits ${habits.map((h) => TRICKS[h.id].name).join(', ')}` : '',
  ].filter(Boolean).join('. ');
  return (
    <VersusCard side="foes" title="Enemies" power={power} groups={[group('boss', isTrial(d) ? `${d.trial} Chosen` : 'Boss'), group('elite', 'Gatekeeper'), group('mob', 'Creatures')]}
      marks={marks} said={`${said}. Open the enemies.`} open={() => openEnemies(d, level, taken)} tour="boss" />
  );
}

/** Their power, each kind counted once: every one known, or `?` while any is not. */
function enemyPower(foes: Foe[]): number | null {
  return foes.every((f) => f.power !== null) ? foes.reduce((n, f) => n + (f.power ?? 0), 0) : null;
}

// ------------------------------------------------------------------ the window

/** The enemies' window, over the brief: everything about who stands in the Gate. */
export function openEnemies(d: Dungeon, level: number, taken: SealId[]) {
  openSheet({
    title: isTrial(d) ? 'The Chosen' : 'Enemies',
    system: { icon: <Glyph name="roomBoss" />, kind: isTrial(d) ? 'gold' : 'gates' },
    render: () => <EnemiesWindow d={d} level={level} taken={taken} />,
  });
}

function EnemiesWindow({ d, level, taken }: { d: Dungeon; level: number; taken: SealId[] }) {
  const s = useSave();
  const foes = foesOf(s, d, level, 30);
  const habits = habitsOf(foes);
  const { holds } = bossOf(s, d, level);
  return (
    <div class="stack pwin is-foes">
      <FoePower foes={foes} />
      {holds && <ChosenLine d={d} w={holds} level={level} />}
      <Section title="Habits" right={habits.length ? <span class="num pwin__count">{habits.length}</span> : undefined}>
        {habits.length
          ? (
            <ul class="pbonuses">
              {habits.map((h) => (
                <li key={h.id}>
                  <InfoTag class="pbonus is-habit" tip={habitTip(h.id, h.grade)}>
                    <HabitHex id={h.id} />
                    <span class="pbonus__body">
                      <span class="pbonus__name"><b>{TRICKS[h.id].name}</b></span>
                      <small class="pbonus__gain">{h.who.join(', ')}</small>
                    </span>
                    <span class="pbonus__steps"><small>Habit</small></span>
                  </InfoTag>
                </li>
              ))}
            </ul>
          )
          : <p class="pwin__empty">{foes.some((f) => f.e) ? 'No habits.' : 'Nothing seen yet.'}</p>}
      </Section>
      <Section title={isTrial(d) ? 'The Chosen' : 'Creatures'} right={<span class="num pwin__count">{foes.length}</span>}>
        <ul class="pmembers">
          {foes.map((f, i) => <FoeRow key={f.key} f={f} i={i} d={d} level={level} taken={taken} />)}
        </ul>
      </Section>
    </div>
  );
}

/** Their power, large, and one bar split by who brings it: the boss in red, the Gatekeeper in gold, the rest in grey. */
function FoePower({ foes }: { foes: Foe[] }) {
  const total = enemyPower(foes);
  const part = (k: Kind) => foes.filter((f) => f.kind === k);
  const parts = ([['boss', 'Boss'], ['elite', 'Gatekeeper'], ['mob', 'Creatures']] as const)
    .map(([k, name]) => ({ k, name, all: part(k) }))
    .filter((p) => p.all.length)
    .map((p) => ({ ...p, n: p.all.every((f) => f.power !== null) ? p.all.reduce((n, f) => n + (f.power ?? 0), 0) : null }));
  return (
    <div class="pwin__power" role="group" aria-label={`Enemy power ${total === null ? 'unknown' : powerText(total)}: ${parts.map((p) => `${p.name} ${p.n === null ? 'unknown' : powerText(p.n)}`).join(', ')}`}>
      <span class="pwin__total">
        <small>Enemy power</small>
        <b class="num"><Glyph name="power" />{total === null ? '?' : powerText(total)}</b>
      </span>
      <span class="pwin__split" aria-hidden="true">
        {parts.map((p, i) => <i key={p.k} class={`is-${p.k} ${p.n === null ? 'is-unknown' : ''}`} style={`flex: ${p.n ?? Math.max(1, ...parts.map((q) => q.n ?? 0)) / 2}; --i: ${i}`} />)}
      </span>
      <span class="pwin__legend" aria-hidden="true">
        {parts.map((p) => <span key={p.k} class={`is-${p.k}`}><i />{p.name}<b class="num">{p.n === null ? '?' : powerText(p.n)}</b></span>)}
      </span>
    </div>
  );
}

/**
 * A creature's row, as a member's is: its face, its name, what it is, where it stands and how it fights, its power;
 * under them its HP, its blow (Attack or Magic), its guard and its speed as this Gate fields it. `?` until it is known,
 * and then nothing to open. A tap opens its card.
 */
function FoeRow({ f, i, d, level, taken }: { f: Foe; i: number; d: Dungeon; level: number; taken: SealId[] }) {
  const read = f.e ? raid.foeReadout(d, f.e.id, f.kind, level, taken) : null;
  const style = f.e ? styleOf(f.e.role) : null;
  const row = read?.row ?? null;
  const magic = read?.leans === 'magic';
  const stats = read ? [
    { k: 'HP', v: read.hp },
    magic ? { k: 'Magic', v: read.magic } : { k: 'Attack', v: read.attack },
    { k: 'Defence', v: read.defence },
    { k: 'Initiative', v: read.speed },
  ] : [];
  const body = (
    <>
      <span class="pmember__face" aria-hidden="true">{f.face}</span>
      <span class="pmember__who">
        <b class="pmember__name">{f.name}</b>
        <small class="pmember__what">{f.what}</small>
        {row && style && (
          <span class="pmember__tags" aria-hidden="true">
            <span class={`pmember__tag is-${row}`}>{ROW_NAME[row]}</span>
            <span class="pmember__tag"><Glyph name={STYLE_GLYPH[style]} />{style}</span>
          </span>
        )}
      </span>
      <span class="pmember__power" aria-hidden="true"><Glyph name="power" /><b class="num">{f.power === null ? '?' : powerText(f.power)}</b></span>
      {f.e && <Glyph name="chevron" class="pmember__go" />}
      {stats.length > 0 && (
        <span class="pmember__stats" aria-hidden="true">
          {stats.map((t) => <span key={t.k} class="pmember__stat"><small>{t.k}</small><b class="num">{t.v}</b></span>)}
        </span>
      )}
    </>
  );
  const label = f.e
    ? `${f.name}, ${f.what}, in the ${ROW_NAME[row!]}, ${style}. Power ${powerText(f.power ?? 0)}. ${stats.map((t) => `${t.k} ${t.v}`).join(', ')}. Open its card.`
    : f.chosen ? `${f.name}, ${f.what}. Power ${f.power === null ? 'unknown' : powerText(f.power)}.` : `${f.what}, not yet identified.`;
  return (
    <li class={`pmember is-${f.kind} ${f.e || f.chosen ? '' : 'is-unknown'}`} style={`--i: ${i}`}>
      {f.e
        ? <button type="button" class="pmember__hit" data-foe={f.key} aria-label={label} onClick={() => { sfx.tap(); openCreature(f.e!.id, d); }}>{body}</button>
        : <span class="pmember__hit" role="group" aria-label={label}>{body}</span>}
    </li>
  );
}
