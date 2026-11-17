/**
 * The voice rules in docs/VOICE.md that a test can hold: System windows come from the closed list
 * of headers and never refer to the System, Valcorde never mentions it, the decided words are the
 * only ones used, counts are digits, a stat's name comes before its value, and no player-facing line
 * carries a dash.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { contractHint, contractText } from '@/core/contracts';
import * as gear from '@/core/gear';
import * as marks from '@/core/marks';
import { grantText, MISSIONS, TIER_NAMES } from '@/core/missions';
import { ATTRS, RANK_LADDER } from '@/core/progression';
import { POTIONS } from '@/core/shop';
import { IDENTITY_GAIN, passiveFor, passiveText, STATUS_TEXT, TACTICS } from '@/core/combat';
import { STATS, type Attrs } from '@/core/types';
import { PASSIVES } from '@/data/abilities';
import { CLASS_PASSIVES } from '@/data/abilities';
import { CLASS_RANKS, CLASSES, nextRung } from '@/data/classes';
import { byLead } from '@/core/ranks';
import { MARKS } from '@/data/ascension';
import { CONTRACT_KINDS } from '@/data/contracts';
import { DUNGEONS } from '@/data/dungeons';
import { OLD_BLESSINGS, EVENTS, TRAP } from '@/data/nodes';
import { BOON_LIST } from '@/data/blessings';
import { HOLLOW_THRONE, PRACTICE_GATE } from '@/data/special';
import { SPIRE_THEME } from '@/data/spire';
import { ISSUED } from '@/data/equipment';
import { ASSESSMENT, ASSOC_BRIEF, ASSOC_FIRST, ASSOC_PAID, BEATS, GATES_LINE, GATES_TOUR, HANDOVER, NAME_PROMPT } from '@/data/narrative';
import * as system from '@/ui/system';
import { lines, toBeats } from '@/ui/log';
import { GRADES, verdict } from '@/core/raid';
import type { Ev } from '@/core/combat';
import { TOPICS } from '@/screens/Guide';
import { familyTip, roleTip } from '@/ui/kin';
import { styleTip } from '@/ui/stand';
import { REAR_MELEE, ROLE_ROW } from '@/data/ranks';
import { FORMATION, KIN, KIN_ALL } from '@/data/kin';

const plain = (html: string) => html.replace(/<[^>]+>/g, '');

/** Every source file a player's text or a screen's markup can live in. */
const srcFiles: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f)) srcFiles.push(p);
  }
};
walk(join(__dirname, '..', 'src'));
const systemBeats = BEATS.filter((b) => system.SYSTEM_KINDS.includes(b.kind));
/** One of each Daily Quest, to read its goal and hint. */
const quests = CONTRACT_KINDS.map(({ kind }) => ({ kind, need: 3, got: 0, family: 'Undead', at: 30, where: [] }) as unknown as Parameters<typeof contractText>[0]);
const coachLines = [
  ...ASSESSMENT, NAME_PROMPT, ...HANDOVER, ...Object.values(GATES_LINE), ...GATES_TOUR.map((t) => t.say),
  ASSOC_FIRST, ...Object.values(ASSOC_BRIEF).flat(), ...ASSOC_PAID.paid, ...ASSOC_PAID.bare, ASSOC_PAID.satchel, ASSOC_PAID.survey,
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

  it('writes a class as a fighter, never as `A class given to`, and puts it in the row the fight stands it in', () => {
    for (const c of CLASSES) {
      const r = `${c.name}: ${c.desc}`;
      expect(c.desc, r).not.toMatch(/^A class given/);
      expect(c.desc, r).toMatch(/^[A-Z][^.]*\.( [A-Z][^.]*\.)?$/);
      // A line that names a row names the one its class stands in (`ranks.byLead`).
      const row = c.desc.match(/\b(Front|Rear)-row\b/);
      if (row) expect(row[1].toLowerCase(), r).toBe(byLead(c.lead).row);
      // Every rung below the top names the one it rises to, of its own line, a rank on.
      const next = nextRung(c);
      if (c.tier < CLASS_RANKS.length - 1) {
        expect(next?.lead, r).toBe(c.lead);
        expect(next?.rank, r).toBe(CLASS_RANKS[c.tier + 1]);
      } else expect(next, r).toBeNull();
    }
    // The first rung of each line says where it stands.
    for (const c of CLASSES.filter((x) => x.tier === 0)) expect(c.desc, c.name).toMatch(/\b(Front|Rear)-row\b/);
  });

  it('tells a creature\'s identity passive by the stat it raises, never as a leading derived stat', () => {
    const identity = PASSIVES.filter((p) => p.style === 'identity');
    expect(identity.length).toBeGreaterThan(0);
    for (const p of identity) {
      for (const lead of STATS) {
        const base = Object.fromEntries(STATS.map((k) => [k, k === lead ? 50 : 10])) as unknown as Attrs;
        const t = passiveFor(p.name, base);
        expect(t, `${p.name} ${lead}`).toMatch(new RegExp(`^[A-Z][A-Za-z ]+ \\+${Math.round(IDENTITY_GAIN * 100)}%, from ${lead}, its highest stat\\.$`));
      }
    }
    // Any other passive reads as written.
    const other = PASSIVES.find((p) => p.style !== 'identity')!;
    expect(passiveFor(other.name, { STR: 1, AGI: 1, PER: 1, VIT: 1, INT: 1 } as Attrs)).toBe(passiveText(other.name));
  });

  it('says defeat, never fell, and special drop, never condition drop: in every string, template and line of markup a player can read', () => {
    // A word in a player's text has a space or a capital beside it, or stands in markup; a lone lowercase
    // literal is a key ('fell', the Daily Quest's kind), which stays as the save wrote it.
    const found: string[] = [];
    for (const f of srcFiles) {
      const src = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (n: ts.Node) => {
        const text = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n) ? n.text : null;
        if (text && /\b(fell|fells|felled|felling)\b|\bcondition drops?\b/i.test(text) && (ts.isJsxText(n) || /\s|[A-Z]/.test(text.trim()))) {
          found.push(`${f}:${src.getLineAndCharacterOfPosition(n.getStart()).line + 1} ${text.trim()}`);
        }
        ts.forEachChild(n, visit);
      };
      visit(src);
    }
    expect(found).toEqual([]);
  });

  it('names the Secret Quest tiers, not Missions', () => {
    expect(Object.values(TIER_NAMES)).toEqual(['Citation', 'Directive', 'Edict', 'Testament']);
  });

  it('writes every count in System text as a digit', () => {
    for (const t of systemText) expect(t, t).not.toMatch(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand)\b/i);
  });

  it('writes a stat name before its value', () => {
    const lines = [...systemText, gear.bonusText({ patk: 0.08, mpow: 0.08, crit: 6 }), marks.markText(MARKS[0], 2), ...OLD_BLESSINGS.map((b) => b.text), ...BOON_LIST.flatMap((b) => b.v.map((v) => b.text(v))), ...Object.values(STATUS_TEXT), ...POTIONS.map((p) => p.effect)];
    for (const t of lines) expect(t, t).not.toMatch(/[+-]\d+(?:\.\d+)?%?\s+(STR|VIT|AGI|PER|INT|HP|MP|XP|Mana Shards|shards|attack|magic|defence|resistance|accuracy|evasion|initiative|critical|maximum|fatigue|health|price|grades?)\b/i);
  });

  it('puts no dash, old word or "to" range in a line a player reads', () => {
    const found: string[] = [];
    for (const f of srcFiles) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        const code = line.replace(/\s\/\/\s.*$/, '');
        if (/[—–]/.test(code)) found.push(`${f}:${i + 1} dash`);
        // Facts sit side by side, spaced, or in a list joined by commas, never joined by a middle dot (VOICE.md, "No middle dots").
        if (/\u00b7/.test(code)) found.push(`${f}:${i + 1} middle dot`);
        if (/(?<!first_)\b[Aa]rtifacts?\b|Secret Missions?\b/.test(code)) found.push(`${f}:${i + 1} old word`);
        // XP is XP everywhere a player reads it: never EXP, never Experience.
        if (/\bEXP\b|\b[Ee]xperience\b/.test(code)) found.push(`${f}:${i + 1} XP written another way`);
        if (/[\d}%] (a|an|per) (round|hour|turn|day)\b/.test(code)) found.push(`${f}:${i + 1} rate not written "each"`);
        if (/toast\(\s*[`'"]\+|\+\$\{[^}]*\}\s*(Mana Shards|shards)/.test(code)) found.push(`${f}:${i + 1} gain written value first`);
        for (const m of code.matchAll(/<Empty(?:\s[^>]*)?>([^<{]+)<\/Empty>/g)) if (m[1].length > 40) found.push(`${f}:${i + 1} empty state says more than the fact`);
        // A range is written with a hyphen, `30-50`, `Floors 26-30`, never `30 to 50`; only a screen reader hears "to".
        if (!/aria-label/.test(code) && /[\d%}]\s+to\s+[+-]?(\d|\$\{|\{)/.test(code)) found.push(`${f}:${i + 1} range written with "to"`);
      });
    }
    expect(found).toEqual([]);
  });
});

describe('the world', () => {
  const files = [...DUNGEONS, HOLLOW_THRONE, PRACTICE_GATE].map((d) => d.theme).concat(SPIRE_THEME);
  const choices = [...EVENTS, TRAP].flatMap((e) => e.choices);
  const outcomes = choices.flatMap((c) => [c.win, ...(c.lose ? [c.lose] : [])]);

  it('files a Gate as the Association would: short, factual, and never to you', () => {
    const bad = files.filter((f) => /\byou(r)?\b/i.test(f) || f.length > 140 || f.split(/(?<=[.!?])\s+/).length > 4);
    expect(bad).toEqual([]);
  });

  it('narrates an outcome in one or two plain sentences', () => {
    const long = outcomes.map((o) => o.text).filter((t) => t.split(/(?<=[.!?])\s+/).length > 2);
    expect(long).toEqual([]);
  });

  it('puts the cost of every outcome that hurts, heals or weakens under it', () => {
    for (const o of outcomes) if (o.hurt || o.heal || o.status || o.mana || o.fatigue) expect(system.outcome(o).length, o.text).toBeGreaterThan(0);
    expect(system.outcome({ text: '', hurt: 0.25 }).map((l) => l.replace(/<[^>]+>/g, ''))).toEqual(['HP -25%']);
  });
});

describe('the System keeping score', () => {
  const name = (uid: string) => ({ hero: 'You', e0: 'Ghoul' } as Record<string, string>)[uid] ?? uid;
  const log = [
    { t: 'hit', a: 'e0', v: 'hero', ab: 'Grave Strike', dmg: 12, crit: false },
    { t: 'miss', a: 'e0', v: 'hero', ab: 'Grave Strike' },
    { t: 'status', v: 'hero', s: 'Bleeding', n: 3 },
    { t: 'tick', v: 'e0', dmg: 6, s: 'Bleeding' },
    { t: 'down', v: 'e0' },
  ] as unknown as Ev[];
  const text = toBeats(log).flatMap((b) => lines(b, name)).map((l) => l.text);

  it('writes the fight log as actor, act and signed numbers, with no flourish', () => {
    expect(text).toContain('◆ Ghoul: Grave Strike → You -12');
    expect(text).toContain('● Ghoul HP -6 (Bleeding)');
    for (const t of text) expect(t, t).not.toMatch(/swings|finds nothing|rallied|lashes|shrugs|loses \d/);
  });

  it('writes a status that ticks as a rate each round', () => {
    const ticking = Object.values(STATUS_TEXT).filter((t) => /round/.test(t));
    expect(ticking.length).toBeGreaterThan(0);
    for (const t of ticking) expect(t, t).toMatch(/% each round/);
  });

  it('grades the brief from Safe to Lethal and reports nothing else', () => {
    expect(GRADES.map((g) => g.text)).toEqual(['Safe', 'Likely', 'Even', 'Unlikely', 'Lethal']);
    expect(verdict(1).text).toBe('Safe');
    expect(verdict(0).text).toBe('Lethal');
  });
});

describe('the look', () => {
  it('heads every System frame with a header from the closed list, or a card name', () => {
    const titles: string[] = [];
    for (const f of srcFiles) {
      const code = readFileSync(f, 'utf8');
      for (const m of code.matchAll(/<SysFrame[^>]*\btitle="([^"]+)"/g)) titles.push(m[1]);
      for (const m of code.matchAll(/title: (['`])(.*?)\1,\s*system:/g)) titles.push(m[2]);
    }
    expect(titles.length).toBeGreaterThanOrEqual(8);
    const allowed = new RegExp(`^(${system.HEADERS.join('|')})$|^[A-Z][a-z]+: \\S`);
    for (const t of titles) expect(t, t).toMatch(allowed);
  });

  it('draws the System frame only through its components', () => {
    const found: string[] = [];
    for (const f of srcFiles) {
      if (/ui[\\/]frame\.tsx$|ui[\\/]overlays\.tsx$/.test(f)) continue;
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/class(Name)?=["{`][^"]*\bsys(frame|rail|head)\b/.test(line)) found.push(`${f}:${i + 1} draws the frame by hand`);
      });
    }
    expect(found).toEqual([]);
  });
});

describe('the tooltip', () => {
  it('is the one tooltip, opened only through ui/tip.tsx', () => {
    const found: string[] = [];
    for (const f of srcFiles) {
      if (/ui[\\/]tip\.tsx$/.test(f)) continue;
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/role="tooltip"/.test(line)) found.push(`${f}:${i + 1} opens a tooltip of its own`);
      });
    }
    expect(found).toEqual([]);
  });

  // A tooltip says what a fight's tip says, as the fight's tip says it: a name over a sentence or two, the trigger
  // then what happens, active, with no label inside the sentence (`Kin: while...`), and breakpoints name first.
  const shadowTips = [
    ...[...Object.keys(KIN), KIN_ALL].map((f) => familyTip(f, 1)),
    ...Object.keys(FORMATION).map((r) => roleTip(r, 1)),
    ...Object.keys(ROLE_ROW).map((r) => styleTip(r)),
  ];
  it('tells a Shadow\'s family and role in whole sentences, with no label inside them', () => {
    expect(shadowTips.length).toBeGreaterThan(10);
    for (const t of shadowTips) {
      expect(t.lines.length, t.title).toBeGreaterThan(0);
      expect(t.kind, t.title).toBeTruthy();
      for (const l of t.lines) {
        expect(l, l).toMatch(/^[A-Z].*\.$/);
        expect(l, l).not.toMatch(/^[A-Za-z ]+: /);
        expect(l.split(/(?<=\.) /).length, l).toBeLessThanOrEqual(2);
      }
    }
  });

  it('tells a role by its bonus to the whole party and its breakpoints, never by where it stands', () => {
    for (const r of Object.keys(FORMATION)) {
      const t = roleTip(r, 2);
      expect(t.kind, r).toBe('Role bonus');
      expect(t.lines, r).toHaveLength(1);
      expect(t.lines[0], r).toMatch(/^Deployed, .+ Shadows give the whole party .+, the Association’s hunters included\.$/);
      expect(t.lines[0], r).not.toMatch(/\b(Front|Rear|Stands|rank|Formation)\b/);
      expect(t.tiers?.map((x) => x.at), r).toEqual([1, 2, 3]);
      expect(t.tiers?.filter((x) => x.on).map((x) => x.at), r).toEqual([2]);
    }
  });

  it('tells a Shadow as Melee or Ranged by where it takes its place, its rear share read from the rules', () => {
    for (const [r, row] of Object.entries(ROLE_ROW)) {
      const t = styleTip(r);
      expect(t.title, r).toBe(row === 'front' ? 'Melee' : 'Ranged');
      expect(t.lines[0], r).toMatch(row === 'front' ? /^Fights best from the Front row\./ : /^Fights best from the Rear row\./);
      expect(t.lines[0], r).not.toMatch(/\brank\b/);
      if (row === 'front') expect(t.lines[0], r).toContain(`${Math.round(REAR_MELEE * 100)}%`);
    }
  });

  it('lists each breakpoint as a stat name then its value', () => {
    const tiers = shadowTips.flatMap((t) => t.tiers ?? []);
    expect(tiers.length).toBeGreaterThan(10);
    for (const x of tiers) for (const part of x.text.split(', ')) expect(part, x.text).toMatch(/^[A-Z][A-Za-z ]* \+\d+(\.\d)?%?$/);
  });
});

describe('the full sweep', () => {
  it('describes every status from the engine, and every standing order as the engine plays it', () => {
    for (const [k, v] of Object.entries(STATUS_TEXT)) expect(v, k).not.toBe('');
    expect(TACTICS.find((t) => t.key === 'protect')?.desc).toMatch(/about to hit you/);
  });

  it('never lets the System name itself, even in a level name', () => {
    for (const line of [...Object.values(STATUS_TEXT), ...TACTICS.map((t) => t.desc)]) expect(line).not.toMatch(/\bSystem\b/);
  });
});
