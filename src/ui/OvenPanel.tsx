import { machineSeverity, useStore } from '@/state/store';
import { recalibrate } from '@/state/storyDirector';
import {
  BROWNING_TARGET,
  BROWNING_TOLERANCE,
  CRITICAL_TREND,
  PROBLEM_MACHINE_ID,
  WARN_TREND,
} from '@/streaming/lineConfig';
import { formatReading } from '@/streaming/sensorStream';
import { STATUS_HEX } from './colors';
import { Kbd } from './Kbd';
import { Sparkline } from './Sparkline';

const ID = PROBLEM_MACHINE_ID;

/** The oven's live card on the plant view: the browning trend vision
 *  inspection computes from every loaf, the oven's own zone temperature,
 *  the last loaf, and the fix when it is called for. */
export function OvenPanel() {
  const machine = useStore((s) => s.machines[ID]);
  const severity = useStore((s) => machineSeverity(s, ID));
  const zoneTemp = useStore((s) => s.sensors[ID].temperature);
  const color = STATUS_HEX[severity];
  const last = machine.lastOffset;
  const lastBad = last !== null && Math.abs(last) > BROWNING_TOLERANCE;

  return (
    <div
      className="rounded-lg border bg-[var(--surface)] p-3 transition-colors"
      style={{ borderColor: severity === 'healthy' ? 'var(--border)' : `${color}88` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono-ui text-xs text-[var(--text-secondary)]">{ID}</div>
          <div className="text-sm font-medium">{machine.label}</div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize"
          style={{ color, backgroundColor: `${color}1f` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {severity}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] text-[var(--text-secondary)]">Crust browning</div>
          <div className="font-mono-ui mt-0.5 text-xl font-semibold leading-none" style={{ color: STATUS_HEX[machine.status] }}>
            {(BROWNING_TARGET + machine.trend).toFixed(1)}
          </div>
          <div className="font-mono-ui mt-1 text-[10px] text-[var(--text-secondary)]">
            target {BROWNING_TARGET} &plusmn;{BROWNING_TOLERANCE}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[var(--text-secondary)]">Zone 2 temp</div>
          <div className="font-mono-ui mt-0.5 text-xl font-semibold leading-none" style={{ color }}>
            {formatReading(ID, 'temperature', zoneTemp)}
          </div>
          <div className="font-mono-ui mt-1 text-[10px] text-[var(--text-secondary)]">
            last loaf{' '}
            <span style={{ color: lastBad ? STATUS_HEX.critical : undefined }}>
              {last === null ? '-' : (BROWNING_TARGET + last).toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2">
        <Sparkline
          data={machine.history}
          color={STATUS_HEX[machine.status]}
          warn={WARN_TREND}
          critical={CRITICAL_TREND}
          max={20}
        />
      </div>

      {machine.recalibrationRecommended && (
        <button
          onClick={() => recalibrate('operator')}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-[var(--brand-orange)] px-2 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          Recalibrate oven
          <Kbd tone="inverse">C</Kbd>
        </button>
      )}
    </div>
  );
}
