import { Html } from '@react-three/drei';
import { useStore } from '@/state/store';
import { REWORK_BAY_SLOTS } from '@/streaming/lineConfig';
import { STATUS_HEX } from '@/ui/colors';
import { CAR_LENGTH, CAR_WIDTH, COLORS, CONVEYOR_Y, REWORK_BAY_Z, reworkBayX } from './constants';

const PAD_LENGTH = CAR_LENGTH + 0.3;
const PAD_WIDTH = CAR_WIDTH + 0.6;
const STRIPE = 0.12;

/** The raised rework platform rejected cars are pulled onto, in front of the
 *  line. Empty, it is a clearly marked spare area; filling up, it is the
 *  cost of the deviation in a form nobody has to read a number to see. */
export function ReworkBay() {
  const scrapped = useStore((s) => s.carsScrapped);
  const first = reworkBayX(0);
  const last = reworkBayX(REWORK_BAY_SLOTS - 1);
  const zoneLength = last - first + PAD_LENGTH + 0.8;
  const zoneX = (first + last) / 2;

  return (
    <group>
      {/* Floor zone: a red hatched outline, the way a real reject area is
          marked out on a plant floor. */}
      <mesh position={[zoneX, 0.012, REWORK_BAY_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[zoneLength, PAD_WIDTH + 0.8]} />
        <meshStandardMaterial color="#8e3a33" roughness={0.9} transparent opacity={0.22} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`l${side}`} position={[zoneX, 0.016, REWORK_BAY_Z + side * (PAD_WIDTH / 2 + 0.4)]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[zoneLength, STRIPE]} />
          <meshStandardMaterial color={COLORS.critical} roughness={0.7} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`e${side}`} position={[zoneX + side * (zoneLength / 2), 0.016, REWORK_BAY_Z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[STRIPE, PAD_WIDTH + 0.8 + STRIPE]} />
          <meshStandardMaterial color={COLORS.critical} roughness={0.7} />
        </mesh>
      ))}

      {/* One raised stand per slot, at belt height so a car glides across
          from the line without dropping. */}
      {Array.from({ length: REWORK_BAY_SLOTS }, (_, slot) => (
        <group key={slot} position={[reworkBayX(slot), 0, REWORK_BAY_Z]}>
          {/* Two trestles carrying a deck, rather than a solid block: an
              empty stand should read as a stand, not as a slab of floor. */}
          {[-1, 1].map((end) => (
            <mesh key={end} position={[end * (PAD_LENGTH / 2 - 0.7), (CONVEYOR_Y - 0.06) / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.18, CONVEYOR_Y - 0.06, PAD_WIDTH - 1.0]} />
              <meshStandardMaterial color={COLORS.safetyYellow} metalness={0.2} roughness={0.55} />
            </mesh>
          ))}
          <mesh position={[0, CONVEYOR_Y - 0.03, 0]} castShadow receiveShadow>
            <boxGeometry args={[PAD_LENGTH - 0.8, 0.06, PAD_WIDTH - 1.0]} />
            <meshStandardMaterial color={COLORS.belt} metalness={0.25} roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Painted on the floor in front of the stands, so it never sits on
          top of a parked car. */}
      <Html
        position={[zoneX, 0.05, REWORK_BAY_Z + PAD_WIDTH / 2 + 1.1]}
        center
        distanceFactor={19}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        zIndexRange={[10, 0]}
      >
        <div
          className="flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] font-bold uppercase tracking-wide text-white shadow"
          style={{ backgroundColor: STATUS_HEX.critical }}
        >
          Rework bay
          <span className="font-mono-ui rounded bg-white/25 px-1.5 text-[12px]">{scrapped}</span>
        </div>
      </Html>
    </group>
  );
}

