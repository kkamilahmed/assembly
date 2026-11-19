import { useEffect, useState } from 'react';
import { BlisterPacker } from '@/scene/machines/BlisterPacker';
import { Cartoner } from '@/scene/machines/Cartoner';
import { CoatingDrum } from '@/scene/machines/CoatingDrum';
import { Conveyor } from '@/scene/machines/Conveyor';
import { PowderBlender } from '@/scene/machines/PowderBlender';
import { RejectStation } from '@/scene/machines/RejectStation';
import { TabletPress } from '@/scene/machines/TabletPress';
import { VisionInspection } from '@/scene/machines/VisionInspection';
import type { Severity } from '@/scene/machines/kit';
import { MACHINE_POS, SLAB } from '@/scene/layout';
import { matte, PALETTE } from '@/scene/style';

// oxlint-disable-next-line react/only-export-components
export const view = { target: [-2.2, 0, 0.6] as [number, number, number], zoom: 44 };

const query = new URLSearchParams(location.search);

/** Every machine at its layout position, on a stand-in slab. Query string:
 *  sev=healthy|warning|critical, jam=1, bin=<n>, stopped=1, kick=1. */
export function MachinesPlant() {
  const severity = (query.get('sev') ?? 'healthy') as Severity;
  const running = !query.get('stopped');
  const [kickAt, setKickAt] = useState<number | null>(null);
  const [binCount, setBinCount] = useState(Number(query.get('bin') ?? 5));
  useEffect(() => {
    if (!query.get('kick')) return;
    const id = setInterval(() => {
      setKickAt(Date.now());
      setBinCount((c) => c + 1);
    }, 2500);
    return () => clearInterval(id);
  }, []);
  const coaterMid = MACHINE_POS.coaterStart.clone().lerp(MACHINE_POS.coaterEnd, 0.5);
  const blisterMid = MACHINE_POS.blisterStart.clone().lerp(MACHINE_POS.blisterEnd, 0.5);
  return (
    <group>
      <mesh position={[(SLAB.minX + SLAB.maxX) / 2, -SLAB.thickness / 2, (SLAB.minZ + SLAB.maxZ) / 2]} receiveShadow material={matte(PALETTE.slabTop)}>
        <boxGeometry args={[SLAB.maxX - SLAB.minX, SLAB.thickness, SLAB.maxZ - SLAB.minZ]} />
      </mesh>
      <Conveyor running={running} />
      <PowderBlender position={MACHINE_POS.blender} running={running} severity={severity} />
      <TabletPress position={MACHINE_POS.press} rotation={[0, Math.PI / 2, 0]} running={running} jamming={!!query.get('jam')} severity={severity} />
      <CoatingDrum position={coaterMid} running={running} severity={severity} />
      <VisionInspection position={MACHINE_POS.vision} rotation={[0, -Math.PI / 2, 0]} scanning={running} severity={severity} />
      <RejectStation position={MACHINE_POS.rejectGate} rotation={[0, -Math.PI / 2, 0]} kickAt={kickAt} binCount={binCount} />
      <BlisterPacker position={blisterMid} rotation={[0, -Math.PI / 2, 0]} running={running} severity={severity} />
      <Cartoner position={MACHINE_POS.cartoner} running={running} severity={severity} />
    </group>
  );
}

export default MachinesPlant;
