// Seedable PRNG for the tablet weight process-noise stream.
//
// CarProducer used Math.random() directly, which makes every run different:
// the defect count, the detection latency and the "shipped undetected" gap
// all moved between the rehearsal and the stage, so none of them could be
// written into speaker notes. mulberry32 is small, fast and has a long
// enough period for this; nothing here is cryptographic.
import { SEED } from './presenterConfig';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let next: () => number = SEED === null ? Math.random : mulberry32(SEED);

/** Uniform [0, 1). Routed through here rather than Math.random so a run can
 *  be reproduced exactly. */
export function random(): number {
  return next();
}

/** Restart the stream from the configured seed. Called on reset, so that
 *  re-running an act reproduces the previous run's numbers exactly rather
 *  than continuing further down the same sequence. */
export function resetRandom(): void {
  next = SEED === null ? Math.random : mulberry32(SEED);
}
