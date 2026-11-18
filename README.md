# Voltline Battery Plant - Real-Time Line Monitor

A React Three Fiber demo of an EV battery module line, driven by a **simulated** Kafka + Flink streaming pipeline and drawn as an isometric 3D illustration.
Module Line 1 builds 600 modules an hour, each one 24 cells welded together.
Cells are sorted in the dry room, stacked into a carrier by an orange robot, welded to their busbars by the LW-3 laser welder, checked by a weld camera, cased by a second robot and tested at the end of the line; passed modules go to self-driving AGVs, failed ones to the scrap cage.
The presenter knocks the laser's power off its setpoint from the keyboard, shows on the dashboard what it is costing, shows on the machines screen what the stream says is wrong, stops the line, fixes it, and then lets the line fix itself.

This branch (`battery`) is the battery-manufacturing version of the car body-shop demo on `main` and the bakery on `food-processing`.
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

The moral: because every weld is analysed as it streams, you can stop the line the moment the welds start to weaken and fix the laser, instead of finding out at the end-of-shift audit after thousands of scrapped cells, or worse, after a weak weld has slipped past the tester into a customer's car.

| Beat | Do | What the room sees |
|---|---|---|
| 1. The plant | Nothing. Talk. | Cells are sorted, stacked, welded under a pulsing blue-white laser, cased and tested; AGVs carry finished modules away. |
| 2. Something drifts | `D` | The laser's lens starts to fog and its power drifts about 9% low. The flash dims and warms, and weak modules leave the weld check with a red flag and are pushed into the scrap cage. |
| 3. The effect | `→` Dashboard | "Weak welds rising: 6 of the last 40 modules failed the weld check", the weld failure rate, modules scrapped, scrap cost per shift (about $98k at this rate), weld strength sliding toward its 180 N minimum, and the stakes: every failed module scraps 24 cells, and a weak weld that slips past the tester is a recall and fire risk. |
| 4. The cause | `←` `←` Machines | The LW-3 card is highlighted: power below setpoint and lens fogging over their limits, weld strength falling. "Laser power 9% low, welds not penetrating deep enough. Recommended: stop line, recalibrate laser." |
| 5. Stop and fix | `S`, then `C` | The line stops; the stop report shows how fast it was caught and what waiting would have cost. Recalibrating puts the laser back on its setpoint and weld strength recovers. |
| 6. Back to the line | `→` Plant, `A` | Autopilot restarts the line. Press `D` or `E` again: the stream flags the drift and the line trims the laser back onto its setpoint, the way it compensates as a lens ages, well under a second after detection. |

`E` is the emergency version of `D`: laser power collapses, every weld fails and the end-of-line tester sees a cell overheating; the machines screen recommends an emergency stop.

Nothing happens on its own; the line stays healthy until a key is pressed.
Only operator actions (Stop, Recalibrate, Autopilot) are on screen, so the audience never sees a "break it" button.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `D` | Slight deviation: laser power drifting low as the lens fogs |
| `E` | Emergency: laser power collapse, overheating cell on the tester |
| `S` | Stop / start the line |
| `C` | Recalibrate laser power |
| `A` | Run on autopilot (press again to turn it off) |
| `←` / `→` | Move between Machines, Plant, Dashboard |
| `F` | Manual sensor fault-injection panel (machines screen) |
| `R` | Reset the demo (autopilot stays as it was) |
| `Esc` | Close the topmost overlay |
| `?` | Shortcut overlay |

## How the fault is modelled

**The weld.**
Each module is welded at whatever the laser is doing as it leaves the welder, and the weld check scores the pull strength of its weakest busbar weld against a nominal 240 N and a minimum of 180 N (`streaming/lineConfig.ts`).
A slight drift leaves the average just above the minimum, so most welds hold and about one module in six fails; an emergency fails everything.
A module the weld check fails carries a red flag from the camera to the reject station, where it is pushed into the scrap cage.

**The welder's own sensors.**
A drift also moves LW-3's power below setpoint, lens fogging and optics temperature, and an emergency heats a cell on the end-of-line tester (`SENSOR_SIGNATURE` in `state/storyDirector.ts`).
Those stream every 0.9 s, which is why the machines screen reacts before the first weak module reaches the camera.

**Detection and autopilot act on the data, not on the script.**
"Detected" is stamped the first time the welder's combined condition (worst of its weld-strength trend and its sensors, `machineSeverity` in `state/store.ts`) leaves healthy, and the autopilot waits for that same condition.

**Every number on screen is measured.**
The stop report and the autopilot summary come from timestamps taken as things happened.
The end-of-shift projection converts the measured failure rate using the illustrative figures in `ui/businessCase.ts` (600 modules an hour, an 8-hour shift, 24 cells and $138 lost per scrapped module); set them to a customer's numbers before a talk.

## Presenter settings

- `?speed=2` runs the line and the fault at 2x, clamped to 0.5-3x.
- Weld noise is seeded (`presenter/rng.ts`) and reseeded on reset, so a rehearsal reproduces on stage. `?seed=1234` picks another seed, `?seed=random` opts out.
- `?still=1&shot=S01` (or `S02`) renders the scene alone, full window, with no UI. Used for screenshots. `&target=x,y,z&zoom=n` frames any detail instead.

## Architecture

```
src/
  streaming/   LineProducer (modules on the belt), DriftAnalyzer (Flink-style
               weld check + windowed weld-strength trend), SensorStream
               (per-machine sensors) - pure logic, no React/Three
  state/       store.ts (Zustand), engine.ts (the one file that wires
               streaming -> store), storyDirector.ts (presenter controls
               and the autopilot)
  scene/       Stage (iso camera, light, post FX), layout, Diorama (slab,
               walls, dry room, floor paint), machines/ (sorter, robot
               cells, laser welder, weld check, tester, reject station,
               AGV transfer), props/ (modules, AGVs, workers, stock),
               ui3d/ (status tags, brand sign), Modules (instanced), Line,
               Yard, Dressing
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
- The robots, the transfer gantry and the AGVs run their own cycles; they are choreographed to look right, not synchronised module by module with the stream.
- Under headless software rendering, resizing any WebGL canvas stalls the main thread for seconds. The machines screen keeps a fixed layout for this reason.
