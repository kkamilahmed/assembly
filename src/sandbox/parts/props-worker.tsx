// Every worker pose side by side, for judging the figures up close.
import { Worker, type WorkerPose } from '@/scene/props/Worker';

const POSES: WorkerPose[] = ['stand', 'tablet', 'carry', 'carry', 'push', 'inspect', 'walk'];

export const view = { target: [0, 0.85, 0] as [number, number, number], zoom: 300 };

export default function PropsWorker() {
  return (
    <group>
      {POSES.map((pose, i) => (
        <Worker
          key={i}
          pose={pose}
          skin={i % 4}
          seed={i + 1}
          vest={i === 4 || i === 6}
          carrying={i === 3 ? 'tray' : 'box'}
          position={[(i - 3) * 0.5, 0, -(i - 3) * 0.5]}
          rotation-y={-Math.PI / 4 + 0.5}
        />
      ))}
    </group>
  );
}
