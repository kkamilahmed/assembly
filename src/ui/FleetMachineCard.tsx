import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import { ROBOT_X, ROBOT_Z } from '@/scene/constants';
import { RobotArm } from '@/scene/RobotArm';
import { useStore } from '@/state/store';
import { ROBOT_LABELS, type RobotId } from '@/streaming/lineConfig';
import { METRIC_HEX, STATUS_HEX } from './colors';
import { useFleetTelemetry } from './fleetTelemetry';
import { SegmentedMeter } from './SegmentedMeter';

// R3F points the default camera at the world origin, which is ground level
// at the arm's pedestal base — too low to frame a ~3m machine with headroom.
// Re-aim it at roughly the arm's mid-height instead, once, on mount.
function AimCamera({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.lookAt(...target);
  }, [camera, target]);
  return null;
}

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="8" width="3" height="6" rx="0.5" fill="currentColor" />
      <rect x="6.5" y="4" width="3" height="10" rx="0.5" fill="currentColor" />
      <rect x="11" y="1" width="3" height="13" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** One machine's arm rendered alone in its own canvas. RobotArm places
 *  itself at this station's world position on the full line (ROBOT_X/
 *  ROBOT_Z, scene/constants.ts) — the inner group cancels that offset so
 *  every card frames its arm at the origin regardless of which station it
 *  is. No docked car ever reaches these standalone canvases, so each arm
 *  just idles at its authored rest pose (RobotArm.tsx's `reachBlend`
 *  requires a docked car to blend into any IK pose). */
function MachinePreview({ robotId }: { robotId: RobotId }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      shadows
      gl={{ antialias: true, alpha: true }}
      // Pulled back and raised to match the larger machines — at the old
      // distance the taller arms clipped straight out of the top of the
      // card, which is what made WHEEL-01's preview look cropped.
      camera={{ fov: 32, near: 0.1, far: 40, position: [6.0, 3.6, 7.6] }}
    >
      <AimCamera target={[0, 2.0, 0]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 2]} intensity={1.3} castShadow shadow-mapSize={[512, 512]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.3} />
      <Environment preset="studio" background={false} environmentIntensity={0.3} />
      <group position={[-ROBOT_X[robotId], 0, -ROBOT_Z]}>
        <RobotArm robotId={robotId} showProps={false} />
      </group>
      <ContactShadows position={[0, 0.01, 0]} scale={5.4} blur={2.2} far={4} resolution={256} opacity={0.45} color="#1a1d24" />
    </Canvas>
  );
}

export function MachinePreviewCard({ robotId, onEnter }: { robotId: RobotId; onEnter: () => void }) {
  const status = useStore((s) => s.robots[robotId].status);
  const color = STATUS_HEX[status];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <button
        onClick={onEnter}
        aria-label={`Enter the 3D assembly line, ${robotId}`}
        className="group relative min-h-0 flex-1 cursor-pointer"
        style={{ background: 'linear-gradient(180deg, #dbe8f4 0%, #eef3f8 100%)' }}
      >
        <span
          className="absolute left-2.5 top-2.5 z-10 h-2 w-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 0 3px ${color}33` }}
        />
        <span className="absolute right-2.5 top-2.5 z-10 rounded-md bg-white/70 p-1 text-[var(--text-secondary)] backdrop-blur transition-colors group-hover:bg-white/90 group-hover:text-[var(--text-primary)]">
          <BarChartIcon className="h-3.5 w-3.5" />
        </span>
        <MachinePreview robotId={robotId} />
      </button>
      <div className="font-mono-ui shrink-0 border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)]">
        {robotId}
      </div>
    </div>
  );
}

export function TelemetryCard({ robotId }: { robotId: RobotId }) {
  const status = useStore((s) => s.robots[robotId].status);
  const color = STATUS_HEX[status];
  const telemetry = useFleetTelemetry(robotId);

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono-ui text-xs font-semibold">{robotId}</div>
          <div className="text-[11px] text-[var(--text-secondary)]">{ROBOT_LABELS[robotId]}</div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
          style={{ color, backgroundColor: `${color}1f` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {status}
        </span>
      </div>

      <SegmentedMeter
        label="Temperature"
        displayValue={`${telemetry.temperature.toFixed(1)}°C`}
        fraction={telemetry.temperature / 100}
        color={METRIC_HEX.temperature}
        rangeLabel="20-100°C"
      />
      <SegmentedMeter
        label="Pressure"
        displayValue={`${telemetry.pressure.toFixed(1)} psi`}
        fraction={telemetry.pressure / 10}
        color={METRIC_HEX.pressure}
        rangeLabel="0-10 psi"
      />
      <SegmentedMeter
        label="Vibration"
        displayValue={`${telemetry.vibration.toFixed(2)} mm/s`}
        fraction={telemetry.vibration / 10}
        color={METRIC_HEX.vibration}
        rangeLabel="0-10 mm/s"
      />

      <div className="font-mono-ui text-[11px] text-[var(--text-secondary)]">Cycles: {Math.round(telemetry.cycles)}</div>
    </div>
  );
}
