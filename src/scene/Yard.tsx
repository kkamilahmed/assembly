import { useCallback } from 'react';
import { RoundedBox } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { useStore } from '@/state/store';
import { OUTFEED_PALLET, SLAB } from './layout';
import { Mover } from './Mover';
import {
  CartonStack,
  Cone,
  DrumPallet,
  Forklift,
  HandTruck,
  Pallet,
  PALLET_JACK_OPERATOR_X,
  PalletJack,
  Rack,
  Trolley,
  Truck,
  Worker,
  WORKER_WALK_SPEED,
} from './props';
import { glass, matte, metal, PALETTE, plastic } from './style';
import { font } from './ui3d/kit';
import { Panel } from './ui3d/Panel';

/** Trays of tablets that fill one shipper carton at the cartoner. */
const TRAYS_PER_SHIPPER = 4;
/** The outfeed pallet's layout: 2 x 2 per layer, 3 layers. */
const OUTFEED = { rows: 2, cols: 2, layers: 3 };
const OUTFEED_CAPACITY = OUTFEED.rows * OUTFEED.cols * OUTFEED.layers;

/** The pallet the cartoner's shippers land on fills one carton at a time
 *  as tablets pass, then starts again as if a full one was taken away. */
function OutfeedPallet() {
  const packed = useStore((s) => s.traysPacked);
  const cartons = Math.floor(packed / TRAYS_PER_SHIPPER);
  const count = cartons === 0 ? 0 : ((cartons - 1) % OUTFEED_CAPACITY) + 1;
  return <CartonStack position={[OUTFEED_PALLET.x, 0, OUTFEED_PALLET.z]} {...OUTFEED} count={count} seed={3} />;
}

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const STORE = { w: 3.8, d: 2.9, h: 2.75 } as const;

/**
 * Cold store for finished packs, held at 2-8 °C until they ship: an
 * insulated panel box with refrigeration units on the roof, a temperature
 * display, and a strip-curtain doorway on +z. Origin at the centre of its
 * footprint on the ground.
 */
function ColdStore(props: GroupProps) {
  const { w, d, h } = STORE;
  const panel = plastic(PALETTE.white, 0.4);
  const trim = metal(PALETTE.steel, 0.32);
  const dark = plastic(PALETTE.graphite, 0.45);
  const door = { w: 1.5, h: 2.15, x: 0.55 };
  const draw = useCallback((ctx: CanvasRenderingContext2D, cw: number, ch: number) => {
    ctx.fillStyle = PALETTE.graphite;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#7fd3ff';
    ctx.font = font(700, ch * 0.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('5.0°C', cw / 2, ch * 0.42);
    ctx.fillStyle = '#c9d2dc';
    ctx.font = font(600, ch * 0.18);
    ctx.fillText('COLD STORE 2-8°C', cw / 2, ch * 0.8);
  }, []);
  // Wall panels with joints, split around the doorway on the +z face.
  const joints = [-1.4, -0.47, 1.4];
  return (
    <group {...props}>
      <RoundedBox args={[w, 0.12, d]} radius={0.03} smoothness={2} position-y={0.06} material={dark} receiveShadow />
      <RoundedBox args={[w, h, d]} radius={0.08} smoothness={3} position-y={h / 2 + 0.06} material={panel} castShadow receiveShadow />
      <RoundedBox args={[w + 0.03, 0.12, d + 0.03]} radius={0.04} smoothness={2} position-y={h + 0.03} material={plastic(PALETTE.brand, 0.35)} castShadow />
      {joints.map((x) => (
        <mesh key={x} position={[x, h / 2 + 0.06, d / 2 + 0.004]} material={trim}>
          <boxGeometry args={[0.03, h - 0.2, 0.008]} />
        </mesh>
      ))}
      {[-0.7, 0, 0.7].map((z) => (
        <mesh key={z} position={[w / 2 + 0.004, h / 2 + 0.06, z]} material={trim}>
          <boxGeometry args={[0.008, h - 0.2, 0.03]} />
        </mesh>
      ))}
      {/* Doorway: a steel frame, the dark cold inside, and a curtain of
          clear PVC strips. */}
      <RoundedBox args={[door.w + 0.16, door.h + 0.08, 0.08]} radius={0.03} smoothness={2} position={[door.x, door.h / 2 + 0.06, d / 2 + 0.02]} material={trim} castShadow />
      <mesh position={[door.x, door.h / 2 + 0.06, d / 2 + 0.05]} material={matte('#2b3440', 0.6)}>
        <boxGeometry args={[door.w, door.h, 0.01]} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[door.x - door.w / 2 + 0.11 + i * 0.213, door.h / 2 + 0.03, d / 2 + 0.08]} rotation-y={(i % 2) * 0.08 - 0.04} material={glass()}>
          <boxGeometry args={[0.2, door.h - 0.06, 0.012]} />
        </mesh>
      ))}
      <Panel position={[-1.0, 1.7, d / 2]} width={0.9} height={0.5} depth={0.06} radius={0.06} standoff={0.01} color={PALETTE.graphite} lift={0.6} draw={draw} />
      {/* Refrigeration units on the roof, fans up. */}
      {[-0.95, 0.95].map((x) => (
        <group key={x} position={[x, h + 0.09, -0.2]}>
          <RoundedBox args={[1.3, 0.5, 1.1]} radius={0.06} smoothness={2} position-y={0.25} material={plastic(PALETTE.offWhite, 0.4)} castShadow receiveShadow />
          {[-0.3, 0.3].map((fx) => (
            <group key={fx}>
              <mesh position={[fx, 0.51, 0]} rotation-x={-Math.PI / 2} material={dark}>
                <circleGeometry args={[0.24, 24]} />
              </mesh>
              <mesh position={[fx, 0.515, 0]} rotation-x={-Math.PI / 2} material={trim}>
                <ringGeometry args={[0.22, 0.25, 24]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Everything outside, on the white floor one slab-thickness down: the
 *  cold store and racked stock, a forklift loading the store, pallet jacks,
 *  incoming drums and the refrigerated trucks backed up to the dock. */
export function Yard() {
  return (
    <group position-y={-SLAB.thickness}>
      {/* Raw materials and finished stock, screen upper right. */}
      <Rack position={[11.9, 0, -6.4]} bays={2} levels={3} color="blue" seed={4} />
      <ColdStore position={[12.2, 0, -3.0]} />
      <DrumPallet position={[9.6, 0, -6.8]} seed={2} />
      <DrumPallet position={[9.6, 0, -5.4]} count={3} seed={5} />
      <Pallet position={[9.6, 0, -3.9]} />

      {/* Forklift putting a pallet of finished packs into the cold store. */}
      <Forklift position={[12.75, 0, 0.9]} rotation-y={Math.PI / 2} load="cartons" lift={0.3} seed={2} />
      <Cone position={[10.2, 0, 1.4]} />
      <Cone position={[11.0, 0, 1.0]} />

      {/* Outfeed and dispatch. */}
      <OutfeedPallet />
      <CartonStack position={[11.6, 0, 4.2]} rows={2} cols={2} layers={3} seed={8} />
      {/* Shippers going out to the trucks. */}
      <Mover path={[[9.2, 11.2], [12.4, 11.2]]} speed={WORKER_WALK_SPEED * 0.8} offset={3} turn={false}>
        <PalletJack load="cartons" seed={4} />
        <Worker position={[PALLET_JACK_OPERATOR_X, 0, 0]} pose="walkPush" seed={6} skin={2} vest />
      </Mover>
      <HandTruck position={[9.4, 0, 8.4]} rotation-y={-0.4} cartons={3} />
      <Worker position={[9.7, 0, 7.2]} rotation-y={Math.PI * 0.5} pose="tablet" seed={11} skin={1} vest />

      {/* Refrigerated trucks, backed toward the dock (roller door at -x). */}
      <Truck position={[12.9, 0, 8.4]} />
      <Truck position={[16.6, 0, 4.2]} cabColor="#f4f5f7" />
      <Mover path={[[10.2, 2.65], [12.0, 2.65]]}>
        <Worker pose="walkCarry" carrying="box" seed={21} skin={3} vest />
      </Mover>

      {/* Foreground spill off the front of the slab, so the diorama does
          not float as a clean rectangle and the lower left of the frame
          has something in it. */}
      <CartonStack position={[-3.4, 0, 9.9]} rows={2} cols={2} layers={2} seed={12} />
      <CartonStack position={[-1.6, 0, 10.6]} rows={1} cols={2} layers={1} seed={13} />
      <HandTruck position={[-0.2, 0, 10.0]} rotation-y={-0.9} cartons={2} />
      <Mover path={[[2.6, 9.5], [0.7, 9.5]]} offset={1.5}>
        <Worker pose="walkCarry" carrying="box" seed={31} skin={1} vest />
      </Mover>
      <Cone position={[-5.4, 0, 9.4]} />
      <Cone position={[-4.8, 0, 10.4]} />
    </group>
  );
}

/** People and loose kit on the clean-room floor itself (slab top, y=0). */
export function Crew() {
  return (
    <group>
      {/* The coating drum's operator at its panel. */}
      <Worker position={[-2.55, 0, -3.1]} rotation-y={Math.PI / 2} pose="tablet" seed={5} skin={1} />
      <Trolley position={[-0.6, 0, -2.6]} rotation-y={0.3} fill={0.85} seed={4} />
      {/* A tray of samples on its way from the hold to the lab bench. */}
      <Mover path={[[-5.6, -1.4], [0.4, -1.4]]} offset={4}>
        <Worker pose="walkCarry" carrying="tray" seed={17} skin={0} />
      </Mover>
    </group>
  );
}
