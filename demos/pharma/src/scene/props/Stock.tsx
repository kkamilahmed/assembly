// Palletised stock: pallets, taped Meridian shipper cartons and fibre drums
// of powder.
// Origins are at the footprint centre on the ground; the long side is on x.
import { useMemo } from 'react';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { matte, metal, PALETTE, plastic } from '@/scene/style';
import { studioWhite } from './kit';
import { Instances, Part } from './Part';
import {
  at,
  CARTON_SIZE,
  cartonGeometries,
  cartonStackMatrices,
  type CartonStackOpts,
  PALLET,
  palletGeometry,
  drumGeometries,
  drumPalletMatrices,
  type DrumPalletOpts,
} from './stockLayout';

type GroupProps = Omit<ThreeElements['group'], 'children'>;

const wood = () => matte(PALETTE.palletWood, 0.78);
const cardboard = () => matte(PALETTE.cardboard, 0.82);
const tape = () => matte(PALETTE.tape, 0.45);
const LABEL = studioWhite(PALETTE.white, 0.7);

/** Wooden pallet, 1.2 x 0.144 x 1.0. */
export function Pallet(props: GroupProps) {
  return (
    <group {...props}>
      <Part g={palletGeometry()} m={wood()} />
    </group>
  );
}

/** Any number of pallets in one draw call. */
export function PalletInstances({ matrices }: { matrices: THREE.Matrix4[] }) {
  return <Instances g={palletGeometry()} m={wood()} matrices={matrices} />;
}

/** One cardboard box with a tape strip and labels. Origin at the centre of
 *  its base. */
export function Carton({ size = CARTON_SIZE, ...props }: GroupProps & { size?: [number, number, number] }) {
  const geo = cartonGeometries(size);
  return (
    <group {...props}>
      <group position-y={size[1] / 2}>
        <Part g={geo.body} m={cardboard()} />
        <Part g={geo.tape} m={tape()} castShadow={false} />
        <Part g={geo.faces} m={geo.faceMaterial} castShadow={false} />
      </group>
    </group>
  );
}

/** Many cartons of one size in three draw calls. Each matrix places a
 *  carton by the centre of its box. */
export function CartonInstances({ matrices, size = CARTON_SIZE }: { matrices: THREE.Matrix4[]; size?: [number, number, number] }) {
  const geo = cartonGeometries(size);
  return (
    <>
      <Instances g={geo.body} m={cardboard()} matrices={matrices} />
      <Instances g={geo.tape} m={tape()} matrices={matrices} shadows={false} />
      <Instances g={geo.faces} m={geo.faceMaterial} matrices={matrices} shadows={false} />
    </>
  );
}

/** Many drums in three draw calls. */
export function DrumInstances({ matrices }: { matrices: THREE.Matrix4[] }) {
  const geo = drumGeometries();
  return (
    <>
      <Instances g={geo.body} m={plastic(PALETTE.drum, 0.45)} matrices={matrices} />
      <Instances g={geo.ring} m={metal(PALETTE.steel, 0.3)} matrices={matrices} shadows={false} />
      <Instances g={geo.label} m={plastic(LABEL, 0.6)} matrices={matrices} shadows={false} />
    </>
  );
}

/** Cartons stacked rows (z) x cols (x) x layers on a pallet. `count` shows
 *  only the first N cartons, so a pallet can fill up one box at a time. */
export function CartonStack({
  rows = 2,
  cols = 2,
  layers = 3,
  count,
  size = CARTON_SIZE,
  seed = 1,
  jitter = 0.012,
  pallet = true,
  ...props
}: GroupProps & CartonStackOpts & { pallet?: boolean }) {
  const [w, h, d] = size;
  const matrices = useMemo(
    () => cartonStackMatrices({ rows, cols, layers, count, size: [w, h, d], seed, jitter }, at(0, pallet ? PALLET.h : 0, 0), []),
    [rows, cols, layers, count, w, h, d, seed, jitter, pallet],
  );
  return (
    <group {...props}>
      {pallet && <Part g={palletGeometry()} m={wood()} />}
      <CartonInstances matrices={matrices} size={size} />
    </group>
  );
}

/** Blue fibre drums of powder, four to a pallet. */
export function DrumPallet({ count, seed = 1, pallet = true, ...props }: GroupProps & DrumPalletOpts & { pallet?: boolean }) {
  const matrices = useMemo(() => drumPalletMatrices({ count, seed }, at(0, pallet ? PALLET.h : 0, 0), []), [count, seed, pallet]);
  return (
    <group {...props}>
      {pallet && <Part g={palletGeometry()} m={wood()} />}
      <DrumInstances matrices={matrices} />
    </group>
  );
}
