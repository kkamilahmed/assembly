import { useStore } from '@/state/store';
import { recalibrateRobot } from '@/state/storyDirector';
import { STATUS_HEX } from './colors';
import { Sparkline } from './Sparkline';

// Only the Welding station runs the drift/QC pipeline this dashboard
// visualizes — Panel/Paint/Wheel are visual-only in the 3D scene, so there's
// nothing meaningful to show a card for.
const DASHBOARD_ROBOT_ID = 'WELD-01' as const;

export function RobotPanel() {
  const robots = useStore((s) => s.robots);
  const selectedRobotId = useStore((s) => s.selectedRobotId);
  const setSelectedRobot = useStore((s) => s.setSelectedRobot);

  return (
    <div className="flex flex-col gap-2">
      {[DASHBOARD_ROBOT_ID].map((id) => {
        const robot = robots[id];
        const color = STATUS_HEX[robot.status];
        const isSelected = selectedRobotId === id;
        return (
          <div
            key={id}
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
                {robot.status}
              </span>
            </div>
            <div className="mt-2">
              <Sparkline data={robot.history} color={color} max={1.4} />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span className="font-mono-ui">{robot.displayedTrendMm.toFixed(2)}mm trend</span>
              {robot.recalibrationRecommended && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    recalibrateRobot(id);
                  }}
                  className="rounded-md bg-[var(--brand-orange)] px-2 py-1 font-medium text-white hover:opacity-90"
                >
                  Recalibrate
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
