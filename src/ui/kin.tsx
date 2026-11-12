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
import { bonusText } from '@/core/gear';
import { enemyById } from '@/core/gates';
import * as kin from '@/core/kin';
import type { Shadow } from '@/core/types';
import { Section } from './components';
import { FamilyGlyph } from './emblems';
import { Glyph } from './icons';

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
      {shown && (
        <div class="kintip" role="note">
          <header class="kintip__head">
            <KinHex family={shown.kind === 'role' ? undefined : shown.name} role={shown.kind === 'role' ? shown.name : undefined} on={shown.tier > 0} />
            <b>{shown.kind === 'role' ? shown.name : `${shown.name} Kin`}</b>
            <small class="kintip__kind">{shown.kind === 'role' ? 'Formation' : `${shown.n} deployed`}</small>
          </header>
          {shown.kind === 'kin' && <Tiers family={shown.name} tier={shown.tier} />}
          {shown.kind === 'kin' && <small class="kintip__who">Each {shown.name} Shadow deployed</small>}
          {shown.kind === 'all' && <ul class="kintiers"><li class="is-on"><b class="num">(1)</b> Kin to every family</li></ul>}
          {shown.kind === 'role' && (
            <>
              <ul class="kintiers"><li class="is-on"><b class="num">(1)</b> {auraText(shown.name)}</li></ul>
              <small class="kintip__who">You and every Shadow</small>
            </>
          )}
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
