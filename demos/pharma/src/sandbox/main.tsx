// Dev-only sandbox for building one part of the plant in isolation, under
// the same studio stage as the real scene. Open /sandbox.html?part=<name>,
// where <name> is a file in ./parts. Each part file default-exports a
// component and may export `view = { target, zoom }` to frame it.
import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';
import '../index.css';
import { ShadowFloor, Stage } from '@/scene/Stage';

interface PartModule {
  default: ComponentType;
  view?: { target?: [number, number, number]; zoom?: number };
}

const parts = import.meta.glob<PartModule>('./parts/*.tsx', { eager: true });
const name = new URLSearchParams(location.search).get('part') ?? '';
const mod = parts[`./parts/${name}.tsx`];

function App() {
  if (!mod) {
    return (
      <pre style={{ padding: 24 }}>
        {`Unknown part "${name}". Available:\n` + Object.keys(parts).map((p) => p.slice(8, -4)).join('\n')}
      </pre>
    );
  }
  const Part = mod.default;
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Stage target={mod.view?.target} zoom={mod.view?.zoom ?? 60} shadowSize={14}>
        <ShadowFloor />
        <Part />
      </Stage>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
