import { useEffect, useState } from 'react';
import { Conveyor } from '@/scene/machines/Conveyor';
import { DoughMixer } from '@/scene/machines/DoughMixer';
import { Packer } from '@/scene/machines/Packer';
import { RejectStation } from '@/scene/machines/RejectStation';
import { TunnelOven } from '@/scene/machines/TunnelOven';
import { VisionInspection } from '@/scene/machines/VisionInspection';
import type { Severity } from '@/scene/machines/kit';
import { MACHINE_POS, SLAB } from '@/scene/layout';
import { matte, PALETTE } from '@/scene/style';

// oxlint-disable-next-line react/only-export-components
export const view = { target: [-2.2, 0, 0.6] as [number, number, number], zoom: 44 };

const query = new URLSearchParams(location.search);

/** Every machine at its layout position, on a stand-in slab. Query string:
 *  heat=<n>, sev=healthy|warning|critical, bin=<n>, stopped=1, kick=1. */
export function MachinesPlant() {
  const heat = Number(query.get('heat') ?? 1);
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
  const ovenMid = MACHINE_POS.ovenStart.clone().lerp(MACHINE_POS.ovenEnd, 0.5);
  return (
    <group>
      <mesh position={[(SLAB.minX + SLAB.maxX) / 2, -SLAB.thickness / 2, (SLAB.minZ + SLAB.maxZ) / 2]} receiveShadow material={matte(PALETTE.slabTop)}>
        <boxGeometry args={[SLAB.maxX - SLAB.minX, SLAB.thickness, SLAB.maxZ - SLAB.minZ]} />
      </mesh>
      <Conveyor running={running} />
      <DoughMixer position={MACHINE_POS.mixer} rotation={[0, Math.PI / 2, 0]} running={running} severity={severity} />
      <TunnelOven position={ovenMid} heat={heat} severity={severity} running={running} />
      <VisionInspection position={MACHINE_POS.vision} rotation={[0, -Math.PI / 2, 0]} scanning={running} severity={severity} />
      <RejectStation position={MACHINE_POS.rejectGate} rotation={[0, -Math.PI / 2, 0]} kickAt={kickAt} binCount={binCount} />
      <Packer position={MACHINE_POS.packer} running={running} severity={severity} />
    </group>
  );
}

export default MachinesPlant;
