/**
 * Kin and Formation as the Army shows them, after the trait trackers of the reference games (Teamfight
 * Tactics, Dota Underlords): each family in the squad with its count and its steps, the step reached lit,
 * and what its boon does at that step; then each role deployed with the aura it gives. Every number is
 * read from `data/kin.ts` through `core/kin.ts`.
 */
import { bonusText } from '@/core/gear';
import * as kin from '@/core/kin';
import type { Shadow } from '@/core/types';
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

/** The squad's Kin and Formation in one line, for the brief: `Kin: Orc II · Formation: Brute, Caster`. */
export function makeLine(squad: readonly Shadow[]): string | null {
  const m = kin.makeOf(squad);
  const lit = m.kin.filter((k) => k.tier > 0).map((k) => `${k.family} ${KIN_TIER[k.tier - 1]}`);
  const parts = [lit.length ? `Kin: ${lit.join(', ')}` : null, m.roles.length ? `Formation: ${m.roles.join(', ')}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** A Kin's steps, `2 › 3`, the ones reached lit. */
function Steps({ n }: { n: number }) {
  return (
    <span class="kinrow__steps" aria-hidden="true">
      {kin.KIN_AT.map((at, i) => <span key={at}>{i > 0 && <i>›</i>}<b class={n >= at ? 'is-on' : ''}>{at}</b></span>)}
    </span>
  );
}

/**
 * The squad's Kin and Formation: a row to each family deployed, its count, its steps and what it gives
 * at the step reached (or, short of the first, what the first would give, dimmed); the family kin to
 * every other, when one is deployed; then a chip to each role deployed, with its aura.
 */
export function KinTracker({ squad }: { squad: readonly Shadow[] }) {
  if (!squad.length) return null;
  const m = kin.makeOf(squad);
  return (
    <div class="kintrack">
      <span class="label kintrack__head">Kin</span>
      <ul class="kintrack__kin">
        {m.kin.map((k) => (
          <li key={k.family} class={`sysbox kinrow ${k.tier ? 'is-on' : ''}`}
            aria-label={`${k.family} Kin: ${k.n} deployed${k.tier ? `, tier ${KIN_TIER[k.tier - 1]}: ${kinText(k.family, k.tier)} for each ${k.family} Shadow` : `. ${kin.KIN_AT[0]} needed`}`}>
            <span class="kinrow__mark"><FamilyGlyph family={k.family} size={18} /><b class="num">{k.n}</b></span>
            <span class="kinrow__name">{k.family}</span>
            <Steps n={k.n} />
            <small class="kinrow__does">{kinText(k.family, Math.max(1, k.tier))}</small>
          </li>
        ))}
        {m.wild > 0 && (
          <li class="sysbox kinrow is-all" aria-label={`${kin.KIN_ALL}: kin to every family`}>
            <span class="kinrow__mark"><FamilyGlyph family={kin.KIN_ALL} size={18} /><b class="num">{m.wild}</b></span>
            <span class="kinrow__name">{kin.KIN_ALL}</span>
            <small class="kinrow__does">Kin to every family</small>
          </li>
        )}
      </ul>
      <span class="label kintrack__head">Formation</span>
      <ul class="kintrack__form">
        {m.roles.map((r) => (
          <li key={r} class="sysbox kinrole" aria-label={`${r}: ${bonusText(kin.FORMATION[r])} for you and every Shadow`}>
            <Glyph name={ROLE_GLYPH[r] ?? 'shadows'} />
            <span><b>{r}</b><small>{bonusText(kin.FORMATION[r])}</small></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What a Shadow brings to a squad, on its card: its family's Kin at each step, the one its squad reaches
 * lit; or, for the family kin to every other, that; and its role's aura.
 */
export function KinOfShadow({ sh, family, role, squad }: { sh: Shadow; family: string; role: string; squad: readonly Shadow[] }) {
  const on = squad.includes(sh);
  const m = on ? kin.makeOf(squad) : null;
  const tier = m ? (family === kin.KIN_ALL ? Math.max(0, ...m.kin.map((k) => k.tier)) : m.kin.find((k) => k.family === family)?.tier ?? 0) : 0;
  return (
    <section class="sysbox kincard">
      <div class="kincard__row">
        <span class="kincard__mark"><FamilyGlyph family={family} size={16} /></span>
        <span class="kincard__body">
          <b>{family} Kin</b>
          {family === kin.KIN_ALL
            ? <small class={tier ? 'is-on' : ''}>Kin to every family</small>
            : kin.KIN_AT.map((at, i) => (
              <small key={at} class={tier === i + 1 ? 'is-on' : ''}>{at} deployed: {kinText(family, i + 1)}</small>
            ))}
        </span>
      </div>
      <div class="kincard__row">
        <span class="kincard__mark"><Glyph name={ROLE_GLYPH[role] ?? 'shadows'} /></span>
        <span class="kincard__body">
          <b>{role}</b>
          <small class={on ? 'is-on' : ''}>Formation: {bonusText(kin.FORMATION[role] ?? {})} for you and every Shadow</small>
        </span>
      </div>
    </section>
  );
}
