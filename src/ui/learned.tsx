/**
 * The skills a promotion taught, under its window's lines (`app/flow.ts`): `Skill learned: [Venom Spray]`, the name a
 * told word that opens the skill in the one tooltip, as its line on the Shadow's card reads (the owner's call: the
 * window named the skill and said nothing of it). With more than one Shadow promoted, each line names whose it is.
 */
import type { VNode } from 'preact';
import { ability } from '@/core/combat';
import { skillLine } from '@/screens/Skills';
import { InfoTag } from './infotag';

export interface Learned { skill: string; who?: string }

function Lines({ list }: { list: Learned[] }) {
  return (
    <div class="learned">
      {list.map((l) => {
        const a = ability(l.skill);
        return (
          <p key={`${l.who ?? ''}${l.skill}`} class="syswin__line learned__line">
            {l.who ? <><strong>[{l.who}]</strong> </> : null}Skill learned:{' '}
            <InfoTag class="learned__skill" tip={{ title: l.skill, kind: 'Skill', tone: 'shadow', lines: a ? [skillLine(a)] : [] }}>[{l.skill}]</InfoTag>
          </p>
        );
      })}
    </div>
  );
}

/** A System window's `body` for the skills learned, or nothing when none was. */
export const learnedBody = (list: Learned[]): (() => VNode) | undefined => (list.length ? () => <Lines list={list} /> : undefined);
