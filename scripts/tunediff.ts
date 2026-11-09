/**
 * What a calibration changed: every value in src/data/gatetune.ts that moved, old → new.
 *
 *   npm run tunediff                    the last commit against the working tree (after a calibration)
 *   npm run tunediff -- <from> [<to>]   two commits, e.g. a merge's first parent and the merge
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describeTune, parseTune, TUNE_FILE } from './tune';

const [from = 'HEAD', to] = process.argv.slice(2);
const at = (ref: string) => execFileSync('git', ['show', `${ref}:${TUNE_FILE}`], { encoding: 'utf8' });
const before = parseTune(at(from));
const after = parseTune(to ? at(to) : readFileSync(TUNE_FILE, 'utf8'));
console.log(describeTune(before, after, from, to ?? 'working tree'));
