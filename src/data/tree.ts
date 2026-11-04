/**
 * The skill tree: five Paths, one for each stat, that the hunter spends Skill Points into. Every Path
 * has five tiers, D to S. A tier opens when the hunter holds its rank and has spent enough of their
 * points in that Path. A node is a skill (it levels up, Lv.1 to Lv.MAX), a passive, or a stat that
 * takes several points. Two passives in each of a Path's B and S tiers are a fork: learning one seals
 * the other. Everything here is data; `core/skilltree.ts` reads it, and the screens quote its numbers.
 *
 * A Path's skills and its fork passives are the class lines' own (`data/abilities.ts`): the left
 * lane holds what a line's rungs gave first, the right lane the other half of each choice. The
 * Association's hunters still fight with a line's first options (`progression.kitFor`).
 */
import type { Ability, Passive, Stat } from '@/core/types';

/**
 * Each Path's utility: a skill that does no damage. It curses every foe, turns them on the hunter,
 * or holds the party up. Only the tree teaches them; the Association's hunters never fight with them.
 */
export const TREE_SKILLS: Ability[] = [
  { name: 'Dread Roar', type: 'physical', profile: 'all', mult: 0, cd: 3, inflicts: ['Weakened'] },
  { name: 'Challenge', type: 'physical', profile: 'taunt', mult: 0, cd: 3, inflicts: [] },
  { name: 'Smoke Veil', type: 'physical', profile: 'support', mult: 0, cd: 4, inflicts: [], grant: 'Veiled' },
  { name: 'Renewal', type: 'magic', profile: 'support', mult: 0, cd: 3, inflicts: [], heal: 0.15 },
  { name: "Hunter's Mark", type: 'physical', profile: 'all', mult: 0, cd: 3, inflicts: ['Marked'] },
];
/** A skill that does no damage: a curse, a taunt or a support. */
export const isUtility = (a: Pick<Ability, 'mult' | 'profile'>) => a.mult === 0 || a.profile === 'support' || a.profile === 'taunt';

/** Skill Points: this many each level past the first, and this many more for each rank claimed. */
export const SKILL_POINTS = { level: 1, rank: 2 } as const;

/** The points a Path's tier asks to have been spent in that Path before it opens, D to S. */
export const TIER_GATE = [0, 3, 8, 14, 20] as const;
export const TIER_RANKS = ['D', 'C', 'B', 'A', 'S'] as const;

/** How many skills the hunter takes into a fight, by the rank they hold. */
export const SKILL_SLOTS = { E: 2, D: 2, C: 3, B: 3, A: 4, S: 4, N: 5 } as const;

/** A reset of the tree: the first is free, then each costs this share of a clear's Mana Shards at the hunter's grade. */
export const RESET = { free: 1, share: 1 } as const;

/** What the tree's own passives do, as numbers the combat engine and the cards both read. */
export const EDGE = {
  /** Bloodthirst: a share of the damage dealt comes back as HP. */
  vamp: 0.1,
  /** Rampage: attack for every foe put down, up to `max` of them, until the fight ends. */
  momentum: { step: 0.1, max: 3 },
  /** Cull: more damage against a foe under a share of its HP. */
  execute: { below: 0.3, mult: 1.3 },
  /** Deadeye: a critical hit's multiplier against a Marked foe. */
  deadeye: 2,
  /** Spiked Guard: a share of every hit taken goes back to whoever landed it. */
  thorns: 0.2,
  /** Unbroken: damage taken while HP is above a share of the maximum. */
  stalwart: { above: 0.5, mult: 0.85 },
  /** Lingering Curse: turns added to every debuff inflicted but a stun. */
  affliction: 1,
  /** Unravel: more damage against a foe carrying any debuff. */
  exploit: 1.2,
  /** Flurry: cooldown turns taken off the hunter's other skills by a critical hit. */
  flurry: 1,
} as const;

const pct = (x: number) => Math.round(x * 100);

/** The tree's own passives. Each plays a style only the hunter has. */
export const TREE_PASSIVES: Passive[] = [
  { name: 'Bloodthirst', style: 'vamp', text: `Heal for ${pct(EDGE.vamp)}% of the damage you deal.` },
  { name: 'Rampage', style: 'momentum', text: `Each foe you put down: Attack +${pct(EDGE.momentum.step)}% until the fight ends, up to +${pct(EDGE.momentum.step * EDGE.momentum.max)}%.` },
  { name: 'Ambush', style: 'ambush', text: 'Your first hit in each fight is a critical hit.' },
  { name: 'Flurry', style: 'flurry', text: `On a critical hit: your other skills' cooldowns -${EDGE.flurry}.` },
  { name: 'Cull', style: 'execute', text: `Damage +${pct(EDGE.execute.mult - 1)}% against a foe under ${pct(EDGE.execute.below)}% HP.` },
  { name: 'Deadeye', style: 'deadeye', text: `Critical hits on a Marked foe: damage ×${EDGE.deadeye}.` },
  { name: 'Spiked Guard', style: 'thorns', text: `A foe that hits you takes ${pct(EDGE.thorns)}% of the damage back.` },
  { name: 'Unbroken', style: 'stalwart', text: `Damage taken -${pct(1 - EDGE.stalwart.mult)}% while your HP is above ${pct(EDGE.stalwart.above)}%.` },
  { name: 'Lingering Curse', style: 'affliction', text: `Debuffs you inflict last ${EDGE.affliction} turn longer. Stunned excepted.` },
  { name: 'Unravel', style: 'exploit', text: `Damage +${pct(EDGE.exploit - 1)}% against a foe carrying a debuff.` },
];

export interface PathDef { key: Stat; name: string; desc: string }

/** The Paths, in the order the Stats radar draws their stats, so the tree's shape is the radar's. */
export const PATHS: PathDef[] = [
  { key: 'STR', name: 'Ruin', desc: 'Heavy blows, bleeding wounds and broken guards.' },
  { key: 'VIT', name: 'Bastion', desc: 'HP, defence, and a party that holds its ground.' },
  { key: 'AGI', name: 'Tempest', desc: 'Speed, critical hits and wounds that stay open.' },
  { key: 'INT', name: 'Arcana', desc: 'Magic, curses and debuffs that linger.' },
  { key: 'PER', name: 'Sight', desc: 'Accuracy, marked targets and the killing shot.' },
];
export const pathOf = (k: string) => PATHS.find((p) => p.key === k);

/** What a skill's level adds, past Lv.1. Each entry is one level. */
export interface SkillUp { mult?: number; cd?: number; inflicts?: string[]; profile?: Ability['profile'] }

export interface TreeNode {
  /** `{path}:{slug}`, written to the save. */
  id: string;
  path: Stat;
  /** 0 at D to 4 at S. */
  tier: number;
  /** Its column across the Path, 0 to 4: skills at the edges, forks inside them, the spine down the middle. */
  col: number;
  kind: 'skill' | 'passive' | 'stat';
  name: string;
  /** The most points it takes: a skill's top level, a stat's top rank, 1 for a passive. */
  max: number;
  /** The node it grows from, which must hold a point first. */
  req?: string;
  /** The other half of a fork: while either holds a point, the other is sealed. */
  fork?: string;
  /** A skill: the ability it teaches, and what each level past the first adds. */
  skill?: string;
  up?: SkillUp[];
  /** A passive's name, in `data/abilities.ts` or `TREE_PASSIVES`. */
  passive?: string;
  /** A stat: what each rank adds, as flat attribute points or as the fight bonuses gear rolls use. */
  attrs?: Partial<Record<Stat, number>>;
  bonus?: Record<string, number>;
}

/** What a skill's levels add: a little more force at Lv.2, and at Lv.MAX more force and its own edge. */
const lv = (top: Omit<SkillUp, 'mult'>): SkillUp[] => [{ mult: 0.1 }, { mult: 0.1, ...top }];

interface PathSpec {
  key: Stat;
  /** The left lane's skills at D, C and A, and the right lane's, each with its Lv.MAX edge. */
  left: [string, SkillUp[]][];
  right: [string, SkillUp[]][];
  /** The spine: an attribute at D, a fight bonus at C and at A, three ranks each. */
  attr: [string, number];
  mid: [string, Record<string, number>];
  late: [string, Record<string, number>];
  /** The B tier's fork and its notable, then the S tier's. */
  forkB: [string, string];
  noteB: string;
  /** The right lane's utility, at B, between its C and A skills. */
  util: string;
  forkS: [string, string];
  noteS: string;
}

const SPECS: PathSpec[] = [
  {
    key: 'STR',
    left: [['Hammerblow', lv({ inflicts: ['Staggered'] })], ['Sundering Arc', lv({ profile: 'volley' })], ['Cataclysm', lv({ cd: -1 })]],
    right: [['Rend', lv({ profile: 'cleave' })], ['Skullsplitter', lv({ inflicts: ['Staggered'] })], ["Titan's Fall", lv({ cd: -1 })]],
    attr: ['Might', 2], mid: ['Heavy Hands', { patk: 0.04 }], late: ['Unbowed', { maxHp: 0.05 }],
    forkB: ['Blood Up', 'Scarred Hide'], noteB: 'Bloodthirst', util: 'Dread Roar', forkS: ['Immovable Guard', 'Undying Rage'], noteS: 'Rampage',
  },
  {
    key: 'VIT',
    left: [['Shield Blow', lv({ profile: 'cleave' })], ['Shieldwall', [{ cd: -1 }]], ['Unyielding Advance', lv({ profile: 'volley' })]],
    right: [['Shoulder Charge', lv({ inflicts: ['Staggered'] })], ['Iron Retort', lv({ profile: 'volley' })], ['Earthshaker', lv({ inflicts: ['Staggered'] })]],
    attr: ['Toughness', 2], mid: ['Iron Skin', { defense: 0.05 }], late: ['Lifeblood', { recovery: 0.06 }],
    forkB: ['Deep Reserves', 'Stone Footing'], noteB: 'Spiked Guard', util: 'Challenge', forkS: ['Last Word', 'Rallying Wall'], noteS: 'Unbroken',
  },
  {
    key: 'AGI',
    left: [['Quick Cut', lv({ inflicts: ['Bleeding'] })], ['Bladestorm', lv({ profile: 'volley' })], ['Afterimage', lv({ cd: -1 })]],
    right: [['Venom Edge', lv({ profile: 'cleave' })], ['Hamstring', lv({ inflicts: ['Marked'] })], ['Thousand Cuts', lv({ profile: 'burst' })]],
    attr: ['Swiftness', 2], mid: ['Fleet Foot', { evasion: 4 }], late: ['Quicksilver', { initiative: 6 }],
    forkB: ['Light Step', "Hunter's Read"], noteB: 'Ambush', util: 'Smoke Veil', forkS: ['Bladework', 'Not There'], noteS: 'Flurry',
  },
  {
    key: 'INT',
    left: [['Mana Bolt', lv({ profile: 'cleave' })], ['Hex', lv({ inflicts: ['Weakened'] })], ['Mindbreak', lv({ cd: -1 })]],
    right: [['Frost Needle', lv({ profile: 'cleave' })], ['Flame Lash', lv({ profile: 'volley' })], ['Starfall', lv({ inflicts: ['Cursed'] })]],
    attr: ['Insight', 2], mid: ['Mana Flow', { mpow: 0.04 }], late: ['Spellcraft', { statusChance: 5 }],
    forkB: ['Warded Mind', 'Overflow'], noteB: 'Lingering Curse', util: 'Renewal', forkS: ['Field Command', 'Soul Anchor'], noteS: 'Unravel',
  },
  {
    key: 'PER',
    left: [['Precise Shot', lv({ inflicts: ['Marked'] })], ['Weak Point', lv({ inflicts: ['Corroded'] })], ['Killing Sight', lv({ cd: -1 })]],
    right: [['Pinning Shot', lv({ inflicts: ['Marked'] })], ['Scatter Shot', lv({ profile: 'burst' })], ['Execution', lv({ cd: -1 })]],
    attr: ['Focus', 2], mid: ['Steady Aim', { accuracy: 5 }], late: ['Deadly Aim', { crit: 2 }],
    forkB: ['Killer Instinct', 'Patient Eye'], noteB: 'Cull', util: "Hunter's Mark", forkS: ['True Sight', 'Lethal Precision'], noteS: 'Deadeye',
  },
];

const slug = (n: string) => n.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

/** A Path's sixteen nodes, laid out: skills down the edges, the spine down the middle, forks either side of it, and the utility in the right lane at B. */
function nodesOf(p: PathSpec): TreeNode[] {
  const id = (n: string) => `${p.key}:${slug(n)}`;
  const skill = (tier: number, col: number, [name, up]: [string, SkillUp[]], req?: string): TreeNode =>
    ({ id: id(name), path: p.key, tier, col, kind: 'skill', name, max: 1 + up.length, skill: name, up, req: req && id(req) });
  const passive = (tier: number, col: number, name: string, req: string, fork?: string): TreeNode =>
    ({ id: id(name), path: p.key, tier, col, kind: 'passive', name, max: 1, passive: name, req: id(req), fork: fork && id(fork) });
  const stat = (tier: number, name: string, b: Pick<TreeNode, 'attrs' | 'bonus'>, req?: string): TreeNode =>
    ({ id: id(name), path: p.key, tier, col: 2, kind: 'stat', name, max: 3, req: req && id(req), ...b });
  const [l0, l1, l3] = p.left;
  const [r0, r1, r3] = p.right;
  return [
    skill(0, 0, l0), stat(0, p.attr[0], { attrs: { [p.key]: p.attr[1] } }), skill(0, 4, r0),
    skill(1, 0, l1, l0[0]), stat(1, p.mid[0], { bonus: p.mid[1] }, p.attr[0]), skill(1, 4, r1, r0[0]),
    passive(2, 1, p.forkB[0], p.mid[0], p.forkB[1]), passive(2, 2, p.noteB, p.mid[0]), passive(2, 3, p.forkB[1], p.mid[0], p.forkB[0]),
    skill(2, 4, [p.util, [{ cd: -1 }]], r1[0]),
    skill(3, 0, l3, l1[0]), stat(3, p.late[0], { bonus: p.late[1] }, p.noteB), skill(3, 4, r3, p.util),
    passive(4, 1, p.forkS[0], p.late[0], p.forkS[1]), passive(4, 2, p.noteS, p.late[0]), passive(4, 3, p.forkS[1], p.late[0], p.forkS[0]),
  ];
}

export const NODES: TreeNode[] = SPECS.flatMap(nodesOf);
const byId = new Map(NODES.map((n) => [n.id, n]));
export const nodeById = (id: string) => byId.get(id);
