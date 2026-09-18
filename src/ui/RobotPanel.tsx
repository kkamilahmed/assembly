import { useStore } from '@/state/store';
import { recalibrateRobot } from '@/state/storyDirector';
import { CRITICAL_TREND_MM, SAMPLE_EVERY_N, WARN_TREND_MM, WELD_TOLERANCE_MM } from '@/streaming/lineConfig';
import { STATUS_HEX } from './colors';
import { fmtDuration } from './incidentDiagnosis';
import { Sparkline } from './Sparkline';

// Only the Welding station runs the drift/QC pipeline this dashboard
// visualizes — Panel/Paint/Wheel are visual-only in the 3D scene, so there's
// nothing meaningful to show a card for.
const DASHBOARD_ROBOT_ID = 'WELD-01' as const;

export function RobotPanel() {
  const robot = useStore((s) => s.robots[DASHBOARD_ROBOT_ID]);
  const selectedRobotId = useStore((s) => s.selectedRobotId);
  const setSelectedRobot = useStore((s) => s.setSelectedRobot);
  const setReplayOpen = useStore((s) => s.setReplayOpen);
  const liveVisionQC = useStore((s) => s.liveVisionQC);
  const hasIncident = useStore((s) => s.incident.faultStartedAt !== null);

  const isSelected = selectedRobotId === DASHBOARD_ROBOT_ID;
  const id = DASHBOARD_ROBOT_ID;

  // Under spot checks there is no trend, only the last weld somebody
  // happened to pull. Deriving a severity from a single sample produced a
  // red "Critical" pill sitting next to an empty event feed, a 100% yield
  // figure and no recommended action — the dashboard contradicting itself.
  // The honest reading is that the health of the line is simply not known.
  const unknown = !liveVisionQC;
  const color = unknown ? '#9aa0a8' : STATUS_HEX[robot.status];

  return (
    <div className="flex flex-col gap-2">
      <div
        onClick={() => setSelectedRobot(isSelected ? null : id)}
        className={`cursor-pointer rounded-lg border bg-[var(--surface)] p-3 transition-shadow ${
          isSelected ? 'border-[var(--brand-orange)] shadow-sm' : 'border-[var(--border)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono-ui text-xs text-[var(--text-secondary)]">{id}</div>
            <div className="text-sm font-medium">{robot.label}</div>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize"
            style={{ color, backgroundColor: `${color}1f` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            {unknown ? 'no trend' : robot.status}
          </span>
        </div>

        {/* The number the whole dashboard exists to show, at a size that
            says so. It was 11px grey secondary text under the chart. */}
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-mono-ui text-2xl font-semibold leading-none" style={{ color }}>
            {robot.displayedTrendMm.toFixed(2)}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            {unknown ? 'mm, last spot check' : 'mm mean deviation'}
          </span>
        </div>
        <div className="font-mono-ui mt-0.5 text-[10px] text-[var(--text-secondary)]">
          limits {WARN_TREND_MM} / {CRITICAL_TREND_MM} &middot; spec &plusmn;{WELD_TOLERANCE_MM}mm
        </div>

        <div className="mt-2">
          <Sparkline data={robot.history} color={color} warnMm={WARN_TREND_MM} criticalMm={CRITICAL_TREND_MM} />
        </div>

        {/* Forward projection off the windowed slope. This is the thing a
            per-event threshold rule structurally cannot say, so it's worth
            its own line rather than being folded into the trend number. */}
        {liveVisionQC && robot.projectedBreachMs !== null && (
          <div
            className="mt-2 rounded-md px-2 py-1.5 text-xs"
            style={{ backgroundColor: `${STATUS_HEX.warning}1f`, color: STATUS_HEX.warning }}
          >
            Projected to reach spec limit in{' '}
            <span className="font-mono-ui font-semibold">{fmtDuration(robot.projectedBreachMs)}</span>
          </div>
        )}
        {unknown && (
          <div className="mt-2 rounded-md bg-black/5 px-2 py-1.5 text-xs text-[var(--text-secondary)]">
            One weld in {SAMPLE_EVERY_N} is measured by hand. A single reading is not a trend, so nothing here can
            tell you which way the machine is moving.
          </div>
        )}

        {robot.recalibrationRecommended && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              recalibrateRobot(id);
            }}
            className="mt-2 w-full rounded-md bg-[var(--brand-orange)] px-2 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Recalibrate now
          </button>
        )}

        {hasIncident && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setReplayOpen(true);
            }}
            className="mt-2 w-full rounded-md border border-[var(--border)] py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-black/5"
          >
            Incident replay
            <kbd className="font-mono-ui ml-2 rounded bg-black/5 px-1 py-0.5 text-[10px]">I</kbd>
          </button>
        )}
      </div>
    </div>
  );
}
