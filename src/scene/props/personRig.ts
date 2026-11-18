// Numbers the scene owner needs to place and move people.

/** Step frequency of the walk cycle, rad/s. */
export const WALK_RATE = 5.6;
/** Half the length of one step, m. */
export const WALK_STRIDE = 0.21;
/** People are drawn a touch larger than life, the way the references draw
 *  people: at the overview zoom they are the storytellers. */
export const PERSON_SCALE = 1.28;
/** Ground speed that keeps a walking person's feet from sliding, m/s. The
 *  person walks on the spot; move its group forward at this speed. */
export const WALK_SPEED = WALK_STRIDE * WALK_RATE * PERSON_SCALE;
/** How far ahead of a 'push' person's origin the hands grip, and how high. */
export const PUSH_GRIP = { x: 0.43, y: 1.12 } as const;
