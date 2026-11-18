import { machineSeverity, useStore } from '@/state/store';
import { PROBLEM_MACHINE_ID, REJECT_BIN_VISIBLE, TABLETS_PER_TRAY, WEIGHT_TARGET_MG } from '@/streaming/lineConfig';
import { channelSeverity, formatReading } from '@/streaming/sensorStream';
import { BELT_Y, MACHINE_POS, OUTFEED_PALLET, SLAB } from './layout';
import { BlisterPacker } from './machines/BlisterPacker';
import { Cartoner } from './machines/Cartoner';
import { CoatingDrum } from './machines/CoatingDrum';
import { Conveyor } from './machines/Conveyor';
import { BLENDER_PILLAR_Z, PowderBlender } from './machines/PowderBlender';
import { RejectStation } from './machines/RejectStation';
import { TabletPress } from './machines/TabletPress';
import { VisionInspection } from './machines/VisionInspection';
import { StatusTag } from './ui3d/StatusTag';

const mid = (a: { x: number; z: number }, b: { x: number; z: number }): [number, number, number] => [(a.x + b.x) / 2, 0, (a.z + b.z) / 2];
const COATER_MID = mid(MACHINE_POS.coaterStart, MACHINE_POS.coaterEnd);
const BLISTER_MID = mid(MACHINE_POS.blisterStart, MACHINE_POS.blisterEnd);
/** The blender's receiver, in the press's own frame (the press is turned a
 *  quarter turn, so world +x is its +z and world -z its +x). */
const RECEIVER: [number, number] = [
  -(MACHINE_POS.blender.z + BLENDER_PILLAR_Z - MACHINE_POS.press.z),
  MACHINE_POS.blender.x - MACHINE_POS.press.x,
];

/** The line's machines, driven from the live store: the press turret turns
 *  (and lurches when it jams), the reject pusher fires on every diverted
 *  tray, the bin fills, everything stops when the line stops, and each
 *  machine's andon shows the same severity as its card on the machines
 *  screen. */
export function Line() {
  const running = useStore((s) => !s.paused);
  const blendSev = useStore((s) => machineSeverity(s, 'BLEND-01'));
  const pressSev = useStore((s) => machineSeverity(s, 'PRESS-P2'));
  const coatSev = useStore((s) => machineSeverity(s, 'COAT-01'));
  const visionSev = useStore((s) => machineSeverity(s, 'VISION-01'));
  const blisterSev = useStore((s) => machineSeverity(s, 'BLISTER-01'));
  const cartonSev = useStore((s) => machineSeverity(s, 'CARTON-01'));
  const press = useStore((s) => s.sensors[PROBLEM_MACHINE_ID]);
  const lastKickAt = useStore((s) => s.lastKickAt);
  const rejected = useStore((s) => s.traysRejected);
  const packed = useStore((s) => s.traysPacked);
  const weight = useStore((s) => WEIGHT_TARGET_MG + s.machines[PROBLEM_MACHINE_ID].trend);
  const qualityStatus = useStore((s) => s.machines[PROBLEM_MACHINE_ID].status);

  const fillSev = channelSeverity(PROBLEM_MACHINE_ID, 'feed', press.feed);
  const jamming = channelSeverity(PROBLEM_MACHINE_ID, 'mechanical', press.mechanical) === 'critical';

  return (
    <group>
      <Conveyor running={running} />
      <PowderBlender position={MACHINE_POS.blender} running={running} severity={blendSev} />
      <TabletPress
        position={MACHINE_POS.press}
        rotation={[0, Math.PI / 2, 0]}
        running={running}
        jamming={jamming}
        severity={pressSev}
        blenderAt={RECEIVER}
      />
      <CoatingDrum position={COATER_MID} running={running} severity={coatSev} />
      <VisionInspection position={MACHINE_POS.vision} rotation={[0, -Math.PI / 2, 0]} scanning={running} severity={visionSev} />
      <RejectStation
        position={MACHINE_POS.rejectGate}
        rotation={[0, -Math.PI / 2, 0]}
        kickAt={lastKickAt}
        binCount={Math.min(rejected, REJECT_BIN_VISIBLE)}
      />
      <BlisterPacker position={BLISTER_MID} rotation={[0, -Math.PI / 2, 0]} running={running} severity={blisterSev} />
      <Cartoner position={MACHINE_POS.cartoner} running={running} severity={cartonSev} />

      {/* Live tags pinned over the machines, the way the references pin
          status cards over shelves. */}
      <StatusTag
        position={[MACHINE_POS.press.x - 0.3, 3.75, MACHINE_POS.press.z - 0.6]}
        label="Fill depth"
        value={formatReading(PROBLEM_MACHINE_ID, 'feed', press.feed)}
        tone={fillSev}
        icon="gauge"
        scale={1.7}
      />
      <StatusTag
        position={[MACHINE_POS.vision.x + 0.2, BELT_Y + 2.3, MACHINE_POS.vision.z - 1.5]}
        label="Tablet weight"
        value={`${weight.toFixed(1)} mg`}
        tone={qualityStatus}
        icon="pill"
        facing="x"
        scale={1.7}
      />
      <StatusTag
        position={[MACHINE_POS.rejectBin.x + 1.1, 1.2, MACHINE_POS.rejectBin.z - 1.0]}
        label="Rejected"
        value={(rejected * TABLETS_PER_TRAY).toLocaleString()}
        tone={rejected > 0 ? 'critical' : 'neutral'}
        icon="alert"
        facing="x"
        scale={1.7}
      />
      <StatusTag
        position={[OUTFEED_PALLET.x, 1.55 - SLAB.thickness, OUTFEED_PALLET.z]}
        label="Passed"
        value={(packed * TABLETS_PER_TRAY).toLocaleString()}
        tone="neutral"
        icon="box"
        scale={1.7}
      />
    </group>
  );
}
