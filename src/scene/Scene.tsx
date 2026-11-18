import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { CameraRig } from '@/camera/CameraRig';
import { ROBOT_IDS } from '@/streaming/lineConfig';
import { COLORS, LINE_END_X, LINE_START_X } from './constants';
import { Backdrop } from './Backdrop';
import { CarPool } from './CarPool';
import { Conveyor } from './Conveyor';
import { FactoryStructure } from './FactoryStructure';
import { Floor } from './Floor';
import { Lighting } from './Lighting';
import { PostFX } from './PostFX';
import { ReworkBay } from './ReworkBay';
import { RobotArm } from './RobotArm';
import { StationAlert } from './StationAlert';
import { WHEEL_ORDER } from './stationTargets';

export function Scene({ active }: { active: boolean }) {
  return (
    <Canvas
      // Stops rendering while the machines screen is showing; the line keeps
      // running underneath (its clock is wall time), so nothing is lost.
      frameloop={active ? 'always' : 'never'}
      shadows
      dpr={[1, 2]}
      // Tone mapping happens once, in PostFX's <ToneMapping> effect - leaving
      // ACESFilmicToneMapping here too meant the renderer applied the ACES
      // curve, then the post-processing chain applied it again on top,
      // double-compressing everything toward the highlight rolloff. That's
      // what was reading as the whole scene washed pale regardless of any
      // material's actual albedo.
      gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
      // near=0.1 against far=100 is a 1000:1 ratio, which starves the depth
      // buffer of precision for anything more than a few metres out - the
      // cause of the z-fighting/aliasing "glitch" seen on the conveyor belt
      // partway down the line. Nothing in this scene is ever framed closer
      // than a few metres (camera/waypoints.ts's closest shot; OrbitControls'
      // minDistance=6 after handoff), so raising the near plane costs nothing
      // visually while meaningfully improving precision everywhere.
      camera={{ fov: 42, near: 0.5, far: 100 }}
      onCreated={({ gl }) => {
        if (import.meta.env.DEV) Object.assign(window, { __gl: gl });
      }}
    >
      {/* Cool industrial grey, matching the wall's upper-band color
          (constants.ts COLORS.backdrop) so any sliver of background that
          peeks past a wall's edge reads as more of the same wall, not a
          seam. Fog used to sit here too, doing double duty hiding
          unfinished edges - the belt's spawn/exit ends, the floor's open
          +Z side - that are now real, properly-anchored geometry instead
          (Conveyor.tsx, Floor.tsx, Backdrop.tsx), so it's gone rather than
          left tinting everything for no remaining reason. */}
      <color attach="background" args={[COLORS.backdrop]} />

      <Lighting />
      <Floor />
      <Backdrop />
      <FactoryStructure />
      <Conveyor />
      {ROBOT_IDS.flatMap((id) =>
        // The Wheel station is four machines, one per wheel, each mounting
        // just its own corner in parallel - every other station is still a
        // single arm with no wheelCorner.
        id === 'WHEEL-01'
          ? WHEEL_ORDER.map((wheelCorner) => (
              <RobotArm key={`${id}-${wheelCorner}`} robotId={id} wheelCorner={wheelCorner} />
            ))
          : [<RobotArm key={id} robotId={id} />],
      )}
      <CarPool />
      <ReworkBay />
      <StationAlert />

      {/* Soft contact shadows grounding every object on the floor - the
          single biggest cue that a 3D scene is "sitting in a room" rather
          than floating. Rendered below the real shadow-casting lights so
          we get both crisp directional shadows and a soft ambient blob. */}
      <ContactShadows
        position={[(LINE_START_X + LINE_END_X) / 2, 0.02, 0]}
        scale={Math.max(26, (LINE_END_X - LINE_START_X) + 16)}
        blur={2.4}
        far={8}
        resolution={1024}
        opacity={0.55}
        color="#1a1d24"
      />

      {/* A real HDRI (drei's "studio" preset - a neutral, cool-white softbox
          rig) instead of a synthetic Lightformer rig or "warehouse" (which
          skews warm/amber). This is what puts sharp, defined highlight
          bands on the glossy yellow robot arms - real reflected panel
          geometry, not a flat gray/white glow - matching the crisp,
          high-key look of real body-shop line photography. Background
          stays off so the studio backdrop above is what's actually seen;
          the HDRI only feeds reflections and ambient fill. */}
      <Environment preset="studio" background={false} environmentIntensity={0.35} />

      <CameraRig />
      <PostFX />
    </Canvas>
  );
}
