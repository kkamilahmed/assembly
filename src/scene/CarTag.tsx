import { Html } from '@react-three/drei';
import type { CarVerdict } from '@/state/store';
import { STATUS_HEX } from '@/ui/colors';

/**
 * The weld QC verdict floating above one car. A torch a millimetre off its
 * seam looks like nothing from the back of a room, so the result is put
 * where the car is: a small green tick for a good weld, and a red tag with
 * the measured offset for a car pulled into the rework bay.
 */
export function CarTag({
  verdict,
  deviationMm,
  y,
  inBay,
}: {
  verdict: CarVerdict;
  deviationMm: number | null;
  y: number;
  inBay: boolean;
}) {
  if (verdict === 'none') return null;
  const fail = verdict === 'fail';
  const offset = deviationMm === null ? '' : `${deviationMm > 0 ? '+' : ''}${deviationMm.toFixed(2)}mm`;

  return (
    <Html
      position={[0, y, 0]}
      center
      // Scales with camera distance so the tag stays legible when the view
      // pulls back to take in the whole line, without ballooning up close.
      distanceFactor={19}
      // A readout, not a control - never eat a drag meant for the orbit
      // controls underneath it.
      style={{ pointerEvents: 'none', userSelect: 'none' }}
      zIndexRange={[20, 0]}
    >
      {fail ? (
        <div
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2.5 py-1 text-[13px] font-semibold text-white shadow-md ${
            inBay ? '' : 'animate-card-pulse'
          }`}
          style={{
            backgroundColor: STATUS_HEX.critical,
            borderColor: '#7d1f18',
            ['--pulse-color' as string]: `${STATUS_HEX.critical}66`,
          }}
        >
          <span className="text-[15px] leading-none">✕</span>
          <span>weld {offset}</span>
        </div>
      ) : (
        <div
          className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: STATUS_HEX.healthy }}
        >
          <span className="leading-none">✓</span>
          <span>passed</span>
        </div>
      )}
    </Html>
  );
}
