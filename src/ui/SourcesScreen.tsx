import { useShallow } from 'zustand/react/shallow';
import { sourceSeverity, useStore, worstSeverity, type Severity } from '@/state/store';
import {
  PROBLEM_SOURCE_ID,
  RISK_BASELINE,
  RISK_FLAG,
  SOURCE_IDS,
  SOURCE_LABELS,
  VELOCITY_RULE,
  type SourceId,
} from '@/streaming/networkConfig';
import { channelSeverity, channelSpec, formatReading, SIGNAL_CHANNELS } from '@/streaming/signalStream';
import { packetsToCharges } from './businessCase';
import { STATUS_HEX } from './colors';
import { FaultInjectionPanel } from './FaultInjectionPanel';
import { Kbd } from './Kbd';
import { AnalystOnShift, IncidentTimeline } from './Shift';
import { SignalCard, SourceIdentityCard } from './SourceCard';
import { ViewNav } from './ViewNav';
import type { View } from './views';

/** The sources screen: every source on the network with its live signals,
 *  the rules that judge them, and a diagnosis strip that says, in words,
 *  what the readings add up to. This is where the story finds the cause:
 *  the dashboard has shown fraud losses climbing, and this screen shows
 *  which merchant it is coming from and which rule is letting it through. */
export function SourcesScreen({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const faultPanelOpen = useStore((s) => s.faultPanelOpen);
  const setFaultPanelOpen = useStore((s) => s.setFaultPanelOpen);
  const manualInjections = useStore((s) => s.injections.filter((i) => i.source === 'manual').length);

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <div>
          <div className="text-sm font-semibold">Sources &amp; rules · Northgate Payments</div>
          <div className="text-xs text-[var(--text-secondary)]">Live signals from every source, and the rules that judge them</div>
        </div>
        <div className="ml-6">
          <AnalystOnShift />
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
          Inject signal fault
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
          {/* Fixed height in every state, so the cards below never jump as
              the diagnosis grows from one line to a full paragraph. */}
          <div className="h-40 shrink-0">
            <Diagnosis />
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.15fr)] grid-rows-[minmax(0,1fr)_auto] gap-4">
            {SOURCE_IDS.map((id) => (
              <SourceIdentityCard key={id} sourceId={id} />
            ))}
            <div className="row-span-2 min-h-0">
              <IncidentTimeline limit={8} />
            </div>
            {SOURCE_IDS.map((id) => (
              <SignalCard key={id} sourceId={id} />
            ))}
          </div>
          <Rules />
        </div>
        <FaultInjectionPanel />
      </div>
    </div>
  );
}

interface Evidence {
  sourceId: SourceId;
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
      for (const sourceId of SOURCE_IDS) {
        const source = s.sources[sourceId];
        if (source.status !== 'healthy') {
          out.push([sourceId, source.status, `approved risk ${(RISK_BASELINE + source.trend).toFixed(0)} (fraud above ${RISK_BASELINE + RISK_FLAG})`].join('|'));
        }
        for (const channel of SIGNAL_CHANNELS) {
          const value = s.signals[sourceId][channel];
          const severity = channelSeverity(sourceId, channel, value);
          if (severity === 'healthy') continue;
          const spec = channelSpec(sourceId, channel);
          out.push([sourceId, severity, `${spec.label.toLowerCase()} ${formatReading(sourceId, channel, value)} (limit ${spec.warn.toLocaleString('en-US')})`].join('|'));
        }
      }
      return out;
    }),
  );
  return rows.map((row) => {
    const [sourceId, severity, text] = row.split('|');
    return { sourceId: sourceId as SourceId, severity: severity as Severity, text };
  });
}

/** Approved charges at the problem merchant over the last five minutes, at
 *  the velocity it is approving them now, to the nearest hundred. */
function useFiveMinuteCharges(): number {
  return useStore((s) => Math.round((s.signals[PROBLEM_SOURCE_ID].velocity * 5) / 100) * 100);
}

/**
 * What the readings add up to, in words. Built only from what the stream
 * has measured - the signals out of limit, and the scores since the attack
 * began - so it never says more than the data does.
 */
function Diagnosis() {
  const evidence = useEvidence();
  const problemSeverity = useStore((s) => sourceSeverity(s, PROBLEM_SOURCE_ID));
  const incident = useStore((s) => s.incident);
  const frozen = useStore((s) => s.frozen);
  const autopilot = useStore((s) => s.autopilot);
  const readings = useStore((s) => s.signalPipeline.readings);
  const fiveMin = useFiveMinuteCharges();

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
          <div className="mt-0.5 text-base font-semibold">All {SOURCE_IDS.length} sources inside limits, every rule holding</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">
            Approval velocity, new cards and new devices at every source, plus a risk score on every payment, analysed as
            they stream.
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
  const problem = problemSeverity !== 'healthy';
  const open = incident !== null && incident.resolvedAt === null;
  const alarmed = [...new Set(evidence.map((e) => e.sourceId))];
  const wave = problem && alarmed.length > 1;

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
              {wave
                ? `Account-takeover wave across ${alarmed.length} sources, worst at ${SOURCE_LABELS[PROBLEM_SOURCE_ID]}`
                : problem
                  ? `${PROBLEM_SOURCE_ID} ${SOURCE_LABELS[PROBLEM_SOURCE_ID]}: card testing, and the ${VELOCITY_RULE.label.toLowerCase()} rule is letting it through`
                  : `${alarmed.length === 1 ? alarmed[0] : `${alarmed.length} sources`} reading outside limits`}
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {evidence.map((e) => (
                <li
                  key={`${e.sourceId}-${e.text.split(' ').slice(0, 2).join(' ')}`}
                  className="font-mono-ui rounded-md px-2 py-0.5 text-[11px]"
                  style={{ color: STATUS_HEX[e.severity], backgroundColor: `${STATUS_HEX[e.severity]}14` }}
                >
                  {alarmed.length > 1 ? `${e.sourceId} ` : ''}
                  {e.text}
                </li>
              ))}
            </ul>
            {problem && (
              <p className="mt-2 max-w-4xl text-xs leading-snug text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">
                  ≈{fiveMin.toLocaleString()} charges of $1 from new cards in 5 minutes.
                </span>{' '}
                Card testers check stolen numbers with tiny purchases before using them for real. The{' '}
                {VELOCITY_RULE.label.toLowerCase()} rule only trips above {VELOCITY_RULE.limitPerMin.toLocaleString()} charges a
                minute per merchant, so it approves every one: its threshold is set too loose.
                {wave && ' Stolen logins are paying at the other sources at the same time.'}
              </p>
            )}
          </div>

          {problem && (
            <div className="flex shrink-0 flex-col items-end gap-2 text-right">
              {open && (
                <div>
                  <div
                    className="font-mono-ui text-2xl font-semibold leading-none"
                    style={{ color: incident.fraudApproved ? STATUS_HEX.critical : undefined }}
                  >
                    {packetsToCharges(incident.fraudApproved).toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-secondary)]">fraudulent charges approved since onset</div>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs font-medium">
                {autopilot ? (
                  'Autopilot is refitting the rules'
                ) : frozen ? (
                  <>
                    Recommended: <Kbd>C</Kbd> recalibrate the rule
                  </>
                ) : (
                  <>
                    Recommended: <Kbd>S</Kbd> freeze merchant, <Kbd>C</Kbd> recalibrate the rule
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

interface RuleRow {
  id: string;
  label: string;
  detail: string;
  severity: Severity;
}

/** The production rules that decide what is approved, and whether each is
 *  holding. Derived from the same severities the source cards show. */
function useRules(): RuleRow[] {
  const problem = useStore((s) => sourceSeverity(s, PROBLEM_SOURCE_ID));
  const open = useStore((s) => s.incident !== null && s.incident.resolvedAt === null);
  const refitted = useStore((s) => s.sources[PROBLEM_SOURCE_ID].lastRecalibratedAt !== null);
  const takeover = useStore((s) =>
    worstSeverity(
      ...SOURCE_IDS.filter((id) => id !== PROBLEM_SOURCE_ID).map((id) => channelSeverity(id, 'newDevices', s.signals[id].newDevices)),
    ),
  );
  const velocity: Severity = open ? problem : 'healthy';
  return [
    {
      id: VELOCITY_RULE.id,
      label: VELOCITY_RULE.label,
      detail:
        velocity !== 'healthy'
          ? `${VELOCITY_RULE.limitPerMin.toLocaleString()}/min per merchant · too loose`
          : refitted
            ? 'Refitted to live traffic · blocking'
            : `${VELOCITY_RULE.limitPerMin.toLocaleString()}/min per merchant`,
      severity: velocity,
    },
    {
      id: 'DEV-NEW-02',
      label: 'New device, new payee',
      detail: takeover !== 'healthy' ? 'Logins from new devices rising' : 'Step-up on new device',
      severity: takeover,
    },
    { id: 'GEO-TRV-03', label: 'Impossible travel', detail: 'Two cities in under an hour', severity: 'healthy' },
    { id: 'AMT-HI-04', label: 'High value on a new card', detail: 'Over $900 in the first day', severity: 'healthy' },
  ];
}

function Rules() {
  const rules = useRules();
  return (
    <div className="grid shrink-0 grid-cols-4 gap-4">
      {rules.map((r) => {
        const color = STATUS_HEX[r.severity];
        const alarmed = r.severity !== 'healthy';
        return (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-lg border bg-[var(--surface)] px-3 py-2.5 transition-colors"
            style={{ borderColor: alarmed ? `${color}66` : 'var(--border)', boxShadow: alarmed ? `0 0 0 3px ${color}14` : undefined }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 0 3px ${color}26` }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-xs font-semibold">{r.label}</span>
                <span className="font-mono-ui ml-auto shrink-0 text-[10px] text-[var(--text-secondary)]">{r.id}</span>
              </div>
              <div className="truncate text-[11px]" style={{ color: alarmed ? color : 'var(--text-secondary)' }}>
                {r.detail}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
