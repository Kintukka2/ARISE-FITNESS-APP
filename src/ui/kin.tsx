/**
 * Kin and Formation as the Army shows them, after the trait trackers of the reference games: Teamfight
 * Tactics lists each trait as a hexagon with the count fielded, its name and its breakpoints (`2 › 3`,
 * the one reached lit; `1 / 2` while short), grey until the first, and tells what each breakpoint gives
 * in a tooltip (`(2) Attack +10%`). Solo Leveling: Arise writes a Shadow's aura under its stats as a name
 * over one line (`Shadow's Authority` / `Increases entire team's Defense`). Every number is read from
 * `data/kin.ts` through `core/kin.ts`.
 */
import { useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { bonusText, tipGain, tipNames, tipStats } from '@/core/gear';
import { enemyById } from '@/core/gates';
import * as kin from '@/core/kin';
import type { Shadow } from '@/core/types';
import { Section } from './components';
import { FamilyGlyph } from './emblems';
import { Glyph } from './icons';
import { TipBody, type TipText } from './tip';

/** Each role's mark. */
export const ROLE_GLYPH: Record<string, string> = {
  Brute: 'fist', Assassin: 'dagger', Flier: 'dash', 'Archer / Shooter': 'arrow',
  Guardian: 'shield', Caster: 'spark', Leader: 'crown', 'Status Specialist': 'venom',
};

/** A Kin's tier as a numeral. */
export const KIN_TIER = ['I', 'II'] as const;

/** A family's boon at each tier in words: `Attack +10%`, `Attack +20%`. */
export const kinText = (family: string, tier: number) => bonusText(kin.kinBoon(family, tier));

/** A role's aura in words: `Defence +5%`. */
export const auraText = (role: string) => bonusText(kin.FORMATION[role] ?? {});

const an = (word: string) => (/^[AEIOU]/.test(word) ? 'an' : 'a');

/**
 * What a Shadow's family is to the squad, in the game's one tooltip (`ui/tip.tsx`), as Teamfight Tactics
 * tells a trait: the family by its mark and name, `Kin` at the head's right, one sentence of what it gives and
 * to whom, then each breakpoint and what it gives, the one the squad reaches lit (`tier`, 0 while short).
 */
export function familyTip(family: string, tier: number): TipText {
  const mark = <span class="tip__mark"><FamilyGlyph family={family} size={16} /></span>;
  const head = { title: family, kind: 'Kin', mark, tone: 'shadow' as const };
  if (family === kin.KIN_ALL) {
    return { ...head, lines: ['Counts as every family. Deployed, it adds to each Kin beside it and gains the bonus of each one it completes.'] };
  }
  const boon = kin.KIN[family];
  if (!boon) return { ...head, lines: [] };
  return {
    ...head,
    lines: [`Deployed together, ${family} Shadows each gain ${tipNames(boon)}.`],
    tiers: kin.KIN_AT.map((at, i) => ({ at, text: tipStats(kin.kinBoon(family, i + 1)), on: tier === i + 1 })),
  };
}

/**
 * What a Shadow's role gives the squad, in the game's one tooltip: its Formation's aura and nothing else, as
 * Teamfight Tactics' role tip says only what the role does. Where the Shadow stands decides nothing here (the
 * aura holds wherever it stands, and its role sets its rank), so the tooltip does not say it.
 */
export function roleTip(role: string): TipText {
  const aura = kin.FORMATION[role];
  return {
    title: role,
    kind: 'Formation',
    mark: <span class="tip__mark"><Glyph name={ROLE_GLYPH[role] ?? 'shadows'} /></span>,
    tone: 'shadow',
    lines: aura ? [`While ${an(role)} ${role} is deployed, you and every Shadow gain ${tipGain(aura)}.`] : [],
  };
}

/** The squad's Kin and Formation in one line, for the brief: `Kin: Orc II · Formation: Brute, Caster`. */
export function makeLine(squad: readonly Shadow[]): string | null {
  const m = kin.makeOf(squad);
  const lit = m.kin.filter((k) => k.tier > 0).map((k) => `${k.family} ${KIN_TIER[k.tier - 1]}`);
  const parts = [lit.length ? `Kin: ${lit.join(', ')}` : null, m.roles.length ? `Formation: ${m.roles.join(', ')}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** A trait's mark, in a hexagon: lit while it is active, grey while it is short. */
export function KinHex({ family, role, on }: { family?: string; role?: string; on: boolean }) {
  return (
    <span class={`kinhex ${on ? 'is-on' : ''}`} aria-hidden="true">
      {family ? <FamilyGlyph family={family} size={16} /> : <Glyph name={ROLE_GLYPH[role ?? ''] ?? 'shadows'} />}
    </span>
  );
}

/** Breakpoints as Teamfight Tactics writes them: `2 › 3` once the first is reached, the one reached lit; `1 / 2` while short. */
export function Steps({ n }: { n: number }) {
  if (n < kin.KIN_AT[0]) return <span class="kinsteps num">{n} / {kin.KIN_AT[0]}</span>;
  return (
    <span class="kinsteps num">
      {kin.KIN_AT.map((at, i) => <span key={at}>{i > 0 && <i>›</i>}<b class={n >= at && (kin.KIN_AT[i + 1] === undefined || n < kin.KIN_AT[i + 1]) ? 'is-on' : ''}>{at}</b></span>)}
    </span>
  );
}

/** Each breakpoint and what it gives, as a trait's tooltip lists them: `(2) Attack +10%`, the one reached lit. */
function Tiers({ family, tier }: { family: string; tier: number }) {
  return (
    <ul class="kintiers">
      {kin.KIN_AT.map((at, i) => (
        <li key={at} class={tier === i + 1 ? 'is-on' : ''}><b class="num">({at})</b> {kinText(family, i + 1)}</li>
      ))}
    </ul>
  );
}

type Trait = { key: string; kind: 'kin' | 'all' | 'role'; name: string; n: number; tier: number };

/**
 * The squad's traits, as Teamfight Tactics tracks them beside the board: a chip to each family deployed
 * and to each role, its hexagon lit while it is active, its count, its name and its breakpoints; the
 * active ones first. A tap opens what it gives under them, as the tracker's tooltip does, and another
 * closes it.
 */
export function KinTracker({ squad }: { squad: readonly Shadow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!squad.length) return null;
  const m = kin.makeOf(squad);
  const roleCount = new Map<string, number>();
  for (const sh of squad) { const r = enemyById(sh.enemyId)?.role; if (r) roleCount.set(r, (roleCount.get(r) ?? 0) + 1); }
  const traits: Trait[] = [
    ...m.kin.map((k): Trait => ({ key: `kin:${k.family}`, kind: 'kin', name: k.family, n: k.n, tier: k.tier })),
    ...(m.wild ? [{ key: 'all', kind: 'all', name: kin.KIN_ALL, n: m.wild, tier: 1 } as Trait] : []),
    ...m.roles.map((r): Trait => ({ key: `role:${r}`, kind: 'role', name: r, n: roleCount.get(r) ?? 1, tier: 1 })),
  ].sort((a, b) => Number(b.tier > 0) - Number(a.tier > 0));
  const shown = traits.find((t) => t.key === open) ?? null;
  const tap = (key: string) => { sfx.tap(); setOpen(open === key ? null : key); };
  return (
    <div class="kintrack">
      <span class="label kintrack__head">Kin & Formation</span>
      <ul class="kintrack__list">
        {traits.map((t) => (
          <li key={t.key}>
            <button type="button" class={`kinchip kinchip--${t.kind} ${t.tier ? 'is-on' : ''} ${open === t.key ? 'is-open' : ''}`}
              aria-expanded={open === t.key} onClick={() => tap(t.key)}
              aria-label={t.kind === 'role' ? `Formation, ${t.name}: ${auraText(t.name)}` : t.kind === 'all' ? `${t.name}: kin to every family` : `${t.name} Kin: ${t.n} deployed${t.tier ? `, tier ${KIN_TIER[t.tier - 1]}` : `, ${kin.KIN_AT[0]} needed`}`}>
              <KinHex family={t.kind === 'role' ? undefined : t.name} role={t.kind === 'role' ? t.name : undefined} on={t.tier > 0} />
              <b class="kinchip__n num">{t.n}</b>
              <span class="kinchip__body">
                <span class="kinchip__name">{t.name}</span>
                {t.kind === 'kin' ? <Steps n={t.n} /> : <small class="kinchip__sub">{t.kind === 'role' ? 'Formation' : 'Kin to every family'}</small>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* What a chip gives opens under the chips in the game's one tooltip, as the trait tracker's tooltip does. */}
      {shown && (
        <div class="tip tip--shadow tip--inline" role="note">
          <TipBody {...(shown.kind === 'role' ? roleTip(shown.name) : familyTip(shown.name, shown.tier))} />
        </div>
      )}
    </div>
  );
}

/**
 * What a Shadow brings to a squad, on its card, as Solo Leveling: Arise sets a Shadow's aura under its
 * stats: a name over one line, hairlines between. Its role's aura under `Formation · Leader`, lit while
 * it is deployed; its family's Kin under `Orc Kin`, each breakpoint and what it gives, the one its squad
 * reaches lit.
 */
export function KinOfShadow({ sh, family, role, squad }: { sh: Shadow; family: string; role: string; squad: readonly Shadow[] }) {
  const on = squad.includes(sh);
  const m = on ? kin.makeOf(squad) : null;
  const tier = m ? (family === kin.KIN_ALL ? Math.max(0, ...m.kin.map((k) => k.tier)) : m.kin.find((k) => k.family === family)?.tier ?? 0) : 0;
  return (
    <Section title="Kin & Formation">
    <div class="sp-auth">
      <div class="sp-auth__row">
        <span class="sp-auth__name"><Glyph name={ROLE_GLYPH[role] ?? 'shadows'} />Formation · {role}</span>
        <p class={on ? 'is-on' : ''}>{auraText(role)} for you and every Shadow</p>
      </div>
      <div class="sp-auth__row">
        <span class="sp-auth__name"><FamilyGlyph family={family} size={13} />{family} Kin</span>
        {family === kin.KIN_ALL
          ? <p class={tier ? 'is-on' : ''}>Kin to every family</p>
          : <Tiers family={family} tier={tier} />}
      </div>
    </div>
    </Section>
  );
}
