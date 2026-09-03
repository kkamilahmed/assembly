import { forwardRef, useImperativeHandle, useState, type ReactNode } from 'react';

/** A stack/rack of N identical items that depletes by one per pick and
 *  refills when empty — shared by the Panel station's shell rack and the
 *  Wheel station's tyre stack so the two don't get two bespoke impls.
 *  Purely visual component state; nothing outside the owning RobotArm needs
 *  to know the count, per the plan. */
export interface PropStackHandle {
  /** Decrement the top `n` items at once (grip) — one atomic state update,
   *  so a machine that grabs a pair in a single motion doesn't lose one
   *  decrement to React batching two separate calls into one re-render. A
   *  single-item pick (the default, n=1) keeps auto-refilling the instant
   *  it empties the rack, as before — imperceptible at one-per-dwell. A
   *  multi-item pick instead floors at 0 and stays there: auto-refilling a
   *  whole pair the moment they're grabbed would flash duplicates in right
   *  next to the gripper still holding the originals. Call `refill()`
   *  once the caller's ready to show it restocked. */
  pick: (n?: number) => void;
  /** Reset to full. For a multi-item picker (pick(n>1), which doesn't
   *  auto-refill) — call once the grabbed items have visibly moved on. */
  refill: () => void;
}

export interface PropStackProps {
  /** Robot-ground-local position of the stack's base. */
  position: [number, number, number];
  /** How many items sit on the rack at full. */
  count: number;
  /** Local offset of item `index` (0..count-1) from the stack's base position
   *  — vertical stacking for flat slabs, a spread row for an upright rack. */
  itemOffset: (index: number) => [number, number, number];
  /** Render one item, given its index from the bottom/start (0..count-1). */
  renderItem: (index: number) => ReactNode;
  /** Optional A-frame / stand under the stack. */
  stand?: ReactNode;
}

export const PropStack = forwardRef<PropStackHandle, PropStackProps>(function PropStack(
  { position, count, itemOffset, renderItem, stand },
  ref,
) {
  const [remaining, setRemaining] = useState(count);
  useImperativeHandle(ref, () => ({
    pick: (n = 1) => {
      setRemaining((r) => {
        const next = r - n;
        if (next > 0) return next;
        // Emptied (or would go negative): a single-item pick auto-refills
        // immediately, as before. A multi-item pick floors at 0 instead —
        // see the handle doc for why — and waits for an explicit refill().
        return n === 1 ? count : 0;
      });
    },
    refill: () => setRemaining(count),
  }), [count]);

  return (
    <group position={position}>
      {stand}
      {Array.from({ length: remaining }).map((_, i) => (
        <group key={i} position={itemOffset(i)}>
          {renderItem(i)}
        </group>
      ))}
    </group>
  );
});

/** A simple stylized raw body-shell slab for the Panel rack. */
export function ShellSlab({ color = '#b9b9bd' }: { color?: string }) {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[1.4, 0.45, 0.9]} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
    </mesh>
  );
}

/** A simple two-post rack frame with a top rail, sized to span a row of
 *  upright tyres resting against it. */
export function RackFrame({ width, height }: { width: number; height: number }) {
  const postX = width / 2 - 0.08;
  return (
    <group>
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.08, 0.5]} />
        <meshStandardMaterial color="#4a4e55" metalness={0.4} roughness={0.6} />
      </mesh>
      {[-postX, postX].map((x) => (
        <mesh key={x} position={[x, height / 2, -0.18]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, height, 8]} />
          <meshStandardMaterial color="#3a3d43" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, height, -0.18]} castShadow>
        <boxGeometry args={[width, 0.05, 0.05]} />
        <meshStandardMaterial color="#3a3d43" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}