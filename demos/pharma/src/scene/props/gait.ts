import { createContext, useContext } from 'react';

/** How a walking worker's legs should move right now: 1 forwards, -1
 *  backwards (pulling a load back), 0 standing. Written every frame by
 *  whatever moves the worker's group (the scene's Mover), read every frame by
 *  the worker; a ref so neither re-renders. */
export interface Gait {
  current: { dir: -1 | 0 | 1 };
}

const ALWAYS_FORWARD: Gait = { current: { dir: 1 } };

export const GaitContext = createContext<Gait>(ALWAYS_FORWARD);

export function useGait(): Gait {
  return useContext(GaitContext);
}
