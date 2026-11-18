import { useEffect, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/state/store';
import { MACHINE_IDS, MACHINE_LABELS, type MachineId } from '@/streaming/lineConfig';
import {
  CHANNEL_NAMES,
  channelSeverity,
  channelSpec,
  formatReading,
  injectionSeverity,
  INTENSITY_MAX,
  INTENSITY_MIN,
  SENSOR_CHANNELS,
  SENSOR_TICK_MS,
  type FaultInjection,
  type SensorChannel,
} from '@/streaming/sensorStream';
import { METRIC_HEX, STATUS_HEX } from './colors';
import { fmtDuration } from './format';

/** Where the slider starts. High enough that one press visibly moves every
 *  selected machine - several of them straight past a limit - because the
 *  first thing anyone does with this panel is press Inject and look. */
const DEFAULT_INTENSITY = 12;

/**
 * Manual fault injection for the process-sensor stream: pick any machines,
 * any channels, set an intensity, and the readings start climbing on the
 * fleet cards behind the panel.
 *
 * Machines are multi-select and default to all of them. The D / E deviation
 * keys (state/storyDirector.ts) only ever put one fault on one station at
 * one moment; this is the manual counterpart, for showing what the fleet
 * view does when several machines go wrong at once.
 */
export function FaultInjectionPanel() {
  const open = useStore((s) => s.faultPanelOpen);
  const setOpen = useStore((s) => s.setFaultPanelOpen);
  // Only what somebody injected from this panel. The deviation keys put a
  // physical signature on PRESS-P2's sensors too, but that is the machine
  // misbehaving, not a fault this panel owns.
  const injections = useStore(useShallow((s) => s.injections.filter((i) => i.source === 'manual')));
  const injectFaults = useStore((s) => s.injectFaults);
  const clearInjection = useStore((s) => s.clearInjection);
  const clearInjections = useStore((s) => s.clearInjections);
  const pipeline = useStore((s) => s.sensorPipeline);
  const paused = useStore((s) => s.paused);
  // The stream's own clock, not the wall clock: see store.sensorsAt.
  const now = useStore((s) => s.sensorsAt);

  const [machines, setMachines] = useState<MachineId[]>(() => [...MACHINE_IDS]);
  const [channels, setChannels] = useState<SensorChannel[]>(['mechanical']);
  const [intensity, setIntensity] = useState(DEFAULT_INTENSITY);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  // Selections are kept in canonical order, not click order, so the active
  // list and the grid always read top-left to bottom-right.
  const toggleMachine = (id: MachineId) =>
    setMachines((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : MACHINE_IDS.filter((r) => r === id || prev.includes(r))));
  const toggleChannel = (channel: SensorChannel) =>
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : SENSOR_CHANNELS.filter((c) => c === channel || prev.includes(c)),
    );

  const allMachines = machines.length === MACHINE_IDS.length;
  const allChannels = channels.length === SENSOR_CHANNELS.length;
  const canInject = machines.length > 0 && channels.length > 0;

  // What this intensity will actually do, per selected pair, before anyone
  // presses the button - the same arithmetic the stream will run, so the
  // preview cannot disagree with the result.
  const outcomes = machines.flatMap((machineId) => channels.map((channel) => injectionSeverity(machineId, channel, intensity)));
  const critical = outcomes.filter((o) => o === 'critical').length;
  const warning = outcomes.filter((o) => o === 'warning').length;
  const inLimits = outcomes.length - critical - warning;

  return (
    <aside
      role="dialog"
      aria-label="Fault injection"
      className="animate-fade-in absolute left-4 top-4 z-30 flex max-h-[calc(100%-2rem)] w-80 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <LayersIcon className="h-4 w-4 text-[var(--brand)]" />
        <h2 className="text-sm font-semibold">Fault injection</h2>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close fault injection"
          className="-mr-1 ml-auto rounded-md p-1 text-[var(--text-secondary)] transition-colors hover:bg-black/5 hover:text-[var(--text-primary)]"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {/* The honest version of a "connected to backend" light: there is no
            backend. The stream is generated in this tab, and saying so costs
            nothing next to the alternative of being asked on stage. */}
        <div
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium"
          style={{
            color: paused ? STATUS_HEX.warning : STATUS_HEX.healthy,
            backgroundColor: paused ? `${STATUS_HEX.warning}14` : `${STATUS_HEX.healthy}14`,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span>{paused ? 'Line stopped' : 'Stream live'} &middot; simulated</span>
          <span className="font-mono-ui ml-auto opacity-70">{(SENSOR_TICK_MS / 1000).toFixed(1)}s</span>
        </div>

        <section className="flex flex-col gap-1.5">
          <SectionLabel
            action={
              <QuickAction onClick={() => setMachines(allMachines ? [] : [...MACHINE_IDS])}>
                {allMachines ? 'Clear' : `Select all ${MACHINE_IDS.length}`}
              </QuickAction>
            }
          >
            Machine
          </SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {MACHINE_IDS.map((id) => (
              <ToggleButton key={id} selected={machines.includes(id)} onClick={() => toggleMachine(id)}>
                <span className="font-mono-ui block text-[11px] font-semibold">{id}</span>
                <span className="block truncate text-[10px] text-[var(--text-secondary)]">{MACHINE_LABELS[id]}</span>
              </ToggleButton>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-1.5">
          <SectionLabel
            action={
              <QuickAction onClick={() => setChannels(allChannels ? [] : [...SENSOR_CHANNELS])}>
                {allChannels ? 'Clear' : `Select all ${SENSOR_CHANNELS.length}`}
              </QuickAction>
            }
          >
            Sensor
          </SectionLabel>
          {SENSOR_CHANNELS.map((channel) => {
            return (
              <ToggleButton key={channel} selected={channels.includes(channel)} onClick={() => toggleChannel(channel)}>
                <span className="flex items-center gap-2 text-xs font-medium">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: METRIC_HEX[channel] }} />
                  {CHANNEL_NAMES[channel]}
                </span>
              </ToggleButton>
            );
          })}
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Intensity</span>
            <span className="font-mono-ui">
              <span className="text-lg font-semibold">{intensity}</span>
              <span className="text-xs text-[var(--text-secondary)]">/{INTENSITY_MAX}</span>
            </span>
          </div>
          <input
            type="range"
            min={INTENSITY_MIN}
            max={INTENSITY_MAX}
            step={1}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            aria-label="Fault intensity"
            className="mt-1 w-full cursor-pointer"
            style={{ accentColor: 'var(--brand)' }}
          />
          <div className="font-mono-ui mt-0.5 flex justify-between text-[9px] text-[var(--text-secondary)]">
            <span>1</span>
            <span>5</span>
            <span>10</span>
            <span>15</span>
            <span>20</span>
          </div>
          {/* Intensity is a fraction of each channel's remaining headroom, so
              the same number lands differently on a machine that already runs
              hot. Stating the outcome up front is the difference between a
              slider and a guess. */}
          <p className="mt-2 text-[11px] leading-snug text-[var(--text-secondary)]">
            {canInject ? (
              <>
                {outcomes.length} reading{outcomes.length === 1 ? '' : 's'} settle at{' '}
                <span className="font-semibold" style={{ color: STATUS_HEX.critical }}>
                  {critical} critical
                </span>
                ,{' '}
                <span className="font-semibold" style={{ color: STATUS_HEX.warning }}>
                  {warning} warning
                </span>
                , {inLimits} in limits.
              </>
            ) : (
              'Select at least one machine and one sensor.'
            )}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => injectFaults(machines, channels, intensity)}
              disabled={!canInject}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlayIcon className="h-3 w-3" />
              Inject
            </button>
            <button
              onClick={() => clearInjections('manual')}
              disabled={injections.length === 0}
              className="rounded-md border border-[var(--border)] px-3 py-2 text-xs font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear all
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3">
          <SectionLabel
            action={
              injections.length > 0 ? (
                <span className="font-mono-ui text-[10px] font-medium text-[var(--text-secondary)]">{injections.length}</span>
              ) : undefined
            }
          >
            Active injections
          </SectionLabel>
          {injections.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">None active.</p>
          ) : (
            // Scrolls in place: a fleet-wide injection is twelve rows, and
            // the pipeline counters below it are the reason anyone opened
            // this section in the first place.
            <ul
              className="scroll-thin flex max-h-52 flex-col gap-1 overflow-y-auto pr-0.5"
              style={{
                maskImage: 'linear-gradient(to bottom, black calc(100% - 16px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 16px), transparent 100%)',
              }}
            >
              {injections.map((injection) => (
                <ActiveInjectionRow key={injection.id} injection={injection} now={now} onClear={() => clearInjection(injection.id)} />
              ))}
            </ul>
          )}
        </section>

      </div>

      <div className="flex flex-col gap-1.5 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <SectionLabel>Pipeline</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="Readings" value={pipeline.readings} />
          <Stat label="Anomalies" value={pipeline.anomalies} color={pipeline.anomalies > 0 ? STATUS_HEX.warning : undefined} />
          <Stat label="Active inj." value={injections.length} color={injections.length > 0 ? 'var(--brand)' : undefined} />
        </div>
      </div>
    </aside>
  );
}

function ActiveInjectionRow({
  injection,
  now,
  onClear,
}: {
  injection: FaultInjection;
  now: number;
  onClear: () => void;
}) {
  // The live reading, not the target: an injection that has only just been
  // armed is still on its way up, and the row should say so.
  const value = useStore((s) => s.sensors[injection.machineId][injection.channel]);
  const severity = channelSeverity(injection.machineId, injection.channel, value);
  const color = STATUS_HEX[severity];

  return (
    <li className="flex items-center gap-2 rounded-md bg-black/[0.03] px-2 py-1.5">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <div className="font-mono-ui truncate text-[11px] font-medium">
          {injection.machineId} &middot; {channelSpec(injection.machineId, injection.channel).label}
        </div>
        <div className="font-mono-ui text-[10px] text-[var(--text-secondary)]">
          level {injection.intensity} &middot;{' '}
          <span style={{ color, fontWeight: severity === 'healthy' ? undefined : 600 }}>
            {formatReading(injection.machineId, injection.channel, value)}
          </span>{' '}
          &middot; {fmtDuration(now - injection.startedAt)}
        </div>
      </div>
      <button
        onClick={onClear}
        aria-label={`Clear ${injection.machineId} ${channelSpec(injection.machineId, injection.channel).label} fault`}
        className="shrink-0 rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-black/5 hover:text-[var(--text-primary)]"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </li>
  );
}

function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{children}</span>
      {action}
    </div>
  );
}

function QuickAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[10px] font-medium text-[var(--brand)] hover:underline">
      {children}
    </button>
  );
}

function ToggleButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className="rounded-md border px-2 py-1.5 text-left transition-colors hover:bg-black/[0.03]"
      style={{
        borderColor: selected ? 'var(--brand)' : 'var(--border)',
        backgroundColor: selected ? 'rgba(24, 104, 214, 0.08)' : undefined,
      }}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] px-2 py-1.5 text-center">
      <div className="font-mono-ui text-sm font-semibold" style={{ color }}>
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" className={className}>
      <path d="M8 1.75 1.75 5 8 8.25 14.25 5 8 1.75Z" />
      <path d="m1.75 8 6.25 3.25L14.25 8" />
      <path d="m1.75 11 6.25 3.25L14.25 11" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={className}>
      <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M4 2.5v11l9-5.5-9-5.5Z" />
    </svg>
  );
}
