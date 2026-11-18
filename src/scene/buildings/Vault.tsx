// Northgate Bank: the vault every approved payment settles into. A stone
// building in the back corner with a columned front, a great round vault
// door, and the slot the four lanes run into.
import { RoundedBox } from '@react-three/drei';
import { Person } from '@/scene/props';
import { VAULT } from '../layout';
import { glow, matte, metal, PALETTE, plastic } from '../style';
import { Sign } from './Sign';
import { WALL_FACE_X, WALL_FACE_Z } from '../ui3d/wallFrame';

const H = 3.6;

function drawColumns(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.moveTo(-0.45 * s, -0.18 * s);
  ctx.lineTo(0, -0.42 * s);
  ctx.lineTo(0.45 * s, -0.18 * s);
  ctx.closePath();
  ctx.fill();
  for (const dx of [-0.3, -0.1, 0.1, 0.3]) ctx.fillRect((dx - 0.05) * s, -0.12 * s, 0.1 * s, 0.42 * s);
  ctx.fillRect(-0.45 * s, 0.32 * s, 0.9 * s, 0.08 * s);
  ctx.restore();
}

/** The round vault door, facing +x, centred on its hinge-side origin. */
function VaultDoor() {
  const steel = metal('#b9c0c9', 0.22);
  const dark = metal(PALETTE.steelDark, 0.35);
  return (
    <group rotation-z={-Math.PI / 2}>
      <mesh material={metal(PALETTE.graphite, 0.4)} castShadow receiveShadow>
        <cylinderGeometry args={[1.12, 1.12, 0.1, 48]} />
      </mesh>
      <mesh position-y={0.1} material={steel} castShadow receiveShadow>
        <cylinderGeometry args={[0.98, 1.0, 0.14, 48]} />
      </mesh>
      <mesh position-y={0.19} material={dark} castShadow>
        <cylinderGeometry args={[0.62, 0.66, 0.06, 40]} />
      </mesh>
      {/* Locking bolts round the rim. */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.86, 0.19, Math.sin(a) * 0.86]} material={dark}>
            <cylinderGeometry args={[0.05, 0.05, 0.05, 12]} />
          </mesh>
        );
      })}
      {/* Spoked wheel. */}
      <mesh position-y={0.3} material={dark} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.16, 20]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <RoundedBox key={i} args={[0.95, 0.06, 0.06]} radius={0.025} smoothness={2} position-y={0.36} rotation-y={(i / 3) * Math.PI} material={steel} castShadow />
      ))}
    </group>
  );
}

export function Vault({ people = true }: { people?: boolean }) {
  const stone = plastic(PALETTE.stone, 0.5);
  const trim = plastic('#d8d1c4', 0.45);
  const x0 = WALL_FACE_X;
  const z0 = WALL_FACE_Z;
  const w = VAULT.x1 - x0;
  const d = VAULT.z1 - z0;
  const cx = (x0 + VAULT.x1) / 2;
  const cz = (z0 + VAULT.z1) / 2;
  return (
    <group>
      {/* The block itself, a plinth and a cornice. */}
      <RoundedBox args={[w + 0.2, 0.28, d + 0.2]} radius={0.05} smoothness={2} position={[cx, 0.14, cz]} material={trim} castShadow receiveShadow />
      <RoundedBox args={[w, H, d]} radius={0.08} smoothness={3} position={[cx, H / 2, cz]} material={stone} castShadow receiveShadow />
      <RoundedBox args={[w + 0.24, 0.24, d + 0.24]} radius={0.06} smoothness={2} position={[cx, H + 0.1, cz]} material={trim} castShadow receiveShadow />

      {/* Columned front facing the avenue. */}
      {[-10.9, -10.15, -9.4, -8.65].map((x) => (
        <group key={x} position={[x, 0, VAULT.z1 + 0.32]}>
          <mesh position-y={1.7} material={plastic('#f4f1ea', 0.45)} castShadow receiveShadow>
            <cylinderGeometry args={[0.16, 0.18, 3.1, 20]} />
          </mesh>
          <RoundedBox args={[0.44, 0.14, 0.44]} radius={0.03} smoothness={2} position-y={0.35} material={trim} castShadow />
          <RoundedBox args={[0.44, 0.14, 0.44]} radius={0.03} smoothness={2} position-y={3.22} material={trim} castShadow />
        </group>
      ))}
      <RoundedBox args={[w - 0.2, 0.3, 0.7]} radius={0.05} smoothness={2} position={[cx, 3.42, VAULT.z1 + 0.25]} material={trim} castShadow receiveShadow />
      <Sign position={[cx, 2.55, VAULT.z1 + 0.01]} width={2.6} height={0.6} text="Northgate Bank" color="#2f3a4d" ink={PALETTE.gold} mark={drawColumns} />
      <RoundedBox args={[1.1, 1.9, 0.06]} radius={0.04} smoothness={2} position={[-9.78, 1.2, VAULT.z1 + 0.02]} material={plastic('#2f3a4d', 0.35)} />

      {/* The settlement slot the lanes run into, and the vault door over it. */}
      <RoundedBox args={[0.1, 0.7, 2.95]} radius={0.03} smoothness={2} position={[VAULT.x1 + 0.02, 0.35, -3.875]} material={matte('#141619', 0.8)} />
      <mesh position={[VAULT.x1 + 0.08, 0.72, -3.875]} material={glow(PALETTE.gold, 1.3)}>
        <boxGeometry args={[0.04, 0.05, 2.95]} />
      </mesh>
      <group position={[VAULT.x1 + 0.02, 2.05, -3.9]}>
        <VaultDoor />
      </group>

      {people && <Person position={[-8.05, 0, -1.15]} rotation-y={-Math.PI * 0.35} pose="stand" outfit="guard" seed={131} skin={3} />}
    </group>
  );
}
