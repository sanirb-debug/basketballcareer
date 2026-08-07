/**
 * The single seeded PRNG for the entire simulation (SPEC §16.2).
 *
 * Every random call in the game routes through here. The platform's unseeded
 * RNG is banned everywhere in `src/` except the seed bootstrap in
 * `newGame.ts`, and that ban is asserted by the Phase 0 verification script —
 * which greps for the identifier itself, so even naming it in a comment fails
 * the build. That is deliberate: the exception should be a decision, not a
 * habit.
 *
 * mulberry32's entire internal state is a single uint32, so `RngState` is the
 * complete, exact state of the stream. Restoring a saved run is therefore O(1)
 * and bit-exact — no replaying a call count.
 */

export interface RngState {
  /** mulberry32's internal 32-bit state. This alone determines all future draws. */
  s: number;
  /** Total draws consumed. Debugging/assertion only — never feeds the stream. */
  calls: number;
}

export interface Rng {
  /** Uniform float in [0, 1). The primitive every other helper is built on. */
  next(): number;
  /** Uniform integer in [min, max], inclusive on both ends. */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** Uniform element from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Element chosen by relative weight. `weights` must align with `items`. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** Normal deviate via Box-Muller. Consumes exactly 2 draws. */
  normal(mean: number, sd: number): number;
  /** True with the given probability. */
  chance(p: number): boolean;
  /** Current exact state, safe to persist. */
  state(): RngState;
}

/** Derive a starting stream state from a numeric seed. */
export function seedToState(seed: number): RngState {
  return { s: seed >>> 0, calls: 0 };
}

/**
 * Hash an arbitrary user-entered string into a 32-bit seed (FNV-1a).
 * Lets players share runs as words rather than raw integers.
 */
export function hashSeedString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(initial: RngState): Rng {
  let s = initial.s >>> 0;
  let calls = initial.calls;

  const next = (): number => {
    calls++;
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number =>
    min + Math.floor(next() * (max - min + 1));

  const float = (min: number, max: number): number => min + next() * (max - min);

  const pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('rng.pick: empty array');
    return items[Math.floor(next() * items.length)] as T;
  };

  const weighted = <T,>(items: readonly T[], weights: readonly number[]): T => {
    if (items.length === 0) throw new Error('rng.weighted: empty array');
    if (items.length !== weights.length) {
      throw new Error('rng.weighted: items and weights must be the same length');
    }
    let total = 0;
    for (const w of weights) {
      if (w < 0) throw new Error('rng.weighted: negative weight');
      total += w;
    }
    if (total <= 0) throw new Error('rng.weighted: weights sum to zero');
    let roll = next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i] as number;
      if (roll <= 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  };

  const normal = (mean: number, sd: number): number => {
    // Box-Muller. u1 is nudged off zero so log() stays finite.
    const u1 = next() || Number.EPSILON;
    const u2 = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  const chance = (p: number): boolean => next() < p;

  return {
    next,
    int,
    float,
    pick,
    weighted,
    normal,
    chance,
    state: (): RngState => ({ s, calls }),
  };
}

/** Clamp helper used across the engine wherever rolls need bounding. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
