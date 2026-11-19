export function fmtDuration(ms: number): string {
  const s = Math.abs(Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Sub-ten-second spans keep a decimal: "1.8s" says something "2s" doesn't. */
export function fmtSeconds(ms: number): string {
  if (ms < 100) return '<0.1s';
  return ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`;
}

export function fmtUsd(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}k`;
  return `$${usd}`;
}
