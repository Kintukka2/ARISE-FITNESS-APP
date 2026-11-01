/**
 * The fight log: the System keeping score. A chamber's events are grouped into beats, and each beat
 * becomes one or more short, exact lines (docs/VOICE.md, "The fight log"). No DOM here, so the
 * tests can read it.
 */
import type { Ev } from '@/core/combat';

export type Beat = { kind: 'round' | 'act' | 'drain' | 'aura'; ev: Ev[] };

export function toBeats(log: Ev[]): Beat[] {
  const out: Beat[] = [];
  let cur: Beat | null = null;
  const push = (b: Beat) => { out.push(b); cur = b; };
  for (const e of log) {
    if (e.t === 'round') push({ kind: 'round', ev: [e] });
    else if (e.t === 'hit' || e.t === 'miss') {
      const c = cur as Beat | null;
      const head = c?.ev[0];
      if (c && c.kind === 'act' && head && (head.t === 'hit' || head.t === 'miss') && head.a === e.a && head.ab === e.ab) c.ev.push(e);
      else push({ kind: 'act', ev: [e] });
    } else if (e.t === 'support' || e.t === 'stun' || e.t === 'guard' || e.t === 'heal') push({ kind: 'act', ev: [e] });
    else if (e.t === 'tick' || e.t === 'expire') {
      if (cur && (cur as Beat).kind === 'drain') (cur as Beat).ev.push(e);
      else push({ kind: 'drain', ev: [e] });
    } else if (e.t === 'passive' && e.k === 'aura') push({ kind: 'aura', ev: [e] });
    else if (cur) (cur as Beat).ev.push(e);
    else push({ kind: 'act', ev: [e] });
  }
  return out;
}

/** A beat as log lines, each with the tone that colours it. */
export function lines(b: Beat, name: (uid: string) => string): { text: string; tone: string }[] {
  const out: { text: string; tone: string }[] = [];
  const side = (uid: string) => (uid.startsWith('e') ? 'foe' : 'ally');
  const hits = b.ev.filter((e): e is Extract<Ev, { t: 'hit' }> => e.t === 'hit');
  const first = b.ev[0];
  if (first.t === 'round') return [{ text: `Round ${first.n}`, tone: 'round' }];
  if (hits.length) {
    const h = hits[0];
    const crit = hits.some((x) => x.crit);
    const targets = hits.map((x) => `${name(x.v)} -${x.dmg}${x.crit ? ' (Critical)' : ''}`).join(', ');
    out.push({ text: `${crit ? '✦' : '◆'} ${name(h.a)}: ${h.ab} → ${targets}`, tone: side(h.a) });
  }
  for (const e of b.ev) {
    if (e.t === 'miss') out.push({ text: `○ ${name(e.a)}: ${e.ab} → ${name(e.v)}. Missed.`, tone: 'muted' });
    else if (e.t === 'support') out.push({ text: `✦ ${name(e.a)}: ${e.ab}. Allies rallied.`, tone: side(e.a) });
    else if (e.t === 'stun') out.push({ text: `✴ ${name(e.a)}: [Stunned]. Turn lost.`, tone: 'muted' });
    else if (e.t === 'guard') out.push({ text: `◈ ${name(e.a)}: Guard.`, tone: side(e.a) });
    else if (e.t === 'heal') out.push({ text: `✚ ${name(e.a)}: Field Potion. HP +${e.amt}`, tone: side(e.a) });
    else if (e.t === 'status') out.push({ text: `✴ ${name(e.v)}: [Effect: ${e.s}] has activated.`, tone: 'status' });
    else if (e.t === 'down') out.push({ text: `✖ ${name(e.v)} has fallen.`, tone: e.v.startsWith('e') ? 'kill' : 'loss' });
    else if (e.t === 'tick') out.push({ text: `● ${name(e.v)} HP -${e.dmg} (${e.s})`, tone: 'status' });
    else if (e.t === 'passive') {
      const t = e.k === 'ward' ? `◉ ${name(e.u)}: [${e.p}] Damage halved.` : e.k === 'stand' ? `◉ ${name(e.u)}: [${e.p}] Survived at 1 HP.` : e.k === 'brace' ? `◉ ${name(e.u)}: Stagger ignored.` : e.k === 'aura' ? `◉ ${name(e.u)}: [${e.p}] has activated.` : `◉ [${e.p}] has activated.`;
      out.push({ text: t, tone: 'passive' });
    }
  }
  return out;
}
