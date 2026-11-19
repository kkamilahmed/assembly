// Dev-only sandbox for building one part of the globe in isolation, under
// the same studio as the real scene. Open /sandbox.html?part=<name>, where
// <name> is a file in ./parts. Each part file default-exports a component.
import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';
import '../index.css';
import { GlobeStage } from '@/scene/globe/GlobeStage';

interface PartModule {
  default: ComponentType;
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
      <GlobeStage>
        <Part />
      </GlobeStage>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
