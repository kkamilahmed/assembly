import type { ReactNode } from 'react';

export function Kbd({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'inverse' }) {
  return (
    <kbd
      className={`font-mono-ui inline-flex min-w-[1.25rem] items-center justify-center rounded px-1 py-0.5 text-[10px] font-semibold ${
        tone === 'inverse' ? 'bg-white/25 text-white' : 'bg-black/[0.06] text-[var(--text-secondary)]'
      }`}
    >
      {children}
    </kbd>
  );
}
