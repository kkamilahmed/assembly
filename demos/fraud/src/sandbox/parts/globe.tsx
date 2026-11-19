// The whole globe with live traffic: starts the stream so flights fly.
import { useEffect } from 'react';
import { Globe } from '@/scene/globe/Globe';
import { initEngine } from '@/state/engine';

export default function GlobePart() {
  useEffect(() => {
    initEngine();
  }, []);
  return <Globe />;
}
