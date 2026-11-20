/**
 * The party, as the reference games set a team before a fight (docs/research/references/party/README.md), in two
 * places (the owner's call: the brief's board, its bonuses and its hint were a whole screen inside a section):
 * - On the brief, one row (`PartyRow`), as Honkai: Star Rail keeps its team as a strip of faces in a corner that opens
 *   Team Setup: every face in the order they stand, the Front's and the Rear's across a seam, an empty Shadow slot as a
 *   dashed square, the bonuses the squad reaches as their lit marks, and a chevron. A tap opens the window.
 * - The window (`openParty`), where everything about the party lives:
 *   - Its power, split by who brings it, as Solo Leveling: Arise's Battle Tier sets the hunter's, the hunters' and the
 *     Shadows' side by side.
 *   - The formation, as AFK Arena and Darkest Dungeon lay a lineup in rows: Front and Rear facing the enemies, a face
 *     dragged or tapped across.
 *   - The bonuses, as Genshin Impact's party setup states its Elemental Resonance and Teamfight Tactics its traits: a
 *     card to each role bonus and Kin the squad reaches, what it gives, how many count toward it, the one tooltip.
 *   - The members, as Epic Seven's and Arknights' squad screens list each unit's numbers: a row each, its face, what
 *     it is, where it stands and how it fights, its health, its blow, its guard and its speed, what the squad's
 *     bonuses add in green, its power; a tap opens its card.
 *   - The Army and Auto Deploy, for the Shadows.
 */
import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { sfx } from '@/audio/audio';
import { powerOf } from '@/core/combat';
import { tipStats } from '@/core/gear';
import { enemyById, isPractice, rankIdx } from '@/core/gates';
import * as hunters from '@/core/hunters';
import * as kin from '@/core/kin';
import { licensedRank } from '@/core/licence';
import * as raid from '@/core/raid';
import * as ranks from '@/core/ranks';
import * as shadows from '@/core/shadows';
import { isTrial } from '@/core/trial';
import type { Dungeon, Save, Shadow } from '@/core/types';
import type { Ally } from '@/core/gates';
import { dayKey } from '@/core/util';
import { classById, classFor } from '@/data/classes';
import { ROW_NAME, ROWS, type Row } from '@/data/ranks';
import type { SealId } from '@/data/seals';
import * as store from '@/store';
import { useSave } from '@/store';
import { Btn, RankPlate, Section } from '@/ui/components';
import { useDrag } from '@/ui/drag';
import { ShadowEmblem } from '@/ui/emblems';
import { buzz } from '@/ui/feedback';
import { Glyph, Sigil } from '@/ui/icons';
import { InfoTag } from '@/ui/infotag';
import { Keyed } from '@/ui/keyed';
import { familyTip, KIN_TIER, KinHex, ROLE_TIER, roleTip, Steps } from '@/ui/kin';
import { openSheet, toast } from '@/ui/overlays';
import { VersusCard, type VGroup, type VMark } from '@/ui/versus';
import { STYLE_GLYPH, styleOf, styleOfLead } from '@/ui/stand';
import { openHunter } from './Hunter';
import { openStatus } from './Inventory';
import { openArmy, openShadow } from './Shadows';

type Kind = 'you' | 'ally' | 'shadow';

/** One member as the row and the window show them, in the order they walk in. */
interface Member { key: string; kind: Kind; name: string; row: Row; power: number; face: ComponentChildren; ally?: Ally; shadow?: Shadow }

/** Who walks in, as the brief has always counted them: the hunter, the Association's hunters, the Shadows deployed. */
function partyOf(s: Save, d: Dungeon, level: number, taken: readonly SealId[]) {
  return {
    hero: raid.heroSpec(s),
    party: raid.alliesAt(d, dayKey(), licensedRank(s), level, taken),
    squad: isPractice(d) ? [] : shadows.squad(s),
  };
}

/** The party's power: the hunter's, each Association hunter's, each Shadow's. */
export function partyPower(s: Save, d: Dungeon, level: number, taken: readonly SealId[]) {
  const { hero, party, squad } = partyOf(s, d, level, taken);
  return powerOf(hero.base) + party.reduce((n, a) => n + powerOf(a.base), 0) + squad.reduce((n, x) => n + shadows.power(x), 0);
}

/** Every member, each with its face as the board draws it. */
function membersOf(s: Save, d: Dungeon, level: number, taken: readonly SealId[], size = 30): Member[] {
  const { hero, party, squad } = partyOf(s, d, level, taken);
  return [
    { key: 'you', kind: 'you' as const, name: s.hunter.name, row: ranks.heroRow(s), power: powerOf(hero.base), face: <Sigil rank={licensedRank(s)} size={size} /> },
    ...party.map((a) => ({ key: a.id, kind: 'ally' as const, name: a.name, row: ranks.byLead(classFor(a.base, a.rank)?.lead).row, power: powerOf(a.base), ally: a, face: <RankPlate rank={a.rank} size={Math.round(size * 0.86)} /> })),
    ...squad.map((x) => {
      const e = enemyById(x.enemyId)!;
      return { key: x.id, kind: 'shadow' as const, name: shadows.nameOf(x).replace(/^Shadow /, ''), row: shadows.standOf(x), power: shadows.power(x), shadow: x, face: <ShadowEmblem family={e.family} id={e.id} rank={shadows.rankIndex(x)} size={Math.round(size * 1.12)} /> };
    }),
  ];
}

/** The squad's live bonuses: each role it deploys at its tier, and each family that reaches one. */
function bonusesOf(squad: readonly Shadow[]) {
  const m = kin.makeOf(squad);
  return { m, roles: m.roleLines, kins: m.kin.filter((k) => k.tier > 0) };
}

// ------------------------------------------------------------------ the brief's card

/**
 * The party on the brief, one card under the enemies' (`ui/versus.tsx`): `Your party` and its power at its head, the
 * Front's faces and the Rear's, an empty Shadow slot as a dashed `+1`, and under them the bonuses the squad reaches,
 * each its lit hexagon and its name; a tap opens the window.
 */
export function PartyRow({ d, level, taken }: { d: Dungeon; level: number; taken: SealId[] }) {
  const s = useSave();
  const all = membersOf(s, d, level, taken, 30);
  const free = isPractice(d) ? 0 : shadows.freeSlots(s);
  const { roles, kins } = bonusesOf(isPractice(d) ? [] : shadows.squad(s));
  const power = partyPower(s, d, level, taken);
  const title = isTrial(d) ? 'Entering' : 'Your party';
  const said = [
    `${title}: ${all.map((x) => x.name).join(', ')}`,
    `Power ${power}`,
    roles.length ? `Role bonus ${roles.map((l) => `${l.role} ${ROLE_TIER[l.tier - 1]}`).join(', ')}` : '',
  ].filter(Boolean).join('. ');
  const group = (r: Row): VGroup => ({
    key: r, label: ROW_NAME[r],
    faces: all.filter((x) => x.row === r).map((x) => ({ key: x.key, kind: x.kind, face: x.face })),
    extra: r === 'front' && free > 0 ? <i class="vcard__face is-free num">+{free}</i> : undefined,
  });
  const marks: VMark[] = [
    ...roles.map((l) => ({ key: l.role, mark: <KinHex role={l.role} on />, name: `${l.role} ${ROLE_TIER[l.tier - 1]}` })),
    ...kins.map((k) => ({ key: k.family, mark: <KinHex family={k.family} on />, name: `${k.family} ${KIN_TIER[k.tier - 1]}` })),
  ];
  return (
    <VersusCard side="party" title={title} power={power} groups={[group('front'), group('rear')]} marks={marks} said={`${said}. Open the party.`}
      open={() => openParty(d, level, taken)} tour="party">
      {isPractice(d) && <p class="hint"><strong>[Ryn Valcorde]</strong> has joined your party.</p>}
    </VersusCard>
  );
}

// ------------------------------------------------------------------ the window

/** The party window, over the brief: everything about who walks in. */
export function openParty(d: Dungeon, level: number, taken: SealId[]) {
  openSheet({
    title: isTrial(d) ? 'Entering' : 'Party',
    system: { icon: <Glyph name="roster" />, kind: isTrial(d) ? 'gold' : 'gates' },
    render: () => <PartyWindow d={d} level={level} taken={taken} />,
  });
}

function PartyWindow({ d, level, taken }: { d: Dungeon; level: number; taken: SealId[] }) {
  const s = useSave();
  const all = membersOf(s, d, level, taken, 30);
  const squad = isPractice(d) ? [] : shadows.squad(s);
  const sheet = raid.partyReadout(s, d, dayKey(), Date.now(), level, taken);
  return (
    <div class="stack pwin">
      <PowerSplit all={all} />
      <Section title="Formation" right={<span class="num pwin__count">{ROWS.map((r) => `${all.filter((x) => x.row === r).length} ${ROW_NAME[r]}`).join(', ')}</span>}>
        <Formation d={d} level={level} taken={taken} />
      </Section>
      {!isPractice(d) && <Bonuses squad={squad} />}
      <Section title="Members" right={<span class="num pwin__count">{all.length}</span>}>
        <ul class="pmembers">
          {all.map((x, i) => <MemberRow key={x.key} x={x} i={i} d={d} read={sheet[i]} s={s} />)}
        </ul>
      </Section>
      {isPractice(d) && <p class="hint"><strong>[Ryn Valcorde]</strong> has joined your party.</p>}
      {!isPractice(d) && <ArmyActs />}
    </div>
  );
}

/**
 * The party's power, large, and one bar split by who brings it: the hunter's in the System's cyan, the Association's
 * hunters' in silver, the Shadows' in violet, each named and counted under it.
 */
function PowerSplit({ all }: { all: Member[] }) {
  const total = all.reduce((n, x) => n + x.power, 0);
  const part = (k: Kind) => all.filter((x) => x.kind === k).reduce((n, x) => n + x.power, 0);
  const parts = ([['you', 'You'], ['ally', 'Hunters'], ['shadow', 'Shadows']] as const).map(([k, name]) => ({ k, name, n: part(k) })).filter((p) => p.n > 0);
  return (
    <div class="pwin__power" role="group" aria-label={`Party power ${total}: ${parts.map((p) => `${p.name} ${p.n}`).join(', ')}`}>
      <span class="pwin__total">
        <small>Party power</small>
        <b class="num"><Glyph name="power" />{total}</b>
      </span>
      <span class="pwin__split" aria-hidden="true">
        {parts.map((p, i) => <i key={p.k} class={`is-${p.k}`} style={`flex: ${p.n}; --i: ${i}`} />)}
      </span>
      <span class="pwin__legend" aria-hidden="true">
        {parts.map((p) => <span key={p.k} class={`is-${p.k}`}><i />{p.name}<b class="num">{p.n}</b></span>)}
      </span>
    </div>
  );
}

/**
 * The party as a formation, after Idle Heroes' Hero Deployment: a board facing the enemies above it, the Front at its
 * head and the Rear under it, each member a face in the row they stand in, the hunter's own lit; the Shadow slots still
 * open dashed at the end of the Front. The hunter's face and each Shadow's are dragged to the row they would stand in,
 * or tapped to cross to the other; the choice is kept for every Gate after. An Association hunter's face opens their card.
 */
function Formation({ d, level, taken }: { d: Dungeon; level: number; taken: SealId[] }) {
  const s = useSave();
  const { hero, party, squad } = partyOf(s, d, level, taken);
  const here = ranks.heroRow(s);
  const other: Row = here === 'front' ? 'rear' : 'front';
  const stand = (r: Row) => {
    if (r === ranks.heroRow(store.get())) return;
    sfx.tap();
    buzz(12);
    store.update((x) => ranks.setStand(x, r));
  };
  // A Shadow is placed as the hunter is: dragged to a row, or tapped across. It keeps its place for every Gate after.
  const place = (id: string, r: Row) => {
    const sh = store.get().shadows.army.find((x) => x.id === id);
    if (!sh || r === shadows.standOf(sh)) return;
    sfx.tap();
    buzz(12);
    store.update((x) => shadows.setStand(x, id, r));
  };
  const cross = (r: Row): Row => (r === 'front' ? 'rear' : 'front');
  const drag = useDrag((id, at) => {
    if (at !== 'front' && at !== 'rear') return;
    if (id === 'you') stand(at);
    else place(id, at);
  });
  const liftedShadow = drag.lifted && drag.lifted !== 'you' ? squad.find((x) => x.id === drag.lifted) : undefined;
  const liftedRow: Row | null = drag.lifted === 'you' ? here : liftedShadow ? shadows.standOf(liftedShadow) : null;
  type Seat = { key: string; row: Row; el: preact.JSX.Element };
  const seats: Seat[] = [
    { key: 'you', row: here, el: (
      <li key="you" class={`bformation__one is-you is-drag ${drag.lifted === 'you' ? 'is-lifted' : ''}`} {...drag.handle('you')}>
        <button type="button" class="bformation__me" aria-label={`${s.hunter.name}, in the ${ROW_NAME[here]}. Tap to stand in the ${ROW_NAME[other]}, or drag to a row.`}
          onClick={() => stand(other)}>
          <span class="bformation__face"><Sigil rank={licensedRank(s)} size={30} /><Glyph name="grip" class="bformation__grip" /></span><b>{s.hunter.name}</b><small class="num">{powerOf(hero.base)}</small>
        </button>
      </li>
    ) },
    // An Association hunter opens their card when tapped: their class, kit, stats and record beside you.
    ...party.map((a) => ({ key: a.id, row: ranks.byLead(classFor(a.base, a.rank)?.lead).row, el: (
      <li key={a.id} class="bformation__one is-ally">
        <button type="button" class="bformation__me bformation__ally" data-hunter={a.id} aria-label={`${a.name}, ${a.rank}-Rank${hunters.isFavourite(s, a.id) ? ', a favourite' : ''}. Open their card.`} onClick={() => { sfx.tap(); openHunter(a); }}>
          {/* A hunter starred on their card wears the star on their face here. */}
          <span class="bformation__face"><RankPlate rank={a.rank} size={26} />{hunters.isFavourite(s, a.id) && <i class="bformation__fav" aria-hidden="true"><Glyph name="star" /></i>}</span><b>{a.name.split(' ')[0]}</b><small class="num">{powerOf(a.base)}<Versus a={a} d={d} /></small>
        </button>
      </li>
    ) })),
    ...squad.map((x) => {
      const e = enemyById(x.enemyId)!;
      const row = shadows.standOf(x);
      const name = shadows.nameOf(x).replace(/^Shadow /, '');
      return { key: x.id, row, el: (
        <li key={x.id} class={`bformation__one is-shadow is-drag ${drag.lifted === x.id ? 'is-lifted' : ''}`} {...drag.handle(x.id)}>
          <button type="button" class="bformation__me" aria-label={`${name}, in the ${ROW_NAME[row]}. Tap to place it in the ${ROW_NAME[cross(row)]}, or drag to a row.`}
            onClick={() => place(x.id, cross(row))}>
            <span class="bformation__face"><ShadowEmblem family={e.family} id={e.id} rank={shadows.rankIndex(x)} size={34} /><Glyph name="grip" class="bformation__grip" /></span><b>{name}</b><small class="num">{shadows.power(x)}</small>
          </button>
        </li>
      ) };
    }),
  ];
  const free = isPractice(d) ? 0 : shadows.freeSlots(s);
  return (
    <>
      <div class={`bformation ${drag.lifted ? 'is-dragging' : ''}`} {...drag.guard}>
        <span class="bformation__facing" aria-hidden="true"><Glyph name="up" />Facing the enemies</span>
        {ROWS.map((r) => {
          const on = seats.filter((x) => x.row === r);
          // While the hunter or a Shadow is lifted, the row it is not in waits for it, and lights under it.
          const target = liftedRow && r !== liftedRow ? `is-target ${drag.over === r ? 'is-over' : ''}` : '';
          return (
            <div key={r} data-drop={r} class={`bformation__rank is-${r} ${target}`}>
              <span class="bformation__label"><b>{ROW_NAME[r]}</b><small class="num">{on.length}</small></span>
              <ul class="bformation__seats" aria-label={`${ROW_NAME[r]}: ${on.length}`}>
                {on.map((x) => x.el)}
                {r === 'front' && Array.from({ length: free }, (_, i) => (
                  <li key={`free-${i}`} class="bformation__one is-free" aria-label="Shadow slot empty"><span class="bformation__face"><Glyph name="plus" /></span><b>Free</b><small> </small></li>
                ))}
                {!on.length && r === 'rear' && <li class="bformation__none">No one stands behind</li>}
              </ul>
            </div>
          );
        })}
      </div>
      <p class="bformation__hint"><Glyph name="grip" />{squad.length ? 'Drag yourself or a Shadow to the Front or the Rear. A tap crosses over.' : 'Drag yourself to the Front or the Rear. A tap crosses over.'}</p>
      {/* The ghost lives on the page, not in the sheet, so a transform on the sheet cannot move it off the pointer. */}
      {createPortal(
        <div class={`dragghost dragghost--you ${liftedShadow ? 'is-shadow' : ''}`} ref={drag.ghost} hidden={!liftedRow} aria-hidden="true">
          {liftedShadow
            ? (() => { const e = enemyById(liftedShadow.enemyId)!; return <><ShadowEmblem family={e.family} id={e.id} rank={shadows.rankIndex(liftedShadow)} size={34} /><b>{shadows.nameOf(liftedShadow).replace(/^Shadow /, '')}</b></>; })()
            : <><Sigil rank={licensedRank(s)} size={30} /><b>{s.hunter.name}</b></>}
        </div>,
        document.body,
      )}
    </>
  );
}

/** An Association hunter's grade against the Gate's: green up, red down, nothing level. */
function Versus({ a, d }: { a: Ally; d: Dungeon }) {
  if (rankIdx(a.rank) > rankIdx(d.rank)) return <i class="bformation__vs is-up" aria-label="above the Gate's grade"> ▲</i>;
  if (rankIdx(a.rank) < rankIdx(d.rank)) return <i class="bformation__vs is-down" aria-label="under the Gate's grade"> ▼</i>;
  return null;
}

/**
 * What the squad's roles and Kin give, a card to each, as Genshin's party setup states its Elemental Resonance: the
 * mark lit in its hexagon, the name and the tier, what it gives in the tooltip's own words and colours, and how many
 * count toward its breakpoints (`1 › 2 › 3`); a tap opens the one tooltip. Under them, what every member gains.
 */
function Bonuses({ squad }: { squad: readonly Shadow[] }) {
  const { m, roles, kins } = bonusesOf(squad);
  const none = !roles.length && !kins.length;
  return (
    <Section title="Bonuses" right={!none ? <span class="num pwin__count">{roles.length + kins.length}</span> : undefined}>
      {none
        ? <p class="pwin__empty">{squad.length ? 'No bonus reached.' : 'No Shadows deployed.'}</p>
        : (
          <>
            <ul class="pbonuses">
              {roles.map((l) => (
                <li key={l.role}>
                  <InfoTag class="pbonus is-role" tip={roleTip(l.role, l.tier)}>
                    <KinHex role={l.role} on />
                    <span class="pbonus__body">
                      <span class="pbonus__name"><b>{l.role}</b><span class="pbonus__tier">{ROLE_TIER[l.tier - 1]}</span></span>
                      <small class="pbonus__gain"><Keyed text={tipStats(kin.roleBoon(l.role, l.tier))} /></small>
                    </span>
                    <span class="pbonus__steps"><small>Role bonus</small><Steps n={l.n} at={kin.ROLE_AT} /></span>
                  </InfoTag>
                </li>
              ))}
              {kins.map((k) => (
                <li key={k.family}>
                  <InfoTag class="pbonus is-kin" tip={familyTip(k.family, k.tier)}>
                    <KinHex family={k.family} on />
                    <span class="pbonus__body">
                      <span class="pbonus__name"><b>{k.family}</b><span class="pbonus__tier">{KIN_TIER[k.tier - 1]}</span></span>
                      <small class="pbonus__gain"><Keyed text={tipStats(kin.kinBoon(k.family, k.tier))} /></small>
                    </span>
                    <span class="pbonus__steps"><small>Kin</small><Steps n={k.n} /></span>
                  </InfoTag>
                </li>
              ))}
            </ul>
            {Object.keys(m.aura).length > 0 && <p class="pwin__aura"><Glyph name="up" /><span>Every member: {tipStats(m.aura)}</span></p>}
          </>
        )}
    </Section>
  );
}

/**
 * A member's row: its face, its name, what it is (a class, a grade and a class, a role and a family), where it stands
 * and how it fights, its power; under them its health, its blow (Attack or Magic, whichever it leans on), its guard and
 * its speed, each with what the squad's bonuses add in green. A tap opens its card: the hunter's Status, an Association
 * hunter's card, a Shadow's card.
 */
function MemberRow({ x, i, d, read, s }: { x: Member; i: number; d: Dungeon; read: ReturnType<typeof raid.partyReadout>[number] | undefined; s: Save }) {
  const what = x.kind === 'you'
    ? classById(s.hunter.classId)?.name ?? 'Unclassed'
    : x.ally ? `${x.ally.rank}-Rank ${hunters.classOf(x.ally)?.name ?? 'Hunter'}`
      : (() => { const e = enemyById(x.shadow!.enemyId)!; return `${e.role}, ${e.family}`; })();
  const style = x.shadow ? styleOf(enemyById(x.shadow.enemyId)!.role) : x.ally ? styleOfLead(ranks.byLead(hunters.classOf(x.ally)?.lead)) : styleOfLead({ ...ranks.heroStand(s), row: ranks.heroStand(s).ranged ? 'rear' : 'front' });
  const open = () => { sfx.tap(); if (x.kind === 'you') openStatus(); else if (x.ally) openHunter(x.ally); else if (x.shadow) openShadow(x.shadow.id); };
  const n = read?.now;
  const was = read?.alone;
  const magic = n?.leans === 'magic';
  const stats: { k: string; v: number; up: number }[] = n && was ? [
    { k: 'HP', v: n.hp, up: n.hp - was.hp },
    magic ? { k: 'Magic', v: n.magic, up: n.magic - was.magic } : { k: 'Attack', v: n.attack, up: n.attack - was.attack },
    { k: 'Defence', v: n.defence, up: n.defence - was.defence },
    { k: 'Initiative', v: n.speed, up: n.speed - was.speed },
  ] : [];
  return (
    <li class={`pmember is-${x.kind}`} style={`--i: ${i}`}>
      <button type="button" class="pmember__hit" data-member={x.key} aria-label={`${x.name}, ${what}, in the ${ROW_NAME[x.row]}, ${style}. Power ${x.power}. ${stats.map((t) => `${t.k} ${t.v}`).join(', ')}. Open their card.`} onClick={open}>
        <span class="pmember__face" aria-hidden="true">{x.face}{x.ally && hunters.isFavourite(s, x.ally.id) && <i class="bformation__fav"><Glyph name="star" /></i>}</span>
        <span class="pmember__who">
          <b class="pmember__name">{x.name}{x.ally && <Versus a={x.ally} d={d} />}</b>
          <small class="pmember__what">{what}</small>
          <span class="pmember__tags" aria-hidden="true">
            <span class={`pmember__tag is-${x.row}`}>{ROW_NAME[x.row]}</span>
            <span class="pmember__tag"><Glyph name={STYLE_GLYPH[style]} />{style}</span>
          </span>
        </span>
        <span class="pmember__power" aria-hidden="true"><Glyph name="power" /><b class="num">{x.power}</b></span>
        <Glyph name="chevron" class="pmember__go" />
        {stats.length > 0 && (
          <span class="pmember__stats" aria-hidden="true">
            {stats.map((t) => (
              <span key={t.k} class="pmember__stat">
                <small>{t.k}</small>
                <b class="num">{t.v}{t.up > 0 && <i class="pmember__up">+{t.up}</i>}</b>
              </span>
            ))}
          </span>
        )}
      </button>
    </li>
  );
}

/** The Shadows' way out of the window: the Army, and Auto Deploy while a better squad waits. */
function ArmyActs() {
  const s = useSave();
  const squad = shadows.squad(s);
  const best = shadows.bestSquad(s);
  const settled = best.length === squad.length && best.every((id) => squad.some((x) => x.id === id));
  if (!s.shadows.army.length) return null;
  return (
    <div class="pwin__acts">
      <Btn class="pwin__act" size="sm" kind="ghost" onClick={() => { sfx.tap(); openArmy(); }}><Glyph name="shadows" /> Army</Btn>
      <Btn class="pwin__act" size="sm" disabled={settled} onClick={() => { store.update((x) => shadows.autoDeploy(x)); sfx.blip(); toast('Squad deployed.', 'good'); }}><Glyph name="spark" /> Auto Deploy</Btn>
    </div>
  );
}
