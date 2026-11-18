import { useShallow } from 'zustand/react/shallow';
import { machineSeverity, useStore, type Severity } from '@/state/store';
import {
  PROBLEM_MACHINE_ID,
  TESTER_MACHINE_ID,
  MACHINE_IDS,
  MACHINE_LABELS,
  WELD_MIN_N,
  WELD_NOMINAL_N,
  type MachineId,
} from '@/streaming/lineConfig';
import { channelSeverity, channelSpec, formatReading, SENSOR_CHANNELS, SENSOR_SPECS } from '@/streaming/sensorStream';
import { STATUS_HEX } from './colors';
import { FaultInjectionPanel } from './FaultInjectionPanel';
import { MachinePreviewCard, TelemetryCard } from './FleetMachineCard';
import { Kbd } from './Kbd';
import { ViewNav } from './ViewNav';
import type { View } from './views';

/** The machines screen: every machine on the line with its live process sensors,
 *  and a diagnosis strip that says, in words, what the readings add up to.
 *  This is where the story finds the cause: the dashboard has shown weak
 *  welds rising, and this screen shows which machine is doing it and why. */
export function FleetOverview({ active, view, onNavigate }: { active: boolean; view: View; onNavigate: (v: View) => void }) {
  const faultPanelOpen = useStore((s) => s.faultPanelOpen);
  const setFaultPanelOpen = useStore((s) => s.setFaultPanelOpen);
  const manualInjections = useStore((s) => s.injections.filter((i) => i.source === 'manual').length);

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <div>
          <div className="text-sm font-semibold">Machines · Module Line 1</div>
          <div className="text-xs text-[var(--text-secondary)]">Live sensor stream from every machine</div>
        </div>
        <div className="ml-auto">
          <ViewNav view={view} onChange={onNavigate} />
        </div>
        <button
          onClick={() => setFaultPanelOpen(!faultPanelOpen)}
          aria-pressed={faultPanelOpen}
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
          style={{
            borderColor: faultPanelOpen || manualInjections > 0 ? 'var(--brand-orange)' : 'var(--border)',
            color: faultPanelOpen || manualInjections > 0 ? 'var(--brand-orange)' : undefined,
          }}
        >
          Inject sensor fault
          {manualInjections > 0 && (
            <span
              className="font-mono-ui rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: 'var(--brand-orange)' }}
            >
              {manualInjections}
            </span>
          )}
          <Kbd>F</Kbd>
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* The grid makes room for the panel rather than sitting under it. */}
        <div
          className="scroll-thin flex h-full flex-col gap-4 overflow-y-auto p-4 transition-[padding] duration-300 ease-out"
          style={{ paddingLeft: faultPanelOpen ? '21.5rem' : undefined }}
        >
          {/* Fixed height in every state. The strip growing from one line to
              a full diagnosis used to shrink the preview cards below it,
              which resized all four WebGL canvases at once: a visible jump
              mid-presentation, and a multi-second main-thread stall on a
              slow GPU that delayed everything else on the line. */}
          <div className="h-36 shrink-0">
            <Diagnosis />
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-4 gap-4">
            {MACHINE_IDS.map((id) => (
              <MachinePreviewCard key={id} machineId={id} active={active} />
            ))}
          </div>
          <div className="grid shrink-0 grid-cols-4 gap-4">
            {MACHINE_IDS.map((id) => (
              <TelemetryCard key={id} machineId={id} />
            ))}
          </div>
        </div>
        <FaultInjectionPanel />
      </div>
    </div>
  );
}

interface Evidence {
  machineId: MachineId;
  text: string;
  severity: Severity;
}

/** Every signal currently outside its limit, phrased as a reading against
 *  that limit. The selector returns flat strings so the shallow comparison
 *  can tell an unchanged list from a changed one; fresh objects would make
 *  every store update look like a change. */
function useEvidence(): Evidence[] {
  const rows = useStore(
    useShallow((s) => {
      const out: string[] = [];
      for (const machineId of MACHINE_IDS) {
        const machine = s.machines[machineId];
        if (machine.status !== 'healthy') {
          out.push(
            [machineId, machine.status, `weld strength ${(WELD_NOMINAL_N + machine.trend).toFixed(0)} N (min ${WELD_MIN_N})`].join('|'),
          );
        }
        for (const channel of SENSOR_CHANNELS) {
          const value = s.sensors[machineId][channel];
          const severity = channelSeverity(machineId, channel, value);
          if (severity === 'healthy') continue;
          const spec = channelSpec(machineId, channel);
          out.push([machineId, severity, `${spec.label.toLowerCase()} ${formatReading(machineId, channel, value)} (limit ${spec.warn})`].join('|'));
        }
      }
      return out;
    }),
  );
  return rows.map((row) => {
    const [machineId, severity, text] = row.split('|');
    return { machineId: machineId as MachineId, severity: severity as Severity, text };
  });
}

/**
 * What the readings add up to, in words. Built only from what the stream
 * has measured - the signals out of limit, and the QC results since the
 * incident began - so it never says more than the data does.
 */
function Diagnosis() {
  const evidence = useEvidence();
  const welderSeverity = useStore((s) => machineSeverity(s, PROBLEM_MACHINE_ID));
  const powerLow = useStore((s) => s.sensors[PROBLEM_MACHINE_ID].load);
  const cellHot = useStore((s) => channelSeverity(TESTER_MACHINE_ID, 'temperature', s.sensors[TESTER_MACHINE_ID].temperature) === 'critical');
  const incident = useStore((s) => s.incident);
  const paused = useStore((s) => s.paused);
  const autopilot = useStore((s) => s.autopilot);
  const readings = useStore((s) => s.sensorPipeline.readings);

  if (evidence.length === 0) {
    return (
      <div className="flex h-full items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: STATUS_HEX.healthy, boxShadow: `0 0 0 4px ${STATUS_HEX.healthy}26` }}
        />
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: STATUS_HEX.healthy }}>
            Healthy
          </div>
          <div className="mt-0.5 text-base font-semibold">All {MACHINE_IDS.length} machines inside limits</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">
            Temperatures, loads, laser power and optics from every machine, plus a weld strength for every module,
            analysed as they stream.
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono-ui text-2xl font-semibold leading-none">{readings.toLocaleString()}</div>
          <div className="mt-1 text-[11px] text-[var(--text-secondary)]">readings streamed</div>
        </div>
      </div>
    );
  }

  const worst = evidence.some((e) => e.severity === 'critical') ? 'critical' : 'warning';
  const color = STATUS_HEX[worst];
  const welderFault = welderSeverity !== 'healthy';
  const powerSpec = SENSOR_SPECS[PROBLEM_MACHINE_ID].load;
  const powerText = powerLow >= powerSpec.warn ? `laser power ${powerLow.toFixed(0)}% low` : 'laser power drifting';
  const open = incident !== null && incident.resolvedAt === null;
  const alarmed = [...new Set(evidence.map((e) => e.machineId))];

  return (
    <div
      className="animate-fade-in h-full overflow-hidden rounded-lg border bg-[var(--surface)]"
      style={{ borderColor: `${color}88`, boxShadow: `0 0 0 3px ${color}1a` }}
    >
      <div className="flex h-full">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
        <div className="flex min-w-0 flex-1 items-center gap-6 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
              {worst === 'critical' ? 'Critical' : 'Warning'} · {alarmed.join(', ')}
            </div>
            <div className="mt-0.5 text-base font-semibold">
              {welderFault
                ? `${PROBLEM_MACHINE_ID} ${MACHINE_LABELS[PROBLEM_MACHINE_ID]}: ${powerText}, welds not penetrating deep enough${cellHot ? `, overheating cell on ${TESTER_MACHINE_ID}` : ''}`
                : `${alarmed.length === 1 ? alarmed[0] : `${alarmed.length} machines`} reading outside limits`}
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {evidence.map((e) => (
                <li
                  key={`${e.machineId}-${e.text.split(' ')[0]}`}
                  className="font-mono-ui rounded-md px-2 py-0.5 text-[11px]"
                  style={{ color: STATUS_HEX[e.severity], backgroundColor: `${STATUS_HEX[e.severity]}14` }}
                >
                  {alarmed.length > 1 ? `${e.machineId} ` : ''}
                  {e.text}
                </li>
              ))}
            </ul>
            {welderFault && (
              <p className="mt-2 max-w-3xl text-xs leading-snug text-[var(--text-secondary)]">
                Delivered power falling while the lens reading climbs, followed by weaker welds at the weld check, is the
                signature of a fogging lens: it soaks up laser power before it reaches the busbar, so the weld does not
                penetrate deep enough to hold.
                {cellHot && ' A cell running hot on the tester is what a weld like that does under load: stop the line now.'}
              </p>
            )}
          </div>

          {welderFault && (
            <div className="flex shrink-0 flex-col items-end gap-2 text-right">
              {open && (
                <div>
                  <div className="font-mono-ui text-2xl font-semibold leading-none" style={{ color: incident.rejected ? STATUS_HEX.critical : undefined }}>
                    {incident.rejected} / {incident.inspected}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-secondary)]">modules failed since onset</div>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs font-medium">
                {autopilot ? (
                  'Autopilot is recalibrating'
                ) : paused ? (
                  <>
                    Recommended: <Kbd>C</Kbd> recalibrate laser power
                  </>
                ) : (
                  <>
                    Recommended: <Kbd>S</Kbd> {worst === 'critical' ? 'emergency stop' : 'stop line'}, <Kbd>C</Kbd> recalibrate laser
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
