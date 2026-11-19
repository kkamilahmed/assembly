// Where the two back walls stand, shared by the diorama (which builds them)
// and the dashboard (which hangs cards on them).
import { SLAB, WALL } from '@/scene/layout';

/** The walls stand this far in from the slab's outer edge. */
export const WALL_INSET = 0.125;
/** Inner (room-side) face of the wall on the -x edge. It faces +x. */
export const WALL_FACE_X = SLAB.minX + WALL_INSET + WALL.thickness;
/** Inner (room-side) face of the wall on the -z edge. It faces +z. */
export const WALL_FACE_Z = SLAB.minZ + WALL_INSET + WALL.thickness;
/** The open ends of the walls stop short of the slab's front edges. */
export const WALL_X_END_Z = SLAB.maxZ - 0.9;
export const WALL_Z_END_X = SLAB.maxX - 0.9;
