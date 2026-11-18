// The processing hub: where every payment in the city is scored before it
// is approved. The four lanes come in through the front, pass under the
// scanner arch, and run on to the vault; blocked payments are pulled off
// into the quarantine tray. Analysts work the desks around them.
import { RoundedBox } from '@react-three/drei';
import { Desk, WallScreen } from '@/scene/props/extra';
import { Mover } from '../Mover';
import { Person, WALK_SPEED } from '@/scene/props';
import { HUB, QUARANTINE, SCANNER } from '../layout';
import { glass, matte, metal, PALETTE, plastic } from '../style';
import { WALL_FACE_Z } from '../ui3d/wallFrame';

/** The hub's floor and partitions. Lanes cross the front between the
 *  scanner posts and leave through the west side. */
function HubShell() {
  const floor = matte('#e4e7eb', 0.42);
  const sill = plastic(PALETTE.wallTrim, 0.35);
  const rail = metal(PALETTE.steelDark, 0.35);
  const run = (a: [number, number], b: [number, number]) => {
    const along = Math.abs(b[0] - a[0]) > 0.01 ? 'x' : 'z';
    const len = Math.abs(along === 'x' ? b[0] - a[0] : b[1] - a[1]);
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const size = (h: number, d: number): [number, number, number] => (along === 'x' ? [len, h, d] : [d, h, len]);
    return (
      <group key={`${a}-${b}`}>
        <RoundedBox args={size(0.32, 0.12)} radius={0.03} smoothness={2} position={[mid[0], 0.16, mid[1]]} material={sill} castShadow receiveShadow />
        <mesh position={[mid[0], 0.72, mid[1]]} material={glass()}>
          <boxGeometry args={size(0.8, 0.03)} />
        </mesh>
        <RoundedBox args={size(0.05, 0.07)} radius={0.02} smoothness={2} position={[mid[0], 1.14, mid[1]]} material={rail} castShadow />
      </group>
    );
  };
  const zf = HUB.z1 - 0.06;
  const xr = HUB.x1 - 0.06;
  const xl = HUB.x0 + 0.06;
  return (
    <group>
      <RoundedBox
        args={[HUB.x1 - HUB.x0, 0.04, HUB.z1 - WALL_FACE_Z]}
        radius={0.015}
        smoothness={2}
        position={[(HUB.x0 + HUB.x1) / 2, 0.02, (WALL_FACE_Z + HUB.z1) / 2]}
        material={floor}
        receiveShadow
      />
      {/* Front: glass either side of the lane opening and the door. */}
      {run([HUB.x0, zf], [SCANNER.x0 - 0.15, zf])}
      {run([SCANNER.x1 + 0.15, zf], [-0.75, zf])}
      {/* East side, with a door at the front corner. */}
      {run([xr, zf - 0.9], [xr, WALL_FACE_Z + 0.05])}
      {/* West side: glass, with the four lanes leaving underneath it. */}
      {run([xl, zf], [xl, -2.55])}
      {run([xl, -5.2], [xl, WALL_FACE_Z + 0.05])}
      <RoundedBox args={[0.12, 0.3, 2.65]} radius={0.03} smoothness={2} position={[xl, 1.0, -3.875]} material={sill} castShadow receiveShadow />
    </group>
  );
}

/** The scanner arch the lanes run under. Its lit beam belongs to Live. */
function ScannerFrame() {
  const steel = metal(PALETTE.steelDark, 0.32);
  const housing = plastic(PALETTE.graphite, 0.35);
  const w = SCANNER.x1 - SCANNER.x0;
  return (
    <group position-z={SCANNER.z}>
      {[SCANNER.x0, SCANNER.x1].map((x) => (
        <group key={x} position-x={x}>
          <RoundedBox args={[0.24, SCANNER.beamY + 0.25, 0.32]} radius={0.06} smoothness={3} position-y={(SCANNER.beamY + 0.25) / 2} material={housing} castShadow receiveShadow />
          <RoundedBox args={[0.34, 0.06, 0.42]} radius={0.02} smoothness={2} position-y={0.03} material={steel} castShadow />
        </group>
      ))}
      <RoundedBox args={[w + 0.24, 0.26, 0.4]} radius={0.08} smoothness={3} position={[(SCANNER.x0 + SCANNER.x1) / 2, SCANNER.beamY + 0.13, 0]} material={housing} castShadow receiveShadow />
    </group>
  );
}

/** The quarantine tray: a red-rimmed bin the blocked payments drop into.
 *  The pile in it belongs to Live. */
function QuarantineTray() {
  return (
    <group position={[QUARANTINE.x, 0, QUARANTINE.z]}>
      <RoundedBox args={[1.0, 0.36, 0.66]} radius={0.06} smoothness={3} position-y={0.18} material={plastic(PALETTE.graphite, 0.4)} castShadow receiveShadow />
      <RoundedBox args={[1.04, 0.06, 0.7]} radius={0.03} smoothness={2} position-y={0.37} material={plastic(PALETTE.critical, 0.4)} castShadow />
      <RoundedBox args={[0.9, 0.02, 0.56]} radius={0.01} smoothness={2} position-y={0.33} material={matte('#1a1c20', 0.8)} />
    </group>
  );
}

/** Analysts and their desks: a row along the back wall facing the big
 *  screens, and a column on the east side facing the lanes. */
function Floor({ people }: { people: boolean }) {
  const back: Array<[number, 'feed' | 'chart' | 'scores' | 'map']> = [
    [-6.0, 'feed'],
    [-3.9, 'scores'],
    [-1.8, 'map'],
  ];
  return (
    <group>
      {back.map(([x, kind], i) => (
        <group key={x}>
          <Desk position={[x, 0, -6.1]} rotation-y={Math.PI / 2} screens={[kind, 'feed']} />
          <WallScreen position={[x, 3.1, WALL_FACE_Z]} size={[1.9, 1.07]} kind={i === 1 ? 'chart' : kind === 'map' ? 'map' : 'feed'} />
          {people && <Person position={[x, 0, -6.1]} rotation-y={Math.PI / 2} pose="sit" outfit="analyst" seed={80 + i * 7} skin={i % 4} />}
        </group>
      ))}
      {[-2.55, -4.5].map((z, i) => (
        <group key={z}>
          <Desk position={[-0.85, 0, z]} rotation-y={Math.PI} screens={i ? ['scores', 'feed'] : ['feed', 'chart']} />
          {people && <Person position={[-0.85, 0, z]} rotation-y={Math.PI} pose="sit" outfit="analyst" seed={101 + i * 5} skin={(i + 2) % 4} />}
        </group>
      ))}
      {people && (
        <>
          {/* The shift lead, between the desks, eyes on the wall. */}
          <Person position={[-2.9, 0, -5.55]} rotation-y={Math.PI / 2} pose="tablet" outfit="analyst" seed={117} skin={1} />
          {/* Up and down the east aisle with a coffee. */}
          <Mover path={[[0.13, -1.95], [0.13, -6.5]]} speed={WALK_SPEED * 0.8} offset={1}>
            <Person pose="walkCarry" carrying="coffee" outfit="analyst" seed={123} skin={3} />
          </Mover>
        </>
      )}
    </group>
  );
}

export function Hub({ people = true }: { people?: boolean }) {
  return (
    <group>
      <HubShell />
      <ScannerFrame />
      <QuarantineTray />
      <Floor people={people} />
    </group>
  );
}
