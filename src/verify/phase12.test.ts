import { describe, expect, test } from 'vitest';

import { createGame, type CreationInput } from '../engine/newGame';
import { autoTick, autoTickMonths } from './harness';
import { toPublicView } from '../engine/selectors';
import { goOut, interactWith } from '../engine/lifeActions';
import { DecisionError } from '../engine/decisions';
import { ageYearsOf } from '../engine/stages';
import {
  NIGHTLIFE_MIN_AGE,
  NIGHTS,
  distractionEffects,
  fameFor,
  nightlifeUnlocked,
  nightsFor,
  settleNightlife,
} from '../engine/nightlife';
import { interactionsFor } from '../engine/people';
import type { GameState, NightlifeState } from '../engine/types';

/**
 * PHASE 12 VERIFICATION
 *
 * The off-court life (SPEC §6).
 *
 * Two assertions carry the whole file:
 *
 * 1. **The age gate holds.** The career starts at thirteen. None of this
 *    exists before eighteen, and that is enforced in the engine rather than
 *    in the UI — a test drives the engine directly and is refused.
 * 2. **It is a trade, not a punishment.** Going out has to be genuinely worth
 *    doing, the cost has to be real and legible, and it has to clear if you
 *    walk away from it. A mechanic that is strictly bad is a mechanic nobody
 *    interacts with twice.
 */

const INPUT: CreationInput = {
  name: 'Marcus Vale',
  position: 'SG',
  jerseyNumber: 3,
  handedness: 'right',
  homeCity: 'Gary',
  homeState: 'Indiana',
  schoolTier: 'public',
};

function withMoney(state: GameState, money: number): GameState {
  return { ...state, money };
}

/** Advance to an adult career with money in the account. */
function adult(seed: number, money = 400_000): GameState {
  let state = createGame(seed, INPUT);
  while (ageYearsOf(state) < NIGHTLIFE_MIN_AGE && !state.careerEnd) {
    state = autoTick(state, []);
  }
  return withMoney(state, money);
}

describe('the age gate is enforced in the engine (SPEC §6)', () => {
  test('a thirteen-year-old career has no nights at all', () => {
    const state = createGame(1, INPUT);
    expect(ageYearsOf(state)).toBeLessThan(NIGHTLIFE_MIN_AGE);
    expect(nightlifeUnlocked(ageYearsOf(state))).toBe(false);
    expect(nightsFor(state.stage, ageYearsOf(state))).toHaveLength(0);
    expect(toPublicView(state).nightlife.unlocked).toBe(false);
  });

  test('the engine refuses every night while the player is a minor', () => {
    let state = withMoney(createGame(2, INPUT), 1_000_000);

    // Every month from thirteen up to the gate, every option on the menu.
    for (let i = 0; i < 12 && ageYearsOf(state) < NIGHTLIFE_MIN_AGE; i++) {
      for (const def of NIGHTS) {
        expect(() => goOut(state, def.id)).toThrow(DecisionError);
      }
      state = autoTick(state, []);
      state = withMoney(state, 1_000_000);
    }

    expect(state.nightlife.nightsOut).toBe(0);
    expect(state.nightlife.distraction).toBe(0);
  });

  test('the adult interactions are not offered to a minor either', () => {
    const minor = interactionsFor('partner', 15).map((i) => i.id);
    expect(minor).not.toContain('stayIn');
    expect(interactionsFor('fling', 15).map((i) => i.id)).not.toContain('commit');

    const grown = interactionsFor('partner', 22).map((i) => i.id);
    expect(grown).toContain('stayIn');
  });

  test('a minor cannot reach an adult interaction through the engine', () => {
    const state = createGame(4, INPUT);
    const someone = state.people[0];
    expect(() => interactWith(state, someone.id, 'stayIn')).toThrow(
      DecisionError,
    );
  });

  test('the gate opens exactly at eighteen and not before', () => {
    expect(nightlifeUnlocked(17.99)).toBe(false);
    expect(nightlifeUnlocked(NIGHTLIFE_MIN_AGE)).toBe(true);

    const grown = adult(5);
    expect(ageYearsOf(grown)).toBeGreaterThanOrEqual(NIGHTLIFE_MIN_AGE);
    expect(toPublicView(grown).nightlife.unlocked).toBe(true);
    expect(nightsFor(grown.stage, ageYearsOf(grown)).length).toBeGreaterThan(0);
  });
});

describe('the nights are a trade (SPEC §6)', () => {
  test('the menu is internally consistent', () => {
    const ids = new Set<string>();
    for (const def of NIGHTS) {
      expect(ids.has(def.id)).toBe(false);
      ids.add(def.id);
      expect(def.label.trim().length).toBeGreaterThan(0);
      expect(def.detail.trim().length).toBeGreaterThan(20);
      expect(def.cost).toBeGreaterThanOrEqual(0);
      expect(def.meetChance).toBeGreaterThanOrEqual(0);
      expect(def.meetChance).toBeLessThanOrEqual(1);
    }
    // There is always a way down as well as a way up.
    expect(NIGHTS.some((n) => n.distraction < 0)).toBe(true);
    expect(NIGHTS.some((n) => n.distraction > 20)).toBe(true);
    // And something free, so being broke never locks you out of a life.
    expect(NIGHTS.some((n) => n.cost === 0)).toBe(true);
  });

  test('going out raises distraction and staying in lowers it', () => {
    const state = adult(6);

    const out = goOut(state, 'club');
    expect(out.nightlife.distraction).toBeGreaterThan(state.nightlife.distraction);
    expect(out.nightlife.nightsOut).toBe(1);
    expect(out.money).toBeLessThan(state.money);

    const raised = { ...state, nightlife: { ...state.nightlife, distraction: 60 } };
    const quiet = goOut(raised, 'quietNight');
    expect(quiet.nightlife.distraction).toBeLessThan(60);
    expect(quiet.condition.energy).toBeGreaterThanOrEqual(
      raised.condition.energy,
    );
  });

  test('distraction is a real, legible tax on the on-court career', () => {
    const clean = distractionEffects(0);
    expect(clean.trainingFactor).toBe(1);
    expect(clean.trustDelta).toBe(0);
    expect(clean.confidencePenalty).toBe(0);
    expect(clean.injuryFactor).toBe(1);

    const wrecked = distractionEffects(100);
    expect(wrecked.trainingFactor).toBeLessThan(0.7);
    expect(wrecked.trustDelta).toBeLessThan(-2);
    expect(wrecked.confidencePenalty).toBeGreaterThan(15);
    expect(wrecked.injuryFactor).toBeGreaterThan(1.3);

    // Monotone in between — no cliffs to game.
    for (let d = 0; d < 100; d += 10) {
      expect(distractionEffects(d + 10).trainingFactor).toBeLessThan(
        distractionEffects(d).trainingFactor,
      );
    }
  });

  test('a wrecked player develops measurably worse than a locked-in one', () => {
    let locked = adult(9);
    let wrecked: GameState = {
      ...locked,
      nightlife: { ...locked.nightlife, distraction: 90 },
    };
    const start = locked.player.attributes.catchAndShoot3 as number;

    // Short horizon on purpose: over enough months both saturate against the
    // skill ceiling and the rate difference disappears into the cap.
    for (let i = 0; i < 10 && !locked.careerEnd && !wrecked.careerEnd; i++) {
      locked = autoTick(locked, [{ id: 'shooting' }]);
      // Keep the life topped up, the way somebody actually living it would.
      wrecked = autoTick(wrecked, [{ id: 'shooting' }]);
      wrecked = {
        ...wrecked,
        nightlife: { ...wrecked.nightlife, distraction: 90 },
      };
    }

    // Measured on the attribute being trained: `overall` is a rounded
    // composite and can hide a real difference behind a single point.
    const lockedGain = (locked.player.attributes.catchAndShoot3 as number) - start;
    const wreckedGain =
      (wrecked.player.attributes.catchAndShoot3 as number) - start;

    expect(lockedGain).toBeGreaterThan(0);
    expect(wreckedGain).toBeLessThan(lockedGain);
    expect(locked.coachTrust).toBeGreaterThan(wrecked.coachTrust);
  });

  test('it clears if you leave it alone — this is not a death spiral', () => {
    let state = adult(10);
    state = goOut(state, 'afterHours');
    const peak = state.nightlife.distraction;
    expect(peak).toBeGreaterThan(0);

    state = autoTickMonths(state, 6);
    expect(state.nightlife.distraction).toBeLessThan(peak);
    expect(state.nightlife.distraction).toBe(0);
  });

  test('somebody at home clears it faster', () => {
    const base: NightlifeState = {
      distraction: 50,
      nightsThisMonth: 2,
      nightsOut: 9,
      flings: 1,
      tabloidStories: 0,
      caught: 0,
    };

    const alone = settleNightlife(base, { hasPartner: false, exclusive: false });
    const seeing = settleNightlife(base, { hasPartner: true, exclusive: false });
    const serious = settleNightlife(base, { hasPartner: true, exclusive: true });

    expect(seeing.distraction).toBeLessThan(alone.distraction);
    expect(serious.distraction).toBeLessThan(seeing.distraction);
    // And the monthly counter always resets.
    expect(alone.nightsThisMonth).toBe(0);
  });

  test('going out is genuinely worth doing, not strictly a mistake', () => {
    const state = adult(11);
    const after = goOut(state, 'outWithTheGuys');

    // Confidence and friendships both move, or the menu is a trap.
    expect(after.player.hiddenMeta.confidence).toBeGreaterThan(
      state.player.hiddenMeta.confidence,
    );
    expect(after.relationships.friends.level).toBeGreaterThan(
      state.relationships.friends.level,
    );
  });

  test('there is no cap on nights either — the limiter is what it costs', () => {
    let state = adult(12, 2_000_000);
    for (let i = 0; i < 8; i++) {
      state = goOut(state, 'club');
    }
    expect(state.nightlife.nightsThisMonth).toBe(8);
    expect(state.nightlife.distraction).toBeGreaterThan(50);
    // Money and energy are what actually stop you.
    expect(state.condition.energy).toBeLessThan(40);

    const broke = withMoney(adult(12), 10);
    expect(() => goOut(broke, 'club')).toThrow(DecisionError);
    // But the free options are always open.
    expect(() => goOut(broke, 'quietNight')).not.toThrow();
  });

  test('the fourth night of a month gives back less than the first', () => {
    let state = adult(15, 2_000_000);
    const joys: number[] = [];
    for (let i = 0; i < 4; i++) {
      const before = state.player.hiddenMeta.confidence;
      state = goOut(state, 'outWithTheGuys');
      joys.push(state.player.hiddenMeta.confidence - before);
    }
    expect(joys[3]).toBeLessThan(joys[0]);
  });
});

describe('fame is the multiplier on the risk (SPEC §6, §12)', () => {
  test('a nobody is invisible and a star is not', () => {
    const kid = fameFor('highschool', 5, 0);
    const collegian = fameFor('college', 40, 20_000);
    const star = fameFor('nba', 90, 3_000_000);

    expect(kid).toBeLessThan(collegian);
    expect(collegian).toBeLessThan(star);
    expect(star).toBeGreaterThan(70);
    expect(kid).toBeGreaterThanOrEqual(0);
    expect(star).toBeLessThanOrEqual(100);
  });

  test('the same night is written about far more often at the top', () => {
    // 60 identical nights at each level, counting the ones that became a story.
    const count = (state: GameState) => {
      let stories = 0;
      let run = state;
      for (let i = 0; i < 60; i++) {
        run = withMoney(goOut(run, 'club'), 5_000_000);
        stories = run.nightlife.tabloidStories;
      }
      return stories;
    };

    const quiet = adult(16, 5_000_000);
    const famous: GameState = {
      ...quiet,
      stage: 'nba',
      hype: { ...quiet.hype, hype: 95 },
    };

    expect(count(famous)).toBeGreaterThan(count(quiet));
  });

  test('a story costs standing and buys the wrong kind of attention', () => {
    let state: GameState = {
      ...adult(17, 5_000_000),
      stage: 'nba',
      hype: { ...adult(17).hype, hype: 95 },
    };
    const beforeRep = state.reputation.offCourt;
    const beforeTrust = state.coachTrust;

    for (let i = 0; i < 25; i++) {
      state = withMoney(goOut(state, 'club'), 5_000_000);
    }

    expect(state.nightlife.tabloidStories).toBeGreaterThan(0);
    expect(state.reputation.offCourt).toBeLessThan(beforeRep);
    expect(state.coachTrust).toBeLessThan(beforeTrust);
  });
});

describe('who you go home with (SPEC §6)', () => {
  test('meeting somebody with nobody waiting puts them in your life', () => {
    let state = adult(18, 5_000_000);
    for (let i = 0; i < 30 && state.people.every((p) => p.role !== 'fling'); i++) {
      state = withMoney(goOut(state, 'club'), 5_000_000);
    }

    const met = state.people.find((p) => p.role === 'fling');
    expect(met).toBeDefined();
    expect(met!.age).toBeGreaterThanOrEqual(18);
    expect(met!.metMonth).toBe(state.monthsElapsed);
    expect(state.relationships.girlfriend.active).toBe(true);
    // They show up on the People screen with a menu of their own.
    expect(toPublicView(state).people.some((p) => p.id === met!.id)).toBe(true);
    expect(interactionsFor('fling', 21).map((i) => i.id)).toContain('commit');
  });

  test('everybody you meet out is an adult, across a long career', () => {
    let state = adult(19, 20_000_000);
    for (let i = 0; i < 120 && !state.careerEnd; i++) {
      state = withMoney(goOut(state, 'club'), 20_000_000);
      state = withMoney(autoTick(state, []), 20_000_000);
    }
    for (const person of state.people) {
      if (person.role === 'fling' || person.role === 'partner') {
        expect(person.age).toBeGreaterThanOrEqual(18);
      }
    }
  });

  test('a fling can be made serious, and that steadies you', () => {
    let state = adult(20, 5_000_000);
    for (let i = 0; i < 30 && state.people.every((p) => p.role !== 'fling'); i++) {
      state = withMoney(goOut(state, 'club'), 5_000_000);
    }
    const fling = state.people.find((p) => p.role === 'fling')!;

    const before = state.nightlife.distraction;
    const after = interactWith(state, fling.id, 'commit');
    const partner = after.people.find((p) => p.id === fling.id)!;

    expect(partner.role).toBe('partner');
    expect(partner.exclusive).toBe(true);
    expect(partner.relationship).toBeGreaterThan(fling.relationship);
    expect(after.nightlife.distraction).toBeLessThan(before + 1);
  });

  test('going home with somebody else while committed has consequences', () => {
    // Build a committed player, then send them out repeatedly.
    let state = adult(22, 20_000_000);
    for (let i = 0; i < 40 && state.people.every((p) => p.role !== 'fling'); i++) {
      state = withMoney(goOut(state, 'club'), 20_000_000);
    }
    const fling = state.people.find((p) => p.role === 'fling')!;
    state = interactWith(state, fling.id, 'commit');
    state = { ...state, stage: 'nba', hype: { ...state.hype, hype: 95 } };

    const partnerBefore = state.people.find((p) => p.id === fling.id)!;
    for (let i = 0; i < 40; i++) {
      state = withMoney(goOut(state, 'club'), 20_000_000);
    }

    expect(state.nightlife.flings).toBeGreaterThan(0);
    const partnerAfter = state.people.find((p) => p.id === fling.id)!;
    // Either it cost the relationship, or it ended it outright.
    expect(
      partnerAfter.relationship < partnerBefore.relationship ||
        partnerAfter.role === 'ex',
    ).toBe(true);
    expect(state.nightlife.caught).toBeGreaterThan(0);
  });

  test('a second person is not silently added while you are with someone', () => {
    let state = adult(23, 20_000_000);
    for (let i = 0; i < 40 && state.people.every((p) => p.role !== 'fling'); i++) {
      state = withMoney(goOut(state, 'club'), 20_000_000);
    }
    state = interactWith(
      state,
      state.people.find((p) => p.role === 'fling')!.id,
      'commit',
    );

    for (let i = 0; i < 30; i++) {
      state = withMoney(goOut(state, 'club'), 20_000_000);
      const seeing = state.people.filter(
        (p) => p.active && (p.role === 'partner' || p.role === 'fling'),
      );
      expect(seeing.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('the off-court life survives the save and the whole career', () => {
  test('a full career with the nights lived hard still ends cleanly', () => {
    let state = adult(24, 50_000_000);

    for (let i = 0; i < 200 && !state.careerEnd; i++) {
      state = withMoney(goOut(state, 'club'), 50_000_000);
      state = goOut(state, 'apps');
      state = autoTick(state, [{ id: 'shooting' }]);
    }

    expect(state.careerEnd).not.toBeNull();
    expect(state.nightlife.distraction).toBeGreaterThanOrEqual(0);
    expect(state.nightlife.distraction).toBeLessThanOrEqual(100);
    expect(state.nightlife.nightsOut).toBeGreaterThan(20);
    expect(state.coachTrust).toBeGreaterThanOrEqual(0);
    expect(state.reputation.offCourt).toBeGreaterThanOrEqual(0);
    for (const person of state.people) {
      expect(person.relationship).toBeGreaterThanOrEqual(0);
      expect(person.relationship).toBeLessThanOrEqual(100);
    }
  });

  test('living clean beats living hard over the same career', () => {
    // Same seed, same training, same everything except the evenings.
    let clean = adult(26, 50_000_000);
    let hard = adult(26, 50_000_000);

    for (let i = 0; i < 36 && !clean.careerEnd && !hard.careerEnd; i++) {
      clean = goOut(clean, 'quietNight');
      hard = withMoney(goOut(hard, 'afterHours'), 50_000_000);
      hard = withMoney(goOut(hard, 'club'), 50_000_000);
      clean = autoTick(clean, [{ id: 'shooting' }]);
      hard = autoTick(hard, [{ id: 'shooting' }]);
    }

    expect(toPublicView(clean).player.overall).toBeGreaterThan(
      toPublicView(hard).player.overall,
    );
  });

  test('the nightlife state round-trips and stays out of the public view’s secrets', () => {
    let state = adult(27, 5_000_000);
    state = goOut(state, 'club');

    const view = toPublicView(state);
    expect(view.nightlife.unlocked).toBe(true);
    expect(view.nightlife.distraction).toBe(
      Math.round(state.nightlife.distraction),
    );
    expect(view.nightlife.label.length).toBeGreaterThan(0);
    expect(view.nightlife.nights.length).toBeGreaterThan(0);

    const dumped = JSON.stringify(view);
    expect(dumped).not.toContain('heightCeiling');
    expect(dumped).not.toContain('injuryProneness');
  });
});
