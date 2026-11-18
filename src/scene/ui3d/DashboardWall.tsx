import { BarCard, DonutCard, KpiCard, LineChartCard } from './cards';
import { PLACEHOLDER_DASHBOARD } from './dashboardData';
import type { DashboardData } from './dashboardData';
import { WALL_FACE_X } from './wallFrame';

/**
 * The default dashboard: five cards on the wall along the slab's -x edge,
 * facing +x. Pass any subset of `data` to drive it live; the rest stays on
 * the placeholder values.
 *
 * Inside this group x runs along the wall (toward -z in the world), y is
 * up, and z=0 is the wall surface.
 */
export function DashboardWall({ data }: { data?: Partial<DashboardData> }) {
  const d = { ...PLACEHOLDER_DASHBOARD, ...data };
  return (
    <group position={[WALL_FACE_X, 0, 0]} rotation-y={Math.PI / 2}>
      {/* Four big cards, not eight small ones: from the back of a room only
          bold marks read. The oven chart is the hero because the oven is the
          story. */}
      <LineChartCard
        position={[-3.4, 3.25, 0]}
        width={7.3}
        height={4.0}
        title="Oven zone temperature"
        series={d.ovenTemp}
        compare={d.ovenSetpoint}
        limitWarn={d.ovenWarn}
        limitCrit={d.ovenCrit}
        unit="°C"
      />
      <DonutCard position={[2.15, 4.2, 0]} width={3.5} height={2.1} title="Line efficiency" fraction={d.efficiency} label={d.efficiencyLabel} />
      <KpiCard position={[5.75, 4.2, 0]} width={3.4} height={2.1} title="Loaves per hour" value={d.loavesPerHour} tone="neutral" icon="loaf" />
      <BarCard
        position={[2.15, 1.95, 0]}
        width={3.5}
        height={2.2}
        title="Rejects"
        values={d.rejects}
        labels={d.rejectLabels}
        value={d.rejects.at(-1)}
        unit="loaves"
      />
      <KpiCard position={[5.75, 1.95, 0]} width={3.4} height={2.2} title="Waste avoided" value={d.wasteSavedKg} unit="kg" tone="neutral" icon="box" />
    </group>
  );
}
