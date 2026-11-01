/**
 * The voice rules in docs/VOICE.md that a test can hold: System windows come from the closed list
 * of headers and never refer to the System, Valcorde never mentions it, the decided words are the
 * only ones used, counts are digits, a stat's name comes before its value, and no player-facing line
 * carries a dash.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contractHint, contractText } from '@/core/contracts';
import * as gear from '@/core/gear';
import * as marks from '@/core/marks';
import { grantText, MISSIONS, TIER_NAMES } from '@/core/missions';
import { ATTRS, RANK_LADDER } from '@/core/progression';
import { POTIONS } from '@/core/shop';
import { CLASS_PASSIVES } from '@/data/abilities';
import { CLASSES } from '@/data/classes';
import { MARKS } from '@/data/ascension';
import { CONTRACT_KINDS } from '@/data/contracts';
import { ISSUED } from '@/data/equipment';
import { ASSESSMENT, BEATS, GATES_LINE, GATES_TOUR, HANDOVER, NAME_PROMPT } from '@/data/narrative';
import * as system from '@/ui/system';
import { TOPICS } from '@/screens/Guide';

const plain = (html: string) => html.replace(/<[^>]+>/g, '');
const systemBeats = BEATS.filter((b) => system.SYSTEM_KINDS.includes(b.kind));
/** One of each Daily Quest, to read its goal and hint. */
const quests = CONTRACT_KINDS.map(({ kind }) => ({ kind, need: 3, got: 0, family: 'Undead', at: 30, where: [] }) as unknown as Parameters<typeof contractText>[0]);
const coachLines = [
  ...ASSESSMENT, NAME_PROMPT, ...HANDOVER, ...Object.values(GATES_LINE), ...GATES_TOUR.map((t) => t.say),
  ...BEATS.filter((b) => b.kind === 'coach').flatMap((b) => b.lines),
];

/** Every card and System line the data holds. */
const systemText = [
  ...systemBeats.flatMap((b) => b.lines),
  ...CLASSES.map((c) => c.desc),
  ...CLASS_PASSIVES.map((p) => p.text),
  ...MISSIONS.flatMap((m) => [m.did, grantText(m)]),
  ...ATTRS.map((a) => a.desc),
  ...RANK_LADDER.map((r) => r.blurb),
  ...ISSUED.map((d) => d.desc ?? ''),
  ...POTIONS.map((p) => p.desc),
  ...quests.flatMap((q) => [contractText(q, 'D'), contractHint(q)]),
].map(plain);

describe('the System', () => {
  it('speaks only under the closed list of headers', () => {
    for (const b of systemBeats) expect(system.HEADERS, b.id).toContain(b.title);
    expect(system.HEADERS).toContain(system.notify(['x']).title);
    expect(system.HEADERS).toContain(system.questRewards(['x']).title);
  });

  it('never refers to itself', () => {
    for (const t of systemText) expect(t, t).not.toMatch(/\bthe System\b/i);
  });

  it('reports a level-up one line per level, then the points', () => {
    const w = system.levelUp(2, 12, 6);
    expect(w.lines!.filter((l) => l === '[You have levelled up!]')).toHaveLength(2);
    expect(plain(w.lines!.at(-1)!)).toBe('Ability Points +6');
    expect(system.levelUp(9, 40, 27).lines!.filter((l) => l === '[You have levelled up!]')).toHaveLength(3);
  });

  it('puts a defeated name on its own line', () => {
    expect(system.event('defeated', system.foe('The Hollow Monarch')).map(plain)).toEqual(['You have defeated', '[The Hollow Monarch].']);
  });
});

describe('Valcorde', () => {
  it('never mentions the System or anything only it shows', () => {
    for (const l of coachLines) expect(l, l).not.toMatch(/System|Player|Ability Point|Daily Quest|Secret Quest/);
  });

  it('contracts by default, and keeps the full form for weight', () => {
    const stiff = /\b(do not|does not|did not|is not|are not|was not|were not|will not|would not|cannot|could not|have not|has not|had not|I am|I have|I will|you are|you have|you will|it is|that is|there is|here is|we are|they are)\b(?![,.;:!?])/gi;
    const contracted = /\b\w+(’|')(t|re|ve|ll|d|m|s)\b/gi;
    const text = coachLines.join(' ');
    const full = text.match(stiff)?.length ?? 0;
    expect((text.match(contracted)?.length ?? 0)).toBeGreaterThanOrEqual(full * 5);
  });

  it('has no catchphrases: no four-word phrase in two of his lines', () => {
    const words = (l: string) => l.toLowerCase().match(/[a-z’'-]+/g) ?? [];
    const seen = new Map<string, number>();
    coachLines.forEach((l, i) => {
      const w = words(l);
      for (let j = 0; j + 4 <= w.length; j++) {
        const g = w.slice(j, j + 4).join(' ');
        if (!seen.has(g)) seen.set(g, i);
        else expect(seen.get(g), `"${g}" in two lines`).toBe(i);
      }
    });
  });

  it('opens no more than two lines the same way', () => {
    const openers = new Map<string, number>();
    for (const l of coachLines) {
      for (const sentence of l.split(/(?<=[.?!])\s+/)) {
        const first = sentence.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
        openers.set(first, (openers.get(first) ?? 0) + 1);
      }
    }
    expect([...openers].filter(([, n]) => n > 2)).toEqual([]);
  });

  it('is C-Rank, not an elite', () => {
    expect(coachLines.some((l) => l.includes('C-Rank'))).toBe(true);
  });
});

describe('the interface', () => {
  it('keeps the Guide to one or two short sentences a line, with no contractions', () => {
    const long = TOPICS.flatMap((t) => t.lines).filter((l) => l.split(/[.!?]\s+(?=[A-Z0-9])/).length > 2);
    const contracted = TOPICS.flatMap((t) => t.lines).filter((l) => /\b\w+(’|')(t|re|ve|ll|d|m)\b/.test(l));
    expect(long).toEqual([]);
    expect(contracted).toEqual([]);
  });
});

describe('the words', () => {
  it('uses the decided terms', () => {
    for (const t of [...systemText, ...coachLines.map(plain)]) {
      expect(t, t).not.toMatch(/\b[Cc]ontracts?\b|Secret Mission|\b[Aa]ttributes?\b|\bgates?\b/);
    }
  });

  it('names the Secret Quest tiers, not Missions', () => {
    expect(Object.values(TIER_NAMES)).toEqual(['Citation', 'Directive', 'Edict', 'Testament']);
  });

  it('writes every count in System text as a digit', () => {
    for (const t of systemText) expect(t, t).not.toMatch(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand)\b/i);
  });

  it('writes a stat name before its value', () => {
    const lines = [...systemText, gear.bonusText({ patk: 0.08, mpow: 0.08, crit: 6 }), marks.markText(MARKS[0], 2)];
    for (const t of lines) expect(t, t).not.toMatch(/[+-]\d[\d.]*%?\s+(STR|VIT|AGI|PER|INT|[a-z]+)\b/);
  });

  it('puts no dash or old word in a line a player reads', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk(join(__dirname, '..', 'src'));
    const found: string[] = [];
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        const code = line.replace(/\s\/\/\s.*$/, '');
        if (/[—–]/.test(code)) found.push(`${f}:${i + 1} dash`);
        if (/(?<!first_)\b[Aa]rtifacts?\b|Secret Missions?\b/.test(code)) found.push(`${f}:${i + 1} old word`);
        if (/toast\(\s*[`'"]\+|\+\$\{[^}]*\}\s*(Mana Shards|shards)/.test(code)) found.push(`${f}:${i + 1} gain written value first`);
        for (const m of code.matchAll(/<Empty(?:\s[^>]*)?>([^<{]+)<\/Empty>/g)) if (m[1].length > 40) found.push(`${f}:${i + 1} empty state says more than the fact`);
      });
    }
    expect(found).toEqual([]);
  });
});
