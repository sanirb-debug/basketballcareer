import { TIER_LABEL, programById } from './colleges';
import { activeOffers, bestOffer } from './recruiting';
import { ACADEMICS } from './academics';
import { gradeForClock } from './season';
import type { CareerEnd, EndingId, GameState } from './types';

/**
 * Terminal states (SPEC §15).
 *
 * Two rules from the spec drive everything here:
 *
 * 1. Every run ends with a *named* ending and a screen that "names the
 *    specific decision that broke it" — so every ending carries a `decision`
 *    line built from what actually happened in this run, not boilerplate.
 * 2. Most sims only reward becoming the best player alive. This one has to
 *    make a smaller outcome feel like a real result, so a mid-major signature
 *    and a JUCO road are written as achievements rather than consolation.
 */

export interface EndingCopy {
  reason: string;
  detail: string;
  /** Higher is a better outcome, for sorting and for the archive. */
  score: number;
}

const ENDING_COPY: Record<EndingId, EndingCopy> = {
  'blueblood-signee': {
    reason: 'Blueblood signee',
    detail:
      'You signed with a program that has banners in the rafters and a rotation full of people exactly like you. Everything you did from thirteen led here.',
    score: 100,
  },
  'high-major-signee': {
    reason: 'High-major signee',
    detail:
      'You signed at the high-major level. A real scholarship, a real conference, and a genuine chance to play on television.',
    score: 85,
  },
  'mid-major-signee': {
    reason: 'Mid-major signee',
    detail:
      'You signed with a mid-major. This is what the overwhelming majority of good high school players never get, and it is a career worth having.',
    score: 70,
  },
  'low-major-signee': {
    reason: 'Low-major signee',
    detail:
      'You signed a college scholarship. Small gym, small budget, and your name on a roster that gets to keep playing.',
    score: 55,
  },
  'juco-grinder': {
    reason: 'The JUCO road',
    detail:
      'Junior college. Two years to fix what needs fixing and re-recruit yourself with a compressed window. It is not the end — plenty of people have taken this road and come out the other side.',
    score: 40,
  },
  'academic-washout': {
    reason: 'Academic washout',
    detail:
      'The basketball was never the problem. You could not clear the classroom bar, the D1 offers evaporated, and nobody was left holding a scholarship for you.',
    score: 20,
  },
  'no-offers': {
    reason: 'No offers',
    detail:
      'Nobody offered. You can still hoop — rec leagues, open gyms, the occasional tournament where somebody says you should have played college ball.',
    score: 10,
  },
  'off-court-flameout': {
    reason: 'Off-court flameout',
    detail:
      'The talent was never in question. Everything around it was.',
    score: 5,
  },
  'career-ending-injury': {
    reason: 'Career-ending injury',
    detail: 'The run just stops. No build-up, no warning, no second act.',
    score: 15,
  },
};

export function endingCopy(id: EndingId): EndingCopy {
  return ENDING_COPY[id];
}

/**
 * Name the specific decision that produced this outcome.
 *
 * This is the part SPEC §15 actually asks for. It reads the run rather than
 * picking a canned line — the GPA you finished with, the school you picked at
 * thirteen, the choice that set the flag.
 */
function pivotalDecision(state: GameState, endingId: EndingId): string {
  const { academics, hype, school, recruiting } = state;

  switch (endingId) {
    case 'academic-washout':
      return (
        `You finished with a ${academics.gpa.toFixed(2)} GPA and ${academics.coreCredits} of ` +
        `${ACADEMICS.CORE_CREDITS_REQUIRED} core credits. Every month you chose the gym over the ` +
        `classroom was a month this was getting closer.`
      );

    case 'no-offers':
      return (
        `You finished ranked #${hype.nationalRank} with ${Math.round(hype.hype)} hype. ` +
        `Choosing ${school.name} at thirteen meant the basketball was real and the audience was not.`
      );

    case 'off-court-flameout':
      return (
        `Off-court character bottomed out at ${Math.round(state.reputation.offCourt)}. ` +
        `It was never one decision — it was the eighth one.`
      );

    case 'career-ending-injury':
      return 'One landing. Nothing you chose, and nothing you could have chosen differently.';

    case 'juco-grinder': {
      if (academics.status === 'non-qualifier') {
        return (
          `A ${academics.gpa.toFixed(2)} GPA closed every four-year door. JUCO was not a choice ` +
          `you made — it was the one that was left.`
        );
      }
      return `You took the junior college route with ${activeOffers(recruiting).length} offer(s) on the table.`;
    }

    default: {
      const flips =
        recruiting.decommits > 0
          ? ` It took ${recruiting.decommits} decommit${
              recruiting.decommits === 1 ? '' : 's'
            } to get there.`
          : '';

      // Actually signed: name the school and when the decision was made.
      if (recruiting.signed && recruiting.commitment) {
        const program = programById(recruiting.commitment.programId);
        return (
          `You committed to ${program?.name ?? 'your school'} in month ` +
          `${recruiting.commitment.monthsElapsed} ranked #${hype.nationalRank}, ` +
          `and signed it.${flips}`
        );
      }

      // Committed but never put pen to paper before the window shut.
      if (recruiting.commitment) {
        const program = programById(recruiting.commitment.programId);
        return (
          `You were committed to ${program?.name ?? 'a program'} but never signed ` +
          `before the window closed.${flips}`
        );
      }

      // Never committed at all — the deadline chose for you.
      const best = bestOffer(recruiting);
      const count = activeOffers(recruiting).length;
      return (
        `You never committed anywhere. ${count} offer${count === 1 ? '' : 's'} ` +
        `sat on the table until signing day passed, and ` +
        `${best?.name ?? 'the best of them'} was the highest you had reached at ` +
        `#${hype.nationalRank}.${flips}`
      );
    }
  }
}

/** Which ending a signed player earned, by the tier they signed with. */
function endingForSignedTier(programId: string): EndingId {
  const program = programById(programId);
  switch (program?.tier) {
    case 'blueblood':
      return 'blueblood-signee';
    case 'high-major':
      return 'high-major-signee';
    case 'mid-major':
      return 'mid-major-signee';
    case 'low-major':
      return 'low-major-signee';
    default:
      return 'juco-grinder';
  }
}

/**
 * Whether the high school slice is over.
 *
 * SPEC §18 ends the vertical slice on signing day. The run closes once the
 * player has signed, or once the late signing period of senior year passes
 * without a signature.
 */
export function isSliceOver(state: GameState): boolean {
  if (state.careerEnd) return true;
  if (state.recruiting.signed) return true;

  const grade = gradeForClock(state.clock);
  // May of senior year: the April late period has been and gone.
  return grade >= 12 && state.clock.month >= 4 && state.clock.month <= 6;
}

export function resolveEnding(state: GameState): CareerEnd {
  // A career-ending injury or a flameout already wrote its own ending.
  if (state.careerEnd) return state.careerEnd;

  let endingId: EndingId;

  if (state.recruiting.signed && state.recruiting.commitment) {
    endingId = endingForSignedTier(state.recruiting.commitment.programId);
  } else {
    const offers = activeOffers(state.recruiting);
    const d1 = offers.filter((o) => programById(o.programId)?.tier !== 'juco');

    if (state.academics.status === 'non-qualifier') {
      // The academic gate is what closed the doors, whether or not JUCO is open.
      endingId = offers.length > 0 ? 'juco-grinder' : 'academic-washout';
    } else if (d1.length > 0) {
      // Offers existed and were never signed — take the best one on the table.
      const best = d1
        .map((o) => programById(o.programId))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .sort((a, b) => a.rankCutoff - b.rankCutoff)[0];
      endingId = best ? endingForSignedTier(best.id) : 'no-offers';
    } else if (offers.length > 0) {
      endingId = 'juco-grinder';
    } else {
      endingId = 'no-offers';
    }
  }

  const copy = ENDING_COPY[endingId];

  // The signee copy says "you signed". Don't claim that if he never did —
  // the level he reached is still real, but the signature is not.
  const isSignee = endingId.endsWith('-signee');
  const detail =
    isSignee && !state.recruiting.signed
      ? `You got to ${copy.reason.replace(' signee', '').toLowerCase()} level and had the ` +
        `offer in hand, but signing day came and went without your name on anything.`
      : copy.detail;

  return {
    endingId,
    reason: isSignee && !state.recruiting.signed
      ? `${copy.reason.replace(' signee', '')} — unsigned`
      : copy.reason,
    detail,
    decision: pivotalDecision(state, endingId),
    monthsElapsed: state.monthsElapsed,
  };
}

export function endingScore(id: EndingId): number {
  return ENDING_COPY[id].score;
}

/** Human label for the program signed with, used on the ending screen. */
export function signedWith(state: GameState): string | null {
  if (!state.recruiting.commitment) return null;
  const program = programById(state.recruiting.commitment.programId);
  if (!program) return null;
  return `${program.name} (${TIER_LABEL[program.tier]})`;
}
