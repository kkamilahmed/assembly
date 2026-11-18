import { BarCard, DonutCard, KpiCard, LineChartCard } from './cards';
import { PLACEHOLDER_DASHBOARD } from './dashboardData';
import type { DashboardData } from './dashboardData';
import { WALL_FACE_X } from './wallFrame';

/**
 * The default dashboard: seven cards on the wall along the slab's -x edge,
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
      {/* Top row */}
      <KpiCard
        position={[-5.15, 4.95, 0]}
        width={3.1}
        title="Loaves per hour"
        value={d.loavesPerHour}
        delta={d.loavesDelta}
        tone="neutral"
        icon="loaf"
      />
      <KpiCard position={[-1.75, 4.95, 0]} width={3.1} title="Core temperature" value={d.coreTemp} unit="°C" tone={d.coreTempTone} icon="thermo" />
      <DonutCard position={[1.85, 4.95, 0]} width={3.5} title="Line efficiency" fraction={d.efficiency} label={d.efficiencyLabel} />
      <KpiCard position={[5.5, 4.95, 0]} width={3.2} title="Reject rate" value={d.rejectRate} unit="%" tone={d.rejectTone} icon="eye" />

      {/* Main row */}
      <LineChartCard
        position={[-3.45, 2.5, 0]}
        width={6.5}
        height={2.9}
        title="Oven zone temperature"
        series={d.ovenTemp}
        compare={d.ovenSetpoint}
        limitWarn={d.ovenWarn}
        limitCrit={d.ovenCrit}
        unit="°C"
      />
      <BarCard
        position={[1.85, 2.5, 0]}
        width={3.5}
        height={2.9}
        title="Rejects per hour"
        values={d.rejects}
        labels={d.rejectLabels}
        value={d.rejects.at(-1)}
        unit="loaves"
      />
      <KpiCard position={[5.5, 3.25, 0]} width={3.2} height={1.4} title="Oven status" value={d.ovenTemp.at(-1) ?? 0} unit="°C" tone={d.ovenTone} icon="check" />
      <KpiCard position={[5.5, 1.75, 0]} width={3.2} height={1.4} title="Waste avoided" value={d.wasteSavedKg} unit="kg" tone="neutral" icon="box" />
    </group>
  );
}
