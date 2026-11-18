import { machineSeverity, useStore } from '@/state/store';
import { recalibrate } from '@/state/storyDirector';
import { CRITICAL_TREND_MM, PROBLEM_ROBOT_ID, WARN_TREND_MM, WELD_TOLERANCE_MM } from '@/streaming/lineConfig';
import { STATUS_HEX } from './colors';
import { Kbd } from './Kbd';
import { Sparkline } from './Sparkline';

const ID = PROBLEM_ROBOT_ID;

/** The weld station's live card on the plant view: the weld offset trend
 *  the analyzer is computing from every car, the last single weld, and the
 *  fix when it is called for. */
export function RobotPanel() {
  const robot = useStore((s) => s.robots[ID]);
  const severity = useStore((s) => machineSeverity(s, ID));
  const color = STATUS_HEX[severity];
  const last = robot.lastDeviationMm;
  const lastBad = last !== null && Math.abs(last) > WELD_TOLERANCE_MM;

  return (
    <div
      className="rounded-lg border bg-[var(--surface)] p-3 transition-colors"
      style={{ borderColor: severity === 'healthy' ? 'var(--border)' : `${color}88` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono-ui text-xs text-[var(--text-secondary)]">{ID}</div>
          <div className="text-sm font-medium">{robot.label}</div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize"
          style={{ color, backgroundColor: `${color}1f` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {severity}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-mono-ui text-2xl font-semibold leading-none" style={{ color: STATUS_HEX[robot.status] }}>
          {robot.trendMm.toFixed(2)}
        </span>
        <span className="text-xs text-[var(--text-secondary)]">mm avg weld offset</span>
      </div>
      <div className="font-mono-ui mt-0.5 text-[10px] text-[var(--text-secondary)]">
        last weld{' '}
        <span style={{ color: lastBad ? STATUS_HEX.critical : undefined }}>
          {last === null ? '-' : `${last > 0 ? '+' : ''}${last.toFixed(2)}mm`}
        </span>{' '}
        &middot; spec &plusmn;{WELD_TOLERANCE_MM}mm
      </div>

      <div className="mt-2">
        <Sparkline
          data={robot.history}
          color={STATUS_HEX[robot.status]}
          warnMm={WARN_TREND_MM}
          criticalMm={CRITICAL_TREND_MM}
          max={2.6}
        />
      </div>

      {robot.recalibrationRecommended && (
        <button
          onClick={() => recalibrate('operator')}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-[var(--brand-orange)] px-2 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          Recalibrate now
          <Kbd tone="inverse">C</Kbd>
        </button>
      )}
    </div>
  );
}
