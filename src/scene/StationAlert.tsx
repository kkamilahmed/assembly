import { Html } from '@react-three/drei';
import { machineSeverity, useStore } from '@/state/store';
import { PROBLEM_ROBOT_ID } from '@/streaming/lineConfig';
import { STATUS_HEX } from '@/ui/colors';
import { ROBOT_X, ROBOT_Z } from './constants';

/**
 * A callout over the weld robot whenever it is anything but healthy, so the
 * plant view says *which* machine is the problem and how far off it is,
 * right where the audience is already looking. It also confirms the fix:
 * after a recalibration it reads green for a few seconds.
 */
export function StationAlert() {
  const severity = useStore((s) => machineSeverity(s, PROBLEM_ROBOT_ID));
  const trendMm = useStore((s) => s.robots[PROBLEM_ROBOT_ID].trendMm);
  const paused = useStore((s) => s.paused);
  const recalibratedAt = useStore((s) => s.robots[PROBLEM_ROBOT_ID].lastRecalibratedAt);
  const sensorsAt = useStore((s) => s.sensorsAt);
  // Driven off the sensor clock rather than a timer: it ticks every frame of
  // the stream, so "just recalibrated" expires on its own without state.
  const justFixed = recalibratedAt !== null && sensorsAt - recalibratedAt < 5000 && severity === 'healthy';

  if (severity === 'healthy' && !justFixed) return null;
  const color = justFixed ? STATUS_HEX.healthy : STATUS_HEX[severity];
  const label = justFixed
    ? 'Recalibrated'
    : paused
      ? 'Stopped · torch off seam'
      : severity === 'critical'
        ? 'Critical · torch off seam'
        : 'Drifting off the seam';

  return (
    <Html
      position={[ROBOT_X[PROBLEM_ROBOT_ID], 3.9, ROBOT_Z]}
      center
      distanceFactor={19}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
      zIndexRange={[30, 0]}
    >
      <div className="flex flex-col items-center">
        <div
          className={`animate-fade-in flex items-center gap-2 whitespace-nowrap rounded-lg border-2 bg-white px-3 py-1.5 shadow-lg ${
            justFixed ? '' : 'animate-card-pulse'
          }`}
          style={{ borderColor: color, ['--pulse-color' as string]: `${color}55` }}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-mono-ui text-[13px] font-semibold">{PROBLEM_ROBOT_ID}</span>
          <span className="text-[13px] font-semibold" style={{ color }}>
            {label}
          </span>
          {!justFixed && trendMm > 0 && (
            <span className="font-mono-ui text-[12px] text-[var(--text-secondary)]">{trendMm.toFixed(2)}mm</span>
          )}
        </div>
        <div className="h-5 w-0.5" style={{ backgroundColor: color }} />
      </div>
    </Html>
  );
}
