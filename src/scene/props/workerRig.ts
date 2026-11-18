// Numbers the scene owner needs to place and move workers.

/** Step frequency of the walk cycle, rad/s. */
export const WALK_RATE = 5.6;
/** Half the length of one step, m. */
export const WALK_STRIDE = 0.21;
/** Ground speed that keeps a 'walk' worker's feet from sliding, m/s. The
 *  worker walks on the spot; move its group forward at this speed. */
export const WORKER_WALK_SPEED = WALK_STRIDE * WALK_RATE;
/** How far ahead of a 'push' worker's origin the hands grip, and how high. */
export const WORKER_PUSH_GRIP = { x: 0.43, y: 1.12 } as const;
