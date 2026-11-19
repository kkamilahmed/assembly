# Goldcrust Bakery - Real-Time Line Monitor

A React Three Fiber demo of a bakery production line, driven by a **simulated** Kafka + Flink streaming pipeline and drawn as an isometric 3D illustration.
Dough is mixed, baked in a tunnel oven, scored by vision inspection, and packed into cartons that leave on trucks.
The presenter knocks the oven off its setpoint from the keyboard, shows on the machines screen what the stream says is wrong, shows on the plant floor what it is costing, stops the line, fixes it, and then lets the line fix itself.

This branch (`food-processing`) is the food-industry version of the car body-shop demo on `main`.
The story and controls are the same.

## Quick start

```bash
npm install
npm run dev
```

The app opens on the plant.
Drag to pan and scroll to zoom; the view never rotates off the isometric angle.

## The story

Three screens, left to right: **Machines | Plant | Dashboard**. The arrow keys walk between them and the app opens on the plant.
The plant shows the line, the dashboard shows what it is producing (the effect), and the machines screen shows which machine is doing it and why (the cause).

The moral: because every reading is analysed as it streams, you can stop the line the moment something goes wrong and fix it, instead of finding out at the end-of-shift audit after thousands of burnt loaves.

| Beat | Do | What the room sees |
|---|---|---|
| 1. The plant | Nothing. Talk. | Dough drops from the mixer, rises and browns through the glowing tunnel oven, passes the vision gantry and is packed into cartons. |
| 2. Something drifts | `D` | The oven starts running hot. On the plant, loaves come out darker and the reject pusher starts kicking them into the red bin. |
| 3. The effect | `→` Dashboard | "Burnt loaves rising: 15 of the last 31 came out burnt", the output bars turning red, browning over the limit, and "If nothing changes, by end of shift: ≈14,000 kg of dough wasted". |
| 4. The cause | `←` `←` Machines | The oven card is highlighted: zone 2 temperature and burner output over their limits. "Running over setpoint, over-baking loaves. Recommended: stop line, recalibrate oven." |
| 5. Stop and fix | `S`, then `C` | The line stops; the stop report shows how fast it was caught and what waiting would have cost. Recalibrating puts the oven back on setpoint. |
| 6. Back to the line | `→` Plant, `A` | Autopilot restarts the line. Press `D` or `E` again: the stream flags the drift and the oven is put back on setpoint well under a second after detection. |

`E` is the emergency version of `D`: a burner runaway, and every loaf burns.

Nothing happens on its own; the line stays healthy until a key is pressed.
Only operator actions (Stop, Recalibrate, Autopilot) are on screen, so the audience never sees a "break it" button.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `D` | Slight deviation: oven zone 2 running hot |
| `E` | Emergency: oven burner runaway |
| `S` | Stop / start the line |
| `C` | Recalibrate the oven |
| `A` | Run on autopilot (press again to turn it off) |
| `←` / `→` | Move between Machines, Plant, Dashboard |
| `F` | Manual sensor fault-injection panel (machines screen) |
| `R` | Reset the demo (autopilot stays as it was) |
| `Esc` | Close the topmost overlay |
| `?` | Shortcut overlay |

## How the fault is modelled

**The bake.**
Each loaf is baked at whatever the oven is doing as it leaves the tunnel, and vision inspection scores its crust browning against a target of 50 with a tolerance of 8 (`streaming/lineConfig.ts`).
A slight drift sits just past the tolerance, so about one loaf in three still passes; an emergency burns everything.
Loaf colour on the belt is drawn from the same number, so what the camera sees is what the inspection measured.

**The oven's own sensors.**
A drift also moves the oven's zone temperature and burner output (`SENSOR_SIGNATURE` in `state/storyDirector.ts`).
Those stream every 0.9 s, which is why the machines screen reacts before the first over-baked loaf reaches the camera.

**Detection and autopilot act on the data, not on the script.**
"Detected" is stamped the first time the oven's combined condition (worst of its browning trend and its sensors, `machineSeverity` in `state/store.ts`) leaves healthy, and the autopilot waits for that same condition.

**Every number on screen is measured.**
The stop report and the autopilot summary come from timestamps taken as things happened.
The end-of-shift projection converts the measured reject rate using the illustrative figures in `ui/businessCase.ts` (4,000 loaves an hour, an 8-hour shift, $1.20 per rejected loaf); set them to a customer's numbers before a talk.

## Presenter settings

- `?speed=2` runs the line and the fault at 2x, clamped to 0.5-3x.
- Bake noise is seeded (`presenter/rng.ts`) and reseeded on reset, so a rehearsal reproduces on stage. `?seed=1234` picks another seed, `?seed=random` opts out.
- `?still=1&shot=S01` (or `S02`) renders the scene alone, full window, with no UI. Used for screenshots.

## Architecture

```
src/
  streaming/   LineProducer (loaves on the belt), DriftAnalyzer (Flink-style
               inspection + windowed browning trend), SensorStream
               (per-machine sensors) - pure logic, no React/Three
  state/       store.ts (Zustand), engine.ts (the one file that wires
               streaming -> store), storyDirector.ts (presenter controls
               and the autopilot)
  scene/       Stage (iso camera, light, post FX), layout, Diorama (slab,
               walls, floor paint), machines/, props/, ui3d/ (status
               tags, brand sign), Loaves (instanced), Line, Yard, Dressing
  ui/          Top bar, action bar, overlays, machines and dashboard screens
  sandbox/     Dev-only page for building one scene part in isolation:
               /sandbox.html?part=<name>
```

Every mesh, material and texture is built in code; there are no model files and no runtime network fetches.
All colours and material factories live in `scene/style.ts`, and every position in `scene/layout.ts`.

## Swapping in a real Kafka/Flink backend

`state/engine.ts` is the only file that imports both `streaming/` and `state/store.ts`.
Replacing the simulators means replacing the `LineProducer` / `DriftAnalyzer` / `SensorStream` construction there with something exposing the same listener surface; nothing in `state/store.ts`, `scene/` or `ui/` needs to know.

## Known limitations

- Visual quality was tuned in headless software rendering; check frame rate on the presenting machine before a talk.
- Workers are about 45 meshes each without instancing; fine for the ~20 on screen.
- Under headless software rendering, resizing any WebGL canvas stalls the main thread for seconds. The machines screen keeps a fixed layout for this reason.
