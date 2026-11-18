// Selectors over the live-signal stream for the sources screen. The numbers
// themselves are generated in streaming/signalStream.ts and land in the
// store through state/engine.ts; nothing is computed here that a second
// component could compute differently.
import { sourceSeverity, useStore, type Severity } from '@/state/store';
import type { SourceId } from '@/streaming/networkConfig';
import type { FaultInjection, SignalChannel, SignalReading } from '@/streaming/signalStream';

export function useSignalReading(sourceId: SourceId): SignalReading {
  return useStore((s) => s.signals[sourceId]);
}

/** The dot on a source's card: the worst of the risk getting through and
 *  what its own signals say. */
export function useSourceSeverity(sourceId: SourceId): Severity {
  return useStore((s) => sourceSeverity(s, sourceId));
}

/** A fault somebody injected by hand from the panel. Scenario faults are
 *  deliberately not returned: they are the source genuinely under attack,
 *  and badging them would give the demo away. */
export function useChannelInjection(sourceId: SourceId, channel: SignalChannel): FaultInjection | undefined {
  return useStore((s) =>
    s.injections.find((i) => i.sourceId === sourceId && i.channel === channel && i.source === 'manual'),
  );
}
