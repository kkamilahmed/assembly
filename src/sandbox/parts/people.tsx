// Every pose and outfit side by side, for judging the figures up close.
import { Bench } from '@/scene/props/extra';
import { Person, type Carrying, type Outfit, type PersonPose } from '@/scene/props';

const CAST: Array<{ pose: PersonPose; outfit: Outfit; carrying?: Carrying; vest?: boolean }> = [
  { pose: 'stand', outfit: 'guard' },
  { pose: 'tablet', outfit: 'analyst' },
  { pose: 'tablet', outfit: 'casual', carrying: 'phone' },
  { pose: 'walk', outfit: 'casual', carrying: 'bags' },
  { pose: 'walkCarry', outfit: 'analyst', carrying: 'coffee' },
  { pose: 'walkCarry', outfit: 'analyst', carrying: 'laptop' },
  { pose: 'walkCarry', outfit: 'casual', carrying: 'basket' },
  { pose: 'inspect', outfit: 'barista' },
  { pose: 'walkPush', outfit: 'courier' },
  { pose: 'inspect', outfit: 'packer', vest: true },
  { pose: 'sit', outfit: 'analyst' },
  { pose: 'sitSip', outfit: 'casual' },
];

export const view = { target: [0, 0.85, 0] as [number, number, number], zoom: 160 };

export default function People() {
  return (
    <group>
      {CAST.map((c, i) => {
        const pos: [number, number, number] = [(i - 6) * 0.6, 0, -(i - 6) * 0.6];
        return (
          <group key={i} position={pos} rotation-y={-Math.PI / 4 + 0.5}>
            {(c.pose === 'sit' || c.pose === 'sitSip') && <Bench />}
            <Person pose={c.pose} outfit={c.outfit} carrying={c.carrying} vest={c.vest} skin={i % 4} seed={i + 1} />
          </group>
        );
      })}
    </group>
  );
}
