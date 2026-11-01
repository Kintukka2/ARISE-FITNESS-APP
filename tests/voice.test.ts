/**
 * The voice rules in docs/VOICE.md that a test can hold: System windows come from the closed list
 * of headers and never refer to the System, Valcorde never mentions it, the decided words are the
 * only ones used, and no player-facing line carries a dash.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { grantText, MISSIONS } from '@/core/missions';
import { ATTRS, RANK_LADDER } from '@/core/progression';
import { POTIONS } from '@/core/shop';
import { CLASS_PASSIVES } from '@/data/abilities';
import { CLASSES } from '@/data/classes';
import { ISSUED } from '@/data/equipment';
import { ASSESSMENT, BEATS, HANDOVER } from '@/data/narrative';
import * as system from '@/ui/system';

const plain = (html: string) => html.replace(/<[^>]+>/g, '');
const systemBeats = BEATS.filter((b) => system.SYSTEM_KINDS.includes(b.kind));
const coachLines = [...ASSESSMENT, ...HANDOVER, ...BEATS.filter((b) => b.kind === 'coach').flatMap((b) => b.lines)];

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
});

describe('the words', () => {
  it('uses the decided terms', () => {
    for (const t of [...systemText, ...coachLines.map(plain)]) {
      expect(t, t).not.toMatch(/\b[Cc]ontracts?\b|Secret Mission|[Aa]ttribute point|\bgates?\b/);
    }
  });

  it('puts no dash in a line a player reads', () => {
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
        if (/[—–]/.test(line.replace(/\s\/\/\s.*$/, ''))) found.push(`${f}:${i + 1}`);
      });
    }
    expect(found).toEqual([]);
  });
});
