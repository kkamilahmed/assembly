// The big boards on the back walls, the way R01 hangs its charts: the
// network's own numbers, printed large enough to read from the back of the
// room. They set the scene; the live numbers are in the status tags and on
// the dashboard.
import { useCallback } from 'react';
import { PALETTE } from '@/scene/style';
import { font, INK } from './kit';
import { Panel } from './Panel';
import { WALL_FACE_X, WALL_FACE_Z } from './wallFrame';

const ON_X_WALL: [number, number, number] = [0, Math.PI / 2, 0];

function header(ctx: CanvasRenderingContext2D, title: string, sub: string) {
  ctx.fillStyle = INK.ink;
  ctx.font = font(700, 30);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, 28, 48);
  ctx.fillStyle = INK.muted;
  ctx.font = font(500, 20);
  ctx.fillText(sub, 28, 76);
}

function line(ctx: CanvasRenderingContext2D, pts: number[], x0: number, y0: number, w: number, h: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach((v, i) => {
    const x = x0 + (w * i) / (pts.length - 1);
    const y = y0 + h - v * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = color;
  pts.forEach((v, i) => {
    if (i % 3) return;
    ctx.beginPath();
    ctx.arc(x0 + (w * i) / (pts.length - 1), y0 + h - v * h, 6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function grid(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, rows = 4) {
  ctx.strokeStyle = INK.grid;
  ctx.lineWidth = 2;
  for (let i = 0; i <= rows; i++) {
    const y = y0 + (h * i) / rows;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + w, y);
    ctx.stroke();
  }
}

function PaymentsBoard() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(0, 0, w, h);
    header(ctx, 'Payments per second', 'Card present and online, today');
    const x0 = 30;
    const y0 = 100;
    const cw = w - 60;
    const ch = h - 130;
    grid(ctx, x0, y0, cw, ch);
    line(ctx, [0.42, 0.5, 0.46, 0.58, 0.66, 0.6, 0.72, 0.8, 0.74, 0.86, 0.82, 0.9, 0.84], x0, y0, cw, ch, PALETTE.orange);
    line(ctx, [0.2, 0.26, 0.3, 0.28, 0.36, 0.4, 0.38, 0.46, 0.5, 0.48, 0.56, 0.6, 0.58], x0, y0, cw, ch, PALETTE.blue);
  }, []);
  return <Panel position={[WALL_FACE_X, 4.95, -4.65]} rotation={ON_X_WALL} width={4.4} height={1.7} draw={draw} />;
}

function KpiBoard() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(0, 0, w, h);
    header(ctx, 'The network', 'Scored as they stream');
    const tiles: Array<[string, string, string]> = [
      ['3,000', 'payments a second', PALETTE.orange],
      ['38 ms', 'to score each one', PALETTE.blue],
      ['4', 'sources on this block', PALETTE.healthy],
    ];
    const pitch = (h - 110) / 3;
    tiles.forEach(([big, small, c], i) => {
      const y = 100 + i * pitch;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(28, y + 6, 12, pitch - 18, 6);
      ctx.fill();
      ctx.fillStyle = INK.ink;
      ctx.font = font(800, 40);
      ctx.fillText(big, 56, y + 40);
      ctx.fillStyle = INK.sub;
      ctx.font = font(500, 19);
      ctx.fillText(small, 58, y + 63);
    });
  }, []);
  return <Panel position={[WALL_FACE_X, 3.75, 0.75]} rotation={ON_X_WALL} width={2.8} height={2.6} draw={draw} />;
}

function MixBoard() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(0, 0, w, h);
    header(ctx, 'Payment mix', 'Today');
    const cx = w * 0.3;
    const cy = h * 0.6;
    const r = Math.min(w, h) * 0.26;
    const parts: Array<[number, string]> = [
      [0.4, PALETTE.blue],
      [0.35, PALETTE.orange],
      [0.17, PALETTE.healthy],
      [0.08, PALETTE.amber],
    ];
    let a = -Math.PI / 2;
    ctx.lineWidth = r * 0.42;
    for (const [f, c] of parts) {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a + 0.03, a + f * Math.PI * 2 - 0.03);
      ctx.stroke();
      a += f * Math.PI * 2;
    }
    const labels = ['Online', 'Contactless', 'Chip', 'Cash'];
    labels.forEach((l, i) => {
      ctx.fillStyle = parts[i][1];
      ctx.beginPath();
      ctx.roundRect(w * 0.58, h * 0.36 + i * 34, 18, 18, 4);
      ctx.fill();
      ctx.fillStyle = INK.sub;
      ctx.font = font(600, 20);
      ctx.fillText(l, w * 0.58 + 28, h * 0.36 + i * 34 + 16);
    });
  }, []);
  return <Panel position={[WALL_FACE_X, 3.8, 5.25]} rotation={ON_X_WALL} width={2.7} height={1.6} draw={draw} />;
}

function RiskBoard() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(0, 0, w, h);
    header(ctx, 'Risk score, every payment', 'Almost everything scores low; fraud lives in the tail');
    const bars = [0.3, 0.75, 1, 0.82, 0.55, 0.34, 0.2, 0.12, 0.08, 0.06, 0.05, 0.07];
    const x0 = 30;
    const y0 = 110;
    const cw = w - 60;
    const ch = h - 140;
    grid(ctx, x0, y0, cw, ch, 3);
    const bw = cw / bars.length;
    bars.forEach((v, i) => {
      ctx.fillStyle = i >= 9 ? PALETTE.critical : i >= 6 ? PALETTE.amber : PALETTE.blue;
      ctx.beginPath();
      ctx.roundRect(x0 + i * bw + 6, y0 + ch - v * ch, bw - 12, v * ch, 6);
      ctx.fill();
    });
  }, []);
  return <Panel position={[4.45, 3.95, WALL_FACE_Z]} width={4.6} height={2.3} draw={draw} />;
}

export function WallBoards() {
  return (
    <group>
      <PaymentsBoard />
      <KpiBoard />
      <MixBoard />
      <RiskBoard />
    </group>
  );
}
