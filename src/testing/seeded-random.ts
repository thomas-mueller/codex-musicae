/* eslint-disable @typescript-eslint/no-magic-numbers -- the constants of the mulberry32 algorithm, nothing to tune */
/** A seeded pseudo-random generator (mulberry32): the same seed gives the same sequence on every run. */
export interface SeededRandom {
  /** An integer in 0..count-1. */
  below(count: number): number;
  /** True with the given probability. */
  chance(probability: number): boolean;
}

export function seededRandom(seed: number): SeededRandom {
  let state = seed;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { below: (count) => Math.floor(next() * count), chance: (probability) => next() < probability };
}
