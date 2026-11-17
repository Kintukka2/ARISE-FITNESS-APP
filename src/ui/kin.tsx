/**
 * Kin and role bonuses as the Army shows them, after the trait trackers of the reference games: Teamfight
 * Tactics lists each trait as a hexagon with the count fielded, its name and its breakpoints (`2 › 3`,
 * the one reached lit; `1 / 2` while short), grey until the first, and tells what each breakpoint gives
 * in a tooltip (`(2) Attack +10%`). A family is a Kin, as Teamfight Tactics' origins are; a role gives a role
 * bonus, as its classes do, at one, two and three of it (`1 › 2 › 3`). Solo Leveling: Arise writes a Shadow's
 * aura under its stats as a name over one line (`Shadow's Authority` / `Increases entire team's Defense`).
 * Every number is read from `data/kin.ts` through `core/kin.ts`.
 */
import { useState } from 'preact/hooks';
import { sfx } from '@/audio/audio';
import { bonusText, tipNames, tipStats } from '@/core/gear';
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

/** A role bonus's tier as a numeral. */
export const ROLE_TIER = ['I', 'II', 'III'] as const;

/** A family's boon at each tier in words: `Attack +10%`, `Attack +20%`. */
export const kinText = (family: string, tier: number) => bonusText(kin.kinBoon(family, tier));

/** A role's bonus at a tier in words: `Defence +5%`, `Defence +10%`. */
export const roleText = (role: string, tier = 1) => bonusText(kin.roleBoon(role, tier));

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
 * What a Shadow's role gives the party, in the game's one tooltip, as Teamfight Tactics tells a class: the role by
 * its mark and name, `Role bonus` at the head's right, one sentence of what it gives and to whom (the whole party,
 * the Association's hunters with it), then each breakpoint, the one the squad reaches lit (`tier`, 0 while none is
 * deployed). Where the Shadow stands decides nothing of it, so the tooltip does not say it.
 */
export function roleTip(role: string, tier: number): TipText {
  const aura = kin.FORMATION[role];
  return {
    title: role,
    kind: 'Role bonus',
    mark: <span class="tip__mark"><Glyph name={ROLE_GLYPH[role] ?? 'shadows'} /></span>,
    tone: 'shadow',
    lines: aura ? [`Deployed, ${role} Shadows give the whole party ${tipNames(aura)}, the Association’s hunters included.`] : [],
    tiers: aura ? kin.ROLE_AT.map((at, i) => ({ at, text: tipStats(kin.roleBoon(role, i + 1)), on: tier === i + 1 })) : [],
  };
}

/** The squad's Kin and role bonuses, for the brief, each its own fact: `Kin: Orc II` and `Role bonus: Brute II, Caster I`. */
export function makeLine(squad: readonly Shadow[]): string[] {
  const m = kin.makeOf(squad);
  const lit = m.kin.filter((k) => k.tier > 0).map((k) => `${k.family} ${KIN_TIER[k.tier - 1]}`);
  const roles = m.roleLines.map((l) => `${l.role} ${ROLE_TIER[l.tier - 1]}`);
  return [lit.length ? `Kin: ${lit.join(', ')}` : null, roles.length ? `Role bonus: ${roles.join(', ')}` : null].filter((x): x is string => !!x);
}

/** A trait's mark, in a hexagon: lit while it is active, grey while it is short. */
export function KinHex({ family, role, on }: { family?: string; role?: string; on: boolean }) {
  return (
    <span class={`kinhex ${on ? 'is-on' : ''}`} aria-hidden="true">
      {family ? <FamilyGlyph family={family} size={16} /> : <Glyph name={ROLE_GLYPH[role ?? ''] ?? 'shadows'} />}
    </span>
  );
}

/**
 * Breakpoints as Teamfight Tactics writes them: `2 › 3` once the first is reached, the one reached lit; `1 / 2`
 * while short. A Kin's are `KIN_AT`, a role bonus's `ROLE_AT` (`1 › 2 › 3`).
 */
export function Steps({ n, at: steps = kin.KIN_AT }: { n: number; at?: readonly number[] }) {
  if (n < steps[0]) return <span class="kinsteps num">{n} / {steps[0]}</span>;
  return (
    <span class="kinsteps num">
      {steps.map((at, i) => <span key={at}>{i > 0 && <i>›</i>}<b class={n >= at && (steps[i + 1] === undefined || n < steps[i + 1]) ? 'is-on' : ''}>{at}</b></span>)}
    </span>
  );
}

/** Each breakpoint and what it gives, as a trait's tooltip lists them: `(2) Attack +10%`, the one reached lit. */
function Tiers({ steps, text, tier }: { steps: readonly number[]; text: (tier: number) => string; tier: number }) {
  return (
    <ul class="kintiers">
      {steps.map((at, i) => (
        <li key={at} class={tier === i + 1 ? 'is-on' : ''}><b class="num">({at})</b> {text(i + 1)}</li>
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
  const traits: Trait[] = [
    ...m.kin.map((k): Trait => ({ key: `kin:${k.family}`, kind: 'kin', name: k.family, n: k.n, tier: k.tier })),
    ...(m.wild ? [{ key: 'all', kind: 'all', name: kin.KIN_ALL, n: m.wild, tier: 1 } as Trait] : []),
    ...m.roleLines.map((l): Trait => ({ key: `role:${l.role}`, kind: 'role', name: l.role, n: l.n, tier: l.tier })),
  ].sort((a, b) => Number(b.tier > 0) - Number(a.tier > 0));
  const shown = traits.find((t) => t.key === open) ?? null;
  const tap = (key: string) => { sfx.tap(); setOpen(open === key ? null : key); };
  return (
    <div class="kintrack">
      <span class="label kintrack__head">Kin & Role</span>
      <ul class="kintrack__list">
        {traits.map((t) => (
          <li key={t.key}>
            <button type="button" class={`kinchip kinchip--${t.kind} ${t.tier ? 'is-on' : ''} ${open === t.key ? 'is-open' : ''}`}
              aria-expanded={open === t.key} onClick={() => tap(t.key)}
              aria-label={t.kind === 'role' ? `${t.name} role bonus: ${t.n} deployed, tier ${ROLE_TIER[t.tier - 1]}, ${roleText(t.name, t.tier)}` : t.kind === 'all' ? `${t.name}: kin to every family` : `${t.name} Kin: ${t.n} deployed${t.tier ? `, tier ${KIN_TIER[t.tier - 1]}` : `, ${kin.KIN_AT[0]} needed`}`}>
              <KinHex family={t.kind === 'role' ? undefined : t.name} role={t.kind === 'role' ? t.name : undefined} on={t.tier > 0} />
              <b class="kinchip__n num">{t.n}</b>
              <span class="kinchip__body">
                <span class="kinchip__name">{t.name}</span>
                {t.kind === 'kin' ? <Steps n={t.n} /> : t.kind === 'role' ? <Steps n={t.n} at={kin.ROLE_AT} /> : <small class="kinchip__sub">Kin to every family</small>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* What a chip gives opens under the chips in the game's one tooltip, as the trait tracker's tooltip does. */}
      {shown && (
        <div class="tip tip--shadow tip--inline" role="note">
          <TipBody {...(shown.kind === 'role' ? roleTip(shown.name, shown.tier) : familyTip(shown.name, shown.tier))} />
        </div>
      )}
    </div>
  );
}

/**
 * What a Shadow brings to a squad, on its card, as Solo Leveling: Arise sets a Shadow's aura under its
 * stats: a name over its breakpoints, hairlines between. Its role's bonus under `Leader Role bonus`, for the
 * whole party; its family's Kin under `Orc Kin`; each breakpoint and what it gives, the one its squad reaches lit
 * while it is deployed.
 */
export function KinOfShadow({ sh, family, role, squad }: { sh: Shadow; family: string; role: string; squad: readonly Shadow[] }) {
  const on = squad.includes(sh);
  const m = on ? kin.makeOf(squad) : null;
  const tier = m ? (family === kin.KIN_ALL ? Math.max(0, ...m.kin.map((k) => k.tier)) : m.kin.find((k) => k.family === family)?.tier ?? 0) : 0;
  const roleTier = m?.roleLines.find((l) => l.role === role)?.tier ?? 0;
  return (
    <Section title="Kin & Role">
    <div class="sp-auth">
      <div class="sp-auth__row">
        <span class="sp-auth__name"><Glyph name={ROLE_GLYPH[role] ?? 'shadows'} />{role} Role bonus</span>
        <Tiers steps={kin.ROLE_AT} text={(t) => `${roleText(role, t)} for the whole party`} tier={roleTier} />
      </div>
      <div class="sp-auth__row">
        <span class="sp-auth__name"><FamilyGlyph family={family} size={13} />{family} Kin</span>
        {family === kin.KIN_ALL
          ? <p class={tier ? 'is-on' : ''}>Kin to every family</p>
          : <Tiers steps={kin.KIN_AT} text={(t) => kinText(family, t)} tier={tier} />}
      </div>
    </div>
    </Section>
  );
}
