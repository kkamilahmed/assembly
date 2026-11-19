# Meridian Pharma - Real-Time Tablet Line Monitor

A React Three Fiber demo of a pharmaceutical tablet line, driven by a **simulated** Kafka + Flink streaming pipeline and drawn as an isometric 3D illustration.
Tablet Line 2 makes blood pressure tablets, 120,000 an hour.
Powder is blended, compressed into tablets on press P-2, film-coated in a coating drum, weighed and photographed at inspection, sealed into blister cards and cartoned, and the cartons go to the cold store and out on refrigerated trucks.
The presenter knocks the press out of calibration from the keyboard, shows on the dashboard what it is doing to the batch, shows on the machines screen which machine is doing it and why, stops the line, fixes it, and then lets the line fix itself.

This branch (`healthcare`) is the pharmaceutical version of the bakery demo on `food-processing`.
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

The moral: because every tray is weighed and every sensor analysed as it streams, you can stop the press the moment it starts underdosing and quarantine a few minutes of output, instead of finding out at batch release and recalling two million tablets.

| Beat | Do | What the room sees |
|---|---|---|
| 1. The plant | Nothing. Talk. | Staff in gowns, hoods and masks run the clean room. The press turns, trays of white tablets ride through the coating drum, past the inspection camera, into the blister packer, and come out as foil cards on their way to the cartoner. |
| 2. Something drifts | `D` | Press P-2's fill depth starts to drift. On the plant the tablets come out thinner, inspection turns underweight trays red and the gate diverts them into the reject bin. |
| 3. The effect | `→` Dashboard | "Tablets underdosed", the out-of-spec share of the batch rising, 2.0M tablets at risk, a $420k recall, "patients would get up to 8% less medicine than prescribed", tablet weight sliding through the 245 mg lower limit, the output bars turning red. |
| 4. The cause | `←` `←` Machines | The press card is flagged: fill depth drifting, compression force down 11%, punch 14 worn. "Recommended: stop line, recalibrate fill depth." |
| 5. Stop and fix | `S`, then `C` | The line stops and the last 10 minutes of output are quarantined: the trays still on the belt are pulled off with it. The stop report shows how fast it was caught and what it avoided. Recalibrating puts the fill depth, and the tablet weight, back on target. |
| 6. Back to the line | `→` Plant, `A` | Autopilot restarts the line. Press `D` or `E` again: the stream flags the press and the autopilot holds tablet weight on target well under a second after detection. |

`E` is the emergency version of `D`: a pressure spike, the press starts jamming, and every tray is badly underweight.

Nothing happens on its own; the line stays healthy until a key is pressed.
Only operator actions (Stop, Recalibrate, Autopilot) are on screen, so the audience never sees a "break it" button.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `D` | Slight deviation: press P-2 fill depth drifting |
| `E` | Emergency: pressure spike, press jamming |
| `S` | Stop / start the line (stopping quarantines the last 10 minutes) |
| `C` | Recalibrate the press fill depth |
| `A` | Run on autopilot (press again to turn it off) |
| `←` / `→` | Move between Machines, Plant, Dashboard |
| `F` | Manual sensor fault-injection panel (machines screen) |
| `R` | Reset the demo (autopilot stays as it was) |
| `Esc` | Close the topmost overlay |
| `?` | Shortcut overlay |

## How the fault is modelled

**The weight.**
Each tray of 24 tablets is pressed at whatever weight the press is making as it fills, and inspection weighs a sample from it against a label claim of 250 mg with a tolerance of 5 mg (`streaming/lineConfig.ts`).
A slight drift slides the weight through the 245 mg lower limit and keeps going, to 8% under the label claim if nobody acts; an emergency drops it further, fast.
The tablets on the belt are drawn thinner from the same number, so what you see on the belt is what inspection measured.

**The press's own sensors.**
A drift also moves the press's fill depth and compression force down (and, in an emergency, spikes its ejection force) (`SENSOR_SIGNATURE` in `state/storyDirector.ts`).
Those stream every 0.9 s, which is why the machines screen reacts before the first underweight tray reaches inspection.
Channels can fail upward or downward (`low` in `streaming/sensorStream.ts`).

**Detection and autopilot act on the data, not on the script.**
"Detected" is stamped the first time the press's combined condition (worst of its weight trend and its sensors, `machineSeverity` in `state/store.ts`) leaves healthy, and the autopilot waits for that same condition.

**The output bars are bucketed by inspection time.**
Every station event carries the moment the tray reached the station, and the dashboard's bars count each tray in the 5 s interval it was judged in, on the line's own clock. A busy tab cannot pile intervals into one bar, and a stopped line adds nothing.

**Every timing on screen is measured.**
The stop report and the autopilot summary come from timestamps taken as things happened.
The out-of-spec share and the "up to X% less medicine" figure come from the trays weighed.
Batch size, recall cost and the quarantine window are illustrative figures in `ui/businessCase.ts` (120,000 tablets an hour, a 2.0M tablet batch, a $420k recall, 10 minutes quarantined); set them to a customer's numbers before a talk.

## Presenter settings

- `?speed=2` runs the line and the fault at 2x, clamped to 0.5-3x.
- Weight noise is seeded (`presenter/rng.ts`) and reseeded on reset, so a rehearsal reproduces on stage. `?seed=1234` picks another seed, `?seed=random` opts out.
- `?still=1&shot=S01` (or `S02`) renders the scene alone, full window, with no UI. Used for screenshots. `&target=x,y,z&zoom=n` frames a close-up.

## Architecture

```
src/
  streaming/   LineProducer (trays on the belt), DriftAnalyzer (Flink-style
               inspection + windowed weight trend), SensorStream
               (per-machine sensors) - pure logic, no React/Three
  state/       store.ts (Zustand), engine.ts (the one file that wires
               streaming -> store), storyDirector.ts (presenter controls
               and the autopilot)
  scene/       Stage (iso camera, light, post FX), layout, Diorama (slab,
               walls, glazing, airlock, compression suite, floor paint),
               machines/, props/, ui3d/ (status tags, brand sign),
               Tablets (instanced trays and blister cards), Line, Yard,
               Dressing
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
- Workers are about 45 meshes each without instancing; fine for the ~25 on screen.
- The machines screen runs six small WebGL canvases at once; under headless software rendering screenshots of it are slow.
- Under headless software rendering, resizing any WebGL canvas stalls the main thread for seconds. The machines screen keeps a fixed layout for this reason.
