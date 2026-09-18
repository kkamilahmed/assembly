import { Html } from '@react-three/drei';
import type { CarVerdict } from '@/state/store';
import { STATUS_HEX } from '@/ui/colors';

/**
 * The verdict floating above one car, in the 3D scene.
 *
 * This exists because the demo's entire argument used to be invisible. A
 * robot drifting a fraction of a millimetre looks like nothing, so an
 * audience watching the line saw four arms working normally while the
 * actual story played out as numbers in a sidebar chart nobody at the back
 * of the room can read. The tag puts the state of every car where the car
 * is.
 *
 * The important one is `uninspected`. It is deliberately drawn as an empty
 * outline rather than a symbol: nothing is known about that weld, and under
 * spot checks that is six cars out of every seven. A line of grey outlines
 * moving past is the blind window, made into something you can point at.
 */
const STYLE: Record<
  Exclude<CarVerdict, 'none'>,
  { label: string; text: string; bg: string; border: string; glyph: string }
> = {
  pass: { label: 'inspected', text: '#fff', bg: STATUS_HEX.healthy, border: STATUS_HEX.healthy, glyph: '✓' },
  fail: { label: 'out of spec', text: '#fff', bg: STATUS_HEX.critical, border: STATUS_HEX.critical, glyph: '✕' },
  uninspected: { label: 'not inspected', text: '#6b7280', bg: 'rgba(255,255,255,0.82)', border: '#9aa0a8', glyph: '?' },
  revealed: { label: 'shipped bad', text: '#fff', bg: STATUS_HEX.critical, border: '#7d1f18', glyph: '✕' },
};

export function CarTag({ verdict, y, shipped }: { verdict: CarVerdict; y: number; shipped: boolean }) {
  if (verdict === 'none') return null;
  const s = STYLE[verdict];
  // A car's label depends on whether it has actually left the line yet.
  // Parked in the shipped bay, "not inspected" understates it: that car did
  // not merely go unchecked, it left the building unchecked. Still on the
  // line, "shipped bad" overstates it: that one is defective but has not
  // gone anywhere, and it is still catchable.
  const label =
    verdict === 'uninspected'
      ? shipped
        ? 'shipped unchecked'
        : s.label
      : verdict === 'revealed'
        ? shipped
          ? 'shipped bad'
          : 'bad, missed'
        : s.label;

  return (
    <Html
      position={[0, y, 0]}
      center
      // Scales with camera distance so the tag stays legible when the view
      // pulls back to take in the whole line, without ballooning up close.
      distanceFactor={19}
      // Tags are a readout, not a control — never let one eat a drag meant
      // for the orbit controls underneath it.
      style={{ pointerEvents: 'none', userSelect: 'none' }}
      zIndexRange={[20, 0]}
    >
      <div
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2.5 py-1 text-[13px] font-semibold shadow-md ${
          verdict === 'revealed' ? 'animate-card-pulse' : ''
        }`}
        style={{ backgroundColor: s.bg, borderColor: s.border, color: s.text, ['--pulse-color' as string]: `${STATUS_HEX.critical}66` }}
      >
        <span className="text-[15px] leading-none">{s.glyph}</span>
        <span>{label}</span>
      </div>
    </Html>
  );
}
