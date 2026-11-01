/**
 * The System's windows, built from the templates in docs/VOICE.md.
 *
 * A screen that shows the System speaking calls these instead of writing the window itself, so
 * the voice cannot drift: the header comes from a closed list, names wear their type in brackets,
 * and every number comes in from the engine. The System reports. It never explains, advises or
 * refers to itself; what it would explain belongs in the Guide.
 */
import type { Effect } from '@/data/nodes';
import type { Action, Kind, WinOpts } from './overlays';

/** The only headers a System window may carry. Cards carry their own name instead. */
export const HEADERS = ['Notification', 'Quest Info', 'Quest Rewards', 'Status', 'Skills', 'Inventory'] as const;
export type Header = (typeof HEADERS)[number];

/** The window kinds the System speaks in. The others belong to Valcorde, the app and the `???` voice. */
export const SYSTEM_KINDS: Kind[] = ['system', 'gold', 'gates', 'shadow', 'gear'];

// ------------------------------------------------------------------ marks

/** A name wearing its type: `[Item: Training Sword]`. */
export const tag = (name: string, type?: string) => `<strong>[${type ? `${type}: ` : ''}${name}]</strong>`;
/** An enemy or a boss, in red: `[Rotting Ghoul]`. */
export const foe = (name: string) => `<span class="warn">[${name}]</span>`;
/** A gain or an effect's value, in green. */
export const gain = (text: string | number) => `<span class="grant">${text}</span>`;
/** A warning's key word, or a whole failed line, in red. */
export const red = (text: string) => `<span class="warn">${text}</span>`;
/** A signed amount: `+3`, `-20%`. */
export const signed = (n: number, unit = '') => `${n < 0 ? '-' : '+'}${Math.abs(n)}${unit}`;

// ------------------------------------------------------------------ lines

/** `[Daily Quests have arrived.]` */
export const arrival = (what: string, plural = false) => `[${what} ${plural ? 'have' : 'has'} arrived.]`;
/** `You have defeated` / `[The Hollow Monarch].`: the name takes its own line. */
export const event = (verb: string, name: string) => [`You have ${verb}`, `${name}.`];
/** `{Label}: {n}/{m}`, or `{Label}: {n}` with no ceiling. */
export const counter = (label: string, n: number, of?: number) => `${label}: ${of === undefined ? n : `${n}/${of}`}`;
/** `{from} → {to}` */
export const change = (from: string | number, to: string | number) => `${from} → ${to}`;
/** `ACCESS GRANTED: SHADOWS`, in green. */
export const unlock = (what: string) => gain(`ACCESS GRANTED: ${what.toUpperCase()}`);
/** `Not enough MP. (40/60)`, in red. */
export const short = (what: string, have: number, need: number) => red(`Not enough ${what}. (${have}/${need})`);

// ------------------------------------------------------------------ windows

const CLOSE: Action[] = [{ label: 'Close', value: null }];

/** A NOTIFICATION: an announcement, an event, a warning. It reports, so it closes. */
export function notify(lines: string[], kind: Kind = 'system', actions: Action[] = CLOSE): WinOpts {
  return { title: 'Notification', kind, center: true, lines, actions };
}

/** Something that could not be done: the reason, then the result, all in red. */
export function refuse(lines: string[], kind: Kind = 'system'): WinOpts {
  return { ...notify(lines.map(red), kind), typed: false };
}

/** A yes-or-no question. Resolves true for Yes. */
export function offer(lines: string[], kind: Kind = 'system', yes = 'Yes', no = 'No'): WinOpts {
  return { ...notify(lines, kind, [{ label: no, value: false }, { label: yes, value: true, primary: true }]), typed: false };
}

/** Levels gained, then the Ability Points they paid. Resolves 'profile' for Allocate. */
export function levelUp(levels: number, to: number, points: number): WinOpts {
  const lines = Array.from({ length: Math.min(levels, 3) }, () => '[You have levelled up!]');
  if (levels > 3) lines.push(counter('Level', to));
  lines.push(`Ability Points ${gain(signed(points))}`);
  return notify(lines, 'gold', [{ label: 'Close', value: null }, { label: 'Allocate', value: 'profile', primary: true }]);
}

/** What a finished quest paid. The engine has already paid it, so the window only reports. */
export function questRewards(rewards: string[], kind: Kind = 'system'): WinOpts {
  return {
    title: 'Quest Rewards', kind, center: true,
    lines: ['You got rewards.', ...rewards.map((r, i) => `${i + 1}. ${r}`)],
    actions: CLOSE,
  };
}

/**
 * What an event inside a Gate did, as System lines under its narration: the cost in red, the gain
 * in green. The narration says what happened; this says what it was worth.
 */
export function outcome(e: Effect, got: { shards?: number; item?: string; blessing?: { name: string; text: string } } = {}): string[] {
  const out: string[] = [];
  if (e.hurt) out.push(red(`HP ${signed(-Math.round(e.hurt * 100), '%')}`));
  if (e.heal) out.push(gain(`Party HP ${signed(Math.round(e.heal * 100), '%')}`));
  if (got.shards) out.push(`Mana Shards ${gain(signed(got.shards))} banked`);
  if (got.item) out.push(`${tag(got.item, 'Item')} banked`);
  if (got.blessing) out.push(`${tag(got.blessing.name, 'Blessing')} ${gain(got.blessing.text)}`);
  if (e.status) out.push(red(`[Debuff: ${e.status}]`));
  return out;
}
