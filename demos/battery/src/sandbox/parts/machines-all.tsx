import { useEffect, useState } from 'react';
import { CellSorter } from '@/scene/machines/CellSorter';
import { Conveyor } from '@/scene/machines/Conveyor';
import { EolTester } from '@/scene/machines/EolTester';
import type { Severity } from '@/scene/machines/kit';
import { LaserWelder } from '@/scene/machines/LaserWelder';
import { RejectStation } from '@/scene/machines/RejectStation';
import { CasingStation, CellStacker } from '@/scene/machines/RobotCells';
import { TransferStation } from '@/scene/machines/TransferStation';
import { VisionCheck } from '@/scene/machines/VisionCheck';
import { MACHINE_POS, SLAB } from '@/scene/layout';
import { matte, PALETTE } from '@/scene/style';

// oxlint-disable-next-line react/only-export-components
export const view = { target: [-2.2, 0, 0.6] as [number, number, number], zoom: 44 };

const query = new URLSearchParams(location.search);

/** Every machine at its layout position, on a stand-in slab. Query string:
 *  power=<0-1>, sev=healthy|warning|critical, hot=1, bin=<n>, stopped=1,
 *  kick=1. */
export function MachinesPlant() {
  const power = Number(query.get('power') ?? 1);
  const severity = (query.get('sev') ?? 'healthy') as Severity;
  const running = !query.get('stopped');
  const [kickAt, setKickAt] = useState<number | null>(null);
  const [binCount, setBinCount] = useState(Number(query.get('bin') ?? 3));
  useEffect(() => {
    if (!query.get('kick')) return;
    const id = setInterval(() => {
      setKickAt(Date.now());
      setBinCount((c) => c + 1);
    }, 2500);
    return () => clearInterval(id);
  }, []);
  const welderMid = MACHINE_POS.welderStart.clone().lerp(MACHINE_POS.welderEnd, 0.5);
  return (
    <group>
      <mesh position={[(SLAB.minX + SLAB.maxX) / 2, -SLAB.thickness / 2, (SLAB.minZ + SLAB.maxZ) / 2]} receiveShadow material={matte(PALETTE.slabTop)}>
        <boxGeometry args={[SLAB.maxX - SLAB.minX, SLAB.thickness, SLAB.maxZ - SLAB.minZ]} />
      </mesh>
      <Conveyor running={running} />
      <CellSorter position={MACHINE_POS.sorter} rotation={[0, Math.PI / 2, 0]} running={running} severity={severity} />
      <CellStacker position={MACHINE_POS.stackRobot} running={running} severity={severity} />
      <LaserWelder position={welderMid} power={power} severity={severity} running={running} />
      <VisionCheck position={MACHINE_POS.vision} rotation={[0, Math.PI, 0]} scanning={running} severity={severity} />
      <CasingStation position={MACHINE_POS.casingRobot} rotation={[0, Math.PI, 0]} running={running} severity={severity} />
      <EolTester position={MACHINE_POS.tester} rotation={[0, -Math.PI / 2, 0]} running={running} hot={!!query.get('hot')} severity={severity} />
      <RejectStation position={MACHINE_POS.rejectGate} rotation={[0, -Math.PI / 2, 0]} kickAt={kickAt} binCount={binCount} />
      <TransferStation position={MACHINE_POS.transfer} running={running} severity={severity} />
    </group>
  );
}

export default MachinesPlant;
