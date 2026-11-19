# Assembly Plant - Real-Time Line Monitor

A React Three Fiber demo of a car assembly line, driven by a **simulated** Kafka + Flink streaming pipeline.
Four stations (panel fitting, body weld, paint, wheel mount) build cars on a walking-beam conveyor.
The presenter knocks the weld robot off its seam from the keyboard, shows on the machines screen what the stream says is wrong, shows on the plant floor what it is costing, stops the line, fixes it, and then lets the line fix itself.

## Pick a demo

The same live fault-detection story is built for five industries, each on its own branch.
From this branch, run:

```bash
npm run demo
```

It asks which demo you want, checks out that branch (reusing an existing worktree, or creating one under `.demos/`), installs its dependencies on first run, and opens it in the browser.
To skip the menu, name it: `npm run demo -- fraud`.

| Name | Branch | Port | Demo |
|---|---|---|---|
| `car` | `main` | 5180 | Car assembly plant, the weld robot drifts off its seam |
| `bakery` | `food-processing` | 5181 | Golden Crust bakery, the oven runs hot and burns loaves |
| `battery` | `battery` | 5182 | Voltline EV battery plant, the laser welder drifts and welds go weak |
| `pharma` | `healthcare` | 5183 | Meridian Pharma tablet line, the press drifts and tablets come out underdosed |
| `fraud` | `fraud` | 5184 | Northgate Payments globe, card testing through TechDealz Online |

## Quick start

```bash
npm install
npm run dev
```

The app opens on the 3D plant.
A short scripted camera flythrough plays once, then hands off to free orbit (drag to look around, scroll to zoom).

## The story

The moral: because every reading is analysed as it streams, you can stop the line the moment something goes wrong and fix it, instead of finding out at the end-of-shift audit after hundreds of bad cars.

| Beat | Do | What the room sees |
|---|---|---|
| 1. The plant | Nothing. Talk. | Bare chassis arrive, get a body fitted, welded, painted and wheels mounted. Every car leaves the weld station with a green **passed** tag. |
| 2. Deviate | `D` | WELD-01's torch starts creeping off the seam. Its andon light and a callout above it go amber within a second or two, the header reads **Running - WELD-01 drifting**. |
| 3. Diagnose | `→` | The machines screen. WELD-01's card is highlighted, its vibration and temperature are climbing past their limits, and the diagnosis strip spells out what that combination means and what to do. |
| 4. The cost | `←` | Back on the plant floor, cars are failing weld QC and being pulled into the red **rework bay**, each tagged with its measured offset and glowing along the bad seam. Yield is dropping. |
| 5. Stop | `S` | The line stops. The stop report says how fast the fault was detected, how many cars it cost, and how many more an end-of-shift audit would have cost at the measured reject rate. |
| 6. Fix | `C` | WELD-01 is recalibrated. Sensors settle, the callout turns green. |
| 7. Autopilot | `A` | The line restarts on autopilot. Press `D` or `E` again: the stream flags the deviation and the line recalibrates itself in well under a second after detection, usually with zero cars lost and no downtime. |

`E` is the emergency version of `D`: the torch is knocked well off the seam in about a second and every car fails.
Pressing `E` during a slight deviation escalates the same incident rather than starting a new one.

Nothing happens on its own.
The line stays healthy until a key is pressed, so the presenter sets the pace.
Every key also exists as a button on the action bar at the bottom of the plant view, and the button the story wants next is highlighted.

## Keyboard shortcuts

Every key works from both screens.

| Key | Action |
|---|---|
| `D` | Slight deviation on WELD-01 |
| `E` | Emergency: WELD-01 knocked off the seam |
| `S` | Stop / start the line |
| `C` | Recalibrate WELD-01 |
| `A` | Run on autopilot (press again to turn it off) |
| `→` / `←` | Machines screen / plant |
| `M` | Toggle plant / machines |
| `F` | Manual sensor fault-injection panel (machines screen) |
| `R` | Reset the demo (autopilot stays as it was) |
| `Esc` | Close the topmost overlay |
| `?` | Shortcut overlay |

## How the fault is modelled

A deviation is one mechanical cause with two measurable effects, and the demo models both.

**The weld offset.**
`state/storyDirector.ts` ramps WELD-01's torch offset to `DEVIATION_OFFSET_MM` (`streaming/lineConfig.ts`).
Every car through the weld station is measured as that offset plus normal process noise, and fails QC beyond the 1.2mm spec.
Slight sits at 1.25mm, just past the limit, so roughly one car in three still squeaks through and the line looks mostly fine while it fills the rework bay.
Emergency sits at 2.3mm and fails everything.

**The arm's own sensors.**
A torch dragged off its seam shakes and heats the wrist, so each level also puts a signature on WELD-01's vibration, temperature and pressure (`SENSOR_SIGNATURE` in `storyDirector.ts`).
Those readings stream every 0.9s, which is why the machines screen and the andon light react before the next car even reaches the weld station.

**Detection and autopilot act on the data, not on the script.**
"Detected" is stamped the first time WELD-01's combined condition (worst of its weld trend and its sensors, `machineSeverity` in `state/store.ts`) leaves healthy.
The autopilot waits for that same condition and then recalibrates.
Neither reads what the story director did.

**Every number on screen is measured.**
The incident record stamps when the fault started, when it was detected, when the line was stopped and how many cars were welded and rejected in between.
The stop report and the autopilot summary are computed from those stamps.
The end-of-shift projection converts the measured reject rate into a real line's terms using the illustrative figures in `ui/businessCase.ts` (60 cars an hour, an 8-hour shift, $1,800 per reject); set them to a customer's numbers before a talk.

## Presenter settings

- `?speed=2` runs the line and the fault at 2x, clamped to 0.5-3x. Schedules scale, geometry does not.
- Weld process noise is seeded (`presenter/rng.ts`) and reseeded on every reset, so a rehearsal reproduces on stage. `?seed=1234` picks a different seed, `?seed=random` opts out.

## Manual sensor faults

The machines screen also has a manual fault-injection panel (`F`): pick any machines and sensors, set an intensity and press **Inject**.
These are separate from the story: they move sensor readings only, no car is affected, and they are badged `INJ` on the cards so nobody mistakes one for a real fault.
The story's own sensor signature is deliberately not badged and not listed in the panel.

## Architecture

```
src/
  streaming/   CarProducer (Kafka-style conveyor + weld measurements),
               DriftAnalyzer (Flink-style windowed weld trend + QC),
               SensorStream (per-machine process sensors) - pure logic
  state/       store.ts (Zustand), engine.ts (the one file that wires
               streaming -> store), storyDirector.ts (the presenter's
               controls and the autopilot)
  scene/       R3F scene: line, robots, parametric car, rework bay
  camera/      Scripted intro flythrough + waypoints
  ui/          Plant top bar, action bar and overlays; machines screen
  interactions/  Keyboard shortcuts
```

Both screens stay mounted for the whole session.
The plant keeps running while the presenter is on the machines screen, and coming back does not replay the camera intro.
Whichever screen is hidden stops rendering frames.

The car is built parametrically in `scene/carModel.ts`: a generic five-door hatch whose parts (chassis, body shell, glass, wheels) are named and positioned in the same frame the station targets use, so there is no imported mesh to fit or search.

## Swapping in a real Kafka/Flink backend

`state/engine.ts` is the only file that imports both `streaming/` and `state/store.ts`.
Replacing the simulators means replacing the `CarProducer` / `DriftAnalyzer` / `SensorStream` construction at the top of that file with something exposing the same listener surface (a WebSocket bridge, most likely).
Nothing in `state/store.ts`, `scene/` or `ui/` needs to know the difference, since they only ever see the event shapes in `streaming/types.ts`.

## Known limitations

- Weld spark timing and the car's position are tuned from the same constants but are not frame-exact.
- No automatic quality step-down for low-end GPUs.
- Under headless software rendering, resizing any WebGL canvas stalls the main thread for seconds. The machines screen keeps a fixed layout for exactly this reason; keep it that way when changing it.
