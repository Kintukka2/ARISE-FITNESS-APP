/** Story beats: each fires once, the first time its condition holds. */
import { BEATS, type Beat } from '@/data/narrative';
import type { Save } from './types';

export function pending(s: Save): Beat[] {
  return BEATS.filter((b) => !s.story.includes(b.id) && safe(b, s));
}

function safe(b: Beat, s: Save) {
  try { return b.when(s); } catch { return false; }
}

export function markSeen(s: Save, id: string) {
  if (!s.story.includes(id)) s.story.push(id);
}

/** One-shot flags for walkthroughs and notices. */
export const seen = (s: Save, key: string) => s.seen.includes(key);
export function markOnce(s: Save, key: string): boolean {
  if (s.seen.includes(key)) return false;
  s.seen.push(key);
  return true;
}
