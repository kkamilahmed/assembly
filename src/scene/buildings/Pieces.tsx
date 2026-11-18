import type { ThreeElements } from '@react-three/fiber';
import type { Piece, ScreenKind, V3 } from './kit';
import { screenMaterial } from './kit';

/** Renders merged building pieces. Self-lit and see-through pieces do not
 *  cast shadows. */
export function Pieces({ pieces }: { pieces: Piece[] }) {
  return (
    <>
      {pieces.map((p, i) => {
        const solid = p.material.toneMapped && !p.material.transparent;
        return <mesh key={i} geometry={p.geometry} material={p.material} castShadow={solid} receiveShadow={solid} />;
      })}
    </>
  );
}

/** The lit face of a display, `w` x `h`, facing local +z. The bezel is
 *  modelled by the building that owns it. */
export function Screen({
  kind,
  size,
  position,
  rotation,
}: {
  kind: ScreenKind;
  size: [number, number];
  position: V3;
  rotation?: ThreeElements['mesh']['rotation'];
}) {
  return (
    <mesh position={position} rotation={rotation} material={screenMaterial(kind)}>
      <planeGeometry args={size} />
    </mesh>
  );
}
