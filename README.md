# Body Shop 2 — Weld Line Monitor

A React Three Fiber demo of an automotive body-shop weld line, driven by a
**simulated** Kafka + Flink streaming pipeline. Four robots — Underbody,
Side Panel L, Side Panel R, Roof — weld car shells moving down a line. One
robot's mechanical alignment drifts; a windowed drift analyzer catches it
trending toward tolerance before any single weld would fail a hard spec
check — and a line-wide "Live Vision QC" toggle demonstrates what's lost
the moment nobody's watching the stream between periodic manual checks.

## Quick start

```bash
npm install
npm run dev
```

A short scripted camera flythrough plays once on load, then hands off to
free orbit (drag to look around, scroll to zoom).

## The story

**Every weld is measured, always.** A per-robot windowed trend (Flink-style)
catches Robot `WELD-01` (Underbody) drifting out of alignment well before any
single weld would fail the hard ±1.2mm tolerance — an early "drift warning"
fires on the *trend*, not the raw defect. Click **Recalibrate** on the robot
card when it's recommended, and the drift resolves before it ever produces
a bad weld. Ignore it, and the drift keeps climbing until it crosses
critical and starts actually failing welds — cars get pulled into the
rework siding, visible in the 3D scene.

**The punchline: the "Live Vision QC" toggle.** Turn it off and nothing
mechanical changes — the robot's alignment keeps drifting exactly as
before — but the line reverts to how body shops verified welds before
continuous streaming inspection existed: a periodic manual sample (roughly
1 in 7 welds) instead of watching every one. The dashboard's displayed
trend freezes at its last sampled reading between checks, so it lags
behind what's actually happening. Ground truth keeps being computed
silently the whole time (never discarded, just not surfaced) — flip the
toggle back on and the gap between "what was shown" and "what was true"
gets revealed as a number: *N suspect welds shipped undetected while QC was
off.*

## Keyboard shortcuts

| Key | Action |
|---|---|
| `D` | Trigger the weld-drift scenario on demand |
| `R` | Reset the simulation |
| `Space` | Pause / resume |
| `Q` | Toggle live vision QC |
| `Esc` | Deselect the focused robot / close the shortcut overlay |
| `?` | Toggle the keyboard shortcut overlay |

## Architecture

```
src/
  streaming/   DriftAnalyzer (Flink-style, one per robot) + CarProducer
               (Kafka-style) — pure logic, no React/Three
  state/       Zustand store, state/engine.ts (the one file that wires
               streaming -> store), state/storyDirector.ts (the scripted
               narrative)
  scene/       R3F scene objects: line, robots, cars, sparks
  camera/      Scripted intro flythrough + waypoint data
  ui/          Tailwind dashboard: robot cards, event feed, rework list
  interactions/  Keyboard shortcuts
```

### Ground truth vs. displayed — the mechanism the whole demo rests on

`DriftAnalyzer` (`streaming/DriftAnalyzer.ts`) always computes a true,
windowed deviation trend from every weld — that never stops, on or off.
What changes with the "Live Vision QC" toggle is only whether that trend
reaches the operator: live, it tracks in real time; off, it only updates at
sampled inspection points (see `ingestWeld`). The store's `RobotState.status`
pill is purely derived from that *displayed* value
(`deriveStatus` in `state/store.ts`) — there's no separate "set status"
action, so the dashboard can't accidentally show something truer than what
was actually surfaced. The gap between the silently-tracked
`suspectWeldsGroundTruth` and the actually-`suspectWeldsCaught` count is
exactly what gets revealed when the toggle flips back on
(`state/engine.ts`).

### Why the story director and the camera are on separate clocks

`state/storyDirector.ts` runs on real `setTimeout`s, and `camera/CameraRig.tsx`
runs on `useFrame` deltas clamped per-frame — deliberately decoupled, so a
slow/software-rendered tab makes the picture choppier without ever changing
when the drift ramps, when recalibration auto-resolves, or how long the
recovery-reveal banner stays up.

### Recalibration cancels its own script

Clicking **Recalibrate** doesn't just zero the robot's bias — it cancels
the specific in-flight `setTimeout`s driving that robot's scripted ramp
(`recalibrateRobot` in `state/storyDirector.ts`), so an early manual fix
can't get silently overwritten a moment later by the ramp continuing on
its original schedule. A separate timer bucket carries the ambient
blips on the other robots, so cancelling one never touches the other.

## Swapping in a real Kafka/Flink backend

`state/engine.ts` is the only file that imports both `streaming/` and
`state/store.ts`. Replacing the simulators means replacing the
`CarProducer` / `DriftAnalyzer` construction at the top of that file with
something exposing the same `subscribe`/`ingest` surface (a WebSocket
bridge, most likely); nothing in `state/store.ts`, `scene/`, or `ui/` needs
to know the difference, since they only ever see the event shapes in
`streaming/types.ts`.

## Known limitations (this pass)

- The weld "spark" timing and the car mesh's position are both tuned from
  the same constants but aren't frame-exact — best-effort, like the
  scripted camera cues in the sibling fleet-monitor demo.
- A very long pause can let a robot's rolling drift-trend window empty out
  by wall-clock age even though the sim is conceptually frozen; short pauses
  (the expected use) are unaffected.
- No automatic quality step-down for low-end GPUs.
