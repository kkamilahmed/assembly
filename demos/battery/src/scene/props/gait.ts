import { createContext, useContext } from 'react';

/** How a walking worker's legs should move right now: 1 forwards, -1
 *  backwards (pulling a load back), 0 standing. Written every frame by
 *  whatever moves the worker's group (the scene's Mover), read every frame by
 *  the worker; a ref so neither re-renders. */
export interface Gait {
  /** `outbound` is true from leaving the start of the route until leaving
   *  its far end: what an AGV uses to know whether it is carrying. */
  current: { dir: -1 | 0 | 1; outbound: boolean };
}

const ALWAYS_FORWARD: Gait = { current: { dir: 1, outbound: true } };

export const GaitContext = createContext<Gait>(ALWAYS_FORWARD);

export function useGait(): Gait {
  return useContext(GaitContext);
}
