import { useStore } from '@/state/store';
import { FLIGHT_HEX } from '@/scene/globe/palette';
import { FRAUD_RATE_LIMIT, packetsToCharges } from './businessCase';
import { STATUS_HEX } from './colors';
import { fmtUsd } from './format';
import { useTrafficHistory } from './trafficHistory';

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2.5 shadow-sm backdrop-blur">
      <div className="text-[11px] text-[var(--text-secondary)]">{label}</div>
      <div className="font-mono-ui mt-0.5 text-xl font-semibold leading-tight" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

/** The two numbers that matter, pinned over the globe, and what the
 *  colours of the flights mean. */
export function GlobeHud() {
  const { latest, rates } = useTrafficHistory();
  const blocked = useStore((s) => s.blocked);
  const leaking = latest.rate > 0;
  const rising = rates.length > 4 && latest.rate > (rates.at(-5) ?? 0) + 0.0002;
  const pct = `${(latest.rate * 100).toFixed(2)}%`;
  return (
    <>
      <div className="pointer-events-none absolute left-5 top-5 z-10 flex flex-col gap-2">
        <Tile
          label="Fraud getting through"
          value={leaking && rising ? `${pct} rising` : pct}
          color={latest.rate > FRAUD_RATE_LIMIT ? STATUS_HEX.critical : leaking ? STATUS_HEX.warning : STATUS_HEX.healthy}
        />
        {leaking || blocked === 0 ? (
          <Tile label="Lost in the last 10 min" value={fmtUsd(latest.per10MinUsd)} color={leaking ? STATUS_HEX.critical : undefined} />
        ) : (
          <Tile label="Fraudulent charges blocked" value={packetsToCharges(blocked).toLocaleString()} color={STATUS_HEX.healthy} />
        )}
      </div>
      <div className="pointer-events-none absolute bottom-5 right-5 z-10 flex items-center gap-4 rounded-full bg-[var(--surface)]/90 px-4 py-1.5 text-xs text-[var(--text-secondary)] shadow-sm">
        {(
          [
            ['Approved', FLIGHT_HEX.approved],
            ['Fraud', FLIGHT_HEX.fraud],
            ['Blocked', FLIGHT_HEX.blocked],
          ] as const
        ).map(([name, c]) => (
          <span key={name} className="flex items-center gap-1.5">
            <span className="h-[3px] w-3.5 rounded-full" style={{ backgroundColor: c }} />
            {name}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute right-5 top-5 z-10 text-xs text-[var(--text-secondary)]">Drag to turn</div>
    </>
  );
}
