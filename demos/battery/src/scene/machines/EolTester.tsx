import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { MODULE_INTERVAL_MS } from '@/streaming/lineConfig';
import { BELT_Y } from '../layout';
import { MODULE } from '../props/module';
import { glass, metal, PALETTE, plastic } from '../style';
import { Andon } from './Andon';
import { Kit, lens, useDispose } from './kit';
import type { Severity } from './kit';
import { Pieces, Screen } from './Pieces';

const LEN = 1.1;
const HZ = 0.82;
const TOP = 2.05;
/** Underside of the bridge the test head hangs from. */
const BRIDGE_Y = 1.72;
/** Test head rest height and its stroke down onto a cased module. */
const HEAD_Y = BELT_Y + MODULE.casedTop + 0.32;
const STROKE = 0.16;

/**
 * End-of-line tester, station 5: a bridge over the belt whose test head
 * drops a bed of spring pins onto each cased module's terminals (voltage,
 * insulation, internal resistance), with a thermal camera looking down.
 * Local frame: origin on the floor under the belt centreline, belt along +x
 * at BELT_Y. The operator screen faces -z; place it with rotation
 * y = -PI / 2 where the line runs toward world +z so the screen faces the
 * camera.
 *
 * `hot` is the thermal camera seeing a cell over its limit: the beacon on
 * the bridge flashes red and the head stays up.
 */
export function EolTester({
  running = true,
  hot = false,
  severity = 'healthy',
  ...props
}: { running?: boolean; hot?: boolean; severity?: Severity } & ThreeElements['group']) {
  const pieces = useMemo(() => {
    const k = new Kit();
    const steel = metal(PALETTE.steel);
    const bright = metal(PALETTE.offWhite, 0.18);
    const dark = plastic(PALETTE.graphite);
    const white = plastic(PALETTE.white);
    const orange = plastic(PALETTE.orange, 0.3);
    const blue = plastic(PALETTE.blue);

    // Two side cabinets and the bridge across the top.
    for (const sz of [1, -1]) {
      const z = sz * HZ;
      k.box(white, [LEN, TOP - 0.06, 0.34], [0, (TOP - 0.06) / 2 + 0.03, z], 0.06);
      k.box(dark, [LEN - 0.08, 0.06, 0.3], [0, 0.03, z], 0.015);
      k.box(orange, [LEN + 0.008, 0.06, 0.348], [0, TOP - 0.2, z], 0.02);
      for (let j = 0; j < 5; j++) k.box(dark, [0.4, 0.018, 0.012], [-0.2, 0.25 + j * 0.05, z + sz * 0.172], 0.005);
      k.box(dark, [0.03, 0.18, 0.03], [LEN / 2 - 0.12, 0.8, z + sz * 0.18], 0.01);
    }
    k.box(white, [LEN, TOP - BRIDGE_Y, HZ * 2 + 0.34], [0, (TOP + BRIDGE_Y) / 2, 0], 0.07);
    k.box(orange, [LEN + 0.008, 0.06, HZ * 2 + 0.348], [0, TOP - 0.2, 0], 0.02);
    // Head guide rods.
    for (const sx of [1, -1]) k.cyl(bright, 0.022, BRIDGE_Y - HEAD_Y + 0.1, [sx * 0.3, (BRIDGE_Y + HEAD_Y) / 2, 0], 'y', 0.006, 0.022, 10);
    // Thermal camera on the bridge, looking down through a port.
    k.box(dark, [0.18, 0.16, 0.2], [-0.32, TOP + 0.08, 0], 0.035);
    k.cyl(steel, 0.05, 0.08, [-0.32, TOP + 0.08, 0.13], 'z', 0.012);
    k.box(blue, [0.185, 0.03, 0.205], [-0.32, TOP + 0.13, 0], 0.01);
    // Glass guards between the cabinets on the screen side.
    for (const sx of [1, -1]) k.add(glass(), new THREE.PlaneGeometry(0.3, 0.6), [sx * (LEN / 2 - 0.15), BELT_Y + 0.5, -HZ + 0.17]);
    // Screen bezel on the -z cabinet.
    k.box(dark, [0.66, 0.44, 0.03], [0, 1.4, -HZ - 0.18], 0.025);
    return k.build();
  }, []);
  useDispose(pieces);

  const head = useMemo(() => {
    const k = new Kit();
    const dark = plastic(PALETTE.graphite);
    const bright = metal(PALETTE.offWhite, 0.18);
    k.box(plastic(PALETTE.blue), [0.7, 0.12, 0.5], [0, 0.06, 0], 0.03);
    k.box(dark, [0.62, 0.06, 0.44], [0, -0.03, 0], 0.02);
    // Spring pins over the two terminals and a row of sense pins.
    for (const sx of [1, -1]) for (const sz of [1, -1]) k.cyl(bright, 0.012, 0.09, [sx * (MODULE.l / 2 - 0.06), -0.1, sz * 0.04], 'y', 0.004, 0.012, 8);
    for (let i = 0; i < 6; i++) k.cyl(bright, 0.008, 0.07, [(i - 2.5) * 0.095, -0.09, 0.14], 'y', 0.003, 0.008, 8);
    return k.build();
  }, []);
  useDispose(head);

  const headRef = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const clock = useRef(0);
  const period = MODULE_INTERVAL_MS / 1000;
  useFrame(({ clock: c }, dt) => {
    if (running && !hot) clock.current += Math.min(dt, 0.1);
    const u = (clock.current / period) % 1;
    // Down, dwell on the terminals, back up while the next module arrives.
    const down = u < 0.2 ? u / 0.2 : u < 0.5 ? 1 : u < 0.7 ? 1 - (u - 0.5) / 0.2 : 0;
    if (headRef.current) headRef.current.position.y = HEAD_Y - STROKE * down * down * (3 - 2 * down);
    if (beaconRef.current) beaconRef.current.material = lens(PALETTE.critical, hot && c.elapsedTime % 0.5 < 0.3);
  });

  return (
    <group {...props}>
      <Pieces pieces={pieces} />
      <group ref={headRef} position-y={HEAD_Y}>
        <Pieces pieces={head} />
      </group>
      <Screen kind="tester" size={[0.58, 0.36]} position={[0, 1.4, -HZ - 0.197]} rotation={[0, Math.PI, 0]} />
      <mesh ref={beaconRef} position={[0.32, TOP + 0.07, 0]} material={lens(PALETTE.critical, false)}>
        <cylinderGeometry args={[0.07, 0.07, 0.14, 18]} />
      </mesh>
      <Andon severity={severity} position={[LEN / 2 - 0.12, TOP, -HZ]} />
    </group>
  );
}
