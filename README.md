# Body Shop 2 — Weld Line Monitor

A React Three Fiber demo of an automotive body-shop weld line, driven by a
**simulated** Kafka + Flink streaming pipeline. Four robots — Underbody,
Side Panel L, Side Panel R, Roof — weld car shells moving down a line. One
robot's mechanical alignment drifts; a windowed drift analyzer catches it
trending toward tolerance before any single weld would fail a hard spec
check.
A line-wide inspection-mode switch (every weld / 1 in 7) demonstrates what
is lost the moment nobody is watching the stream between periodic manual
checks.

## Quick start

```bash
npm install
npm run dev
```

A short scripted camera flythrough plays once on load, then hands off to
free orbit (drag to look around, scroll to zoom).

## The story

**Every weld is measured, always.**
A per-robot windowed trend (Flink-style) catches Robot `WELD-01` (Body Weld) drifting out of alignment before any single weld fails the hard +/-1.2mm spec check.
The alert fires on the *trend*, not on a raw defect.

The lead time that buys you is the whole point, so it is a tuned property of the system rather than an accident.
The two trend thresholds are SPC-style control limits on the windowed mean absolute deviation (0.25mm warn, 0.42mm critical), deliberately set far below the 1.2mm spec limit.
Against the scripted ramp in `state/storyDirector.ts` that yields a median of roughly 24 seconds - worst case about 19 - between `drift_critical` firing and the first weld that could actually breach tolerance.

Click **Recalibrate** on the robot card when it is recommended and the drift resolves before it ever produces a bad weld.
Ignore it and the drift keeps climbing until welds start genuinely failing, and cars get pulled into the rework siding, visible in the 3D scene.

### These constants are one system, not independent knobs

`WARN_TREND_MM` / `CRITICAL_TREND_MM` / `TREND_WINDOW_MS` in `streaming/lineConfig.ts` and `DRIFT_PEAK_MM` / `RAMP_UP_MS` in `state/storyDirector.ts` are tuned together against a single requirement: critical has to fire while every individual weld is still in spec, with usable time left over.

A trailing-window mean lags the physical drift by roughly half the window, so a ramp that is steep relative to the window eats the entire warning.
An earlier version of this demo (peak 1.55mm over 50s, thresholds 0.55/0.85, 30s window) failed exactly that way: `drift_critical` landed in the same 4.8s line cycle as the first out-of-spec weld, giving zero warning, while 58% of all cars built came out as scrap.
If you change the ramp shape or the window, re-check the lead time before trusting the narration.

Process noise (`WELD_PROCESS_SIGMA_MM`, 0.12mm) is tight relative to the spec limit on purpose.
It makes a drifting process *mean*, rather than one unlucky weld, the thing that produces defects, and it keeps the healthy baseline trend (~0.11mm) clear of the 0.25mm warn limit so the line does not cry wolf.

**The punchline: the inspection-mode switch, and you can watch it.**

Drop from **Every weld** to **1 in 7** and nothing mechanical changes - the robot's alignment keeps drifting exactly as before - but the line reverts to how body shops verified welds before continuous streaming inspection existed: a periodic manual sample instead of watching every one.

Every car carries its own verdict above it in the 3D scene: a green tick for inspected and in spec, a red cross for out of spec, and a grey question mark for the ones nobody looked at.
Under spot checks that grey mark is six cars in every seven, and at the time it is indistinguishable from a pass.
Finished cars do not vanish at the end of the line; they park in a "shipped today" bay in the foreground still wearing their tags, so a row of cars labelled **shipped unchecked** builds up where the room can see it.

Switch back to continuous and three things happen at once.
The parked cars that were genuinely defective turn red.
The dashboard's trend snaps back to reality.
And the gap between what was shown and what was true is reported as a number: *N suspect welds shipped with no inspection at all*.
Meanwhile the header has been reading a healthy yield the entire time, because the cars that shipped bad were never counted against it - which is the point.

This is deliberately the part that used to be missing.
The argument previously existed only as numbers in a sidebar chart, so an audience watching the 3D line saw four arms working normally while the story happened somewhere they could not read.

### The fault holds until somebody is watching

`state/storyDirector.ts` only ramps the drift back down once inspection is actually live.
An unattended demo still resolves on its own so it never gets stuck, but under spot checks the fault stays at peak.
That is both truer - nothing gets fixed while nobody knows - and practical: it used to auto-resolve on a timer, which left roughly a thirteen-second window in which the shipped bay still held a defective car for the reveal to turn red, and that is not a window a presenter should have to hit.
Dwell on act 1 for two minutes and the pile of unchecked cars gets correspondingly worse, which is the lesson rather than a bug.

### Detection latency is measured, not asserted

`state/store.ts` carries an `IncidentTiming` record stamped at the moment each thing actually happens: when the mechanical fault started (only `storyDirector` knows, because it causes it), when an alert first reached a human (gated on inspection genuinely being live), when the first out-of-spec weld left the station (from ground truth, so it is recorded whether or not anyone was watching), and when it was resolved.
The incident replay reports those differences directly.
Nothing on that screen is reconstructed after the fact.

## Presenter mode

Built for driving this live in front of a room.
Two things a keynote needs that an ambient demo does not: the same numbers every run, and a pace that fits between two sentences.

**Acts.**
Press `1`-`4` to stage a beat.
Each one puts the demo into a known state and starts it, because assembling an act by hand live is four or five keystrokes in the right order and `reset()` restores continuous inspection, so it will silently clear a mode you set a moment earlier.

| Key | Act | The claim it makes |
|---|---|---|
| `1` | How the line runs today | Periodic sampling is a blind window, every window, forever |
| `2` | What it cost | Every weld was measured. The measurement was just late |
| `3` | Same fault, stream on | The alert fires below spec, before any weld fails |
| `4` | Close the loop | Real-time analysis is the system acting, not a faster dashboard |

`P` toggles the presenter cue card (bottom left), which shows the current act, the point it exists to make, and what to do while it plays.
`C` recalibrates `WELD-01`, for when a keystroke is easier to hit on stage than a click.

**Determinism.**
Weld process noise runs off a seeded PRNG (`presenter/rng.ts`), reseeded on every reset, so acts 1, 3 and 4 see an identical noise stream and differ only in the variable under test.
Run it twice, get the same defect count, the same detection latency, the same gap number, and write those figures into your speaker notes.
`?seed=1234` picks a different one; `?seed=random` opts out.

**Speed.**
`?speed=2` runs the line and the fault at 2x, clamped to 0.5-3x.
Above about 3x the walking-beam cadence gets shorter than the station choreography it has to contain and arms get cut off mid-motion.

**1.5-2x is the useful range for a talk.**
At 3x the warn and critical crossings compress into the same rounded second and the incident timeline renders both at the same `T+` offset, which loses exactly the gap act 3 exists to point at.

The multiplier scales schedules, never geometry.
`ROBOT_TRANSIT_MS` is deliberately left alone because `scene/constants.ts` derives `STATION_SPACING` from it, and scaling it would physically move the stations apart when you changed the pace.
The analyzer window scales with the line cadence so a window still holds the same *number* of welds at any speed: the thresholds are tuned against sample count and against ramp-versus-window lag, and scaling only one of the two would quietly destroy the early-warning lead time the whole demo rests on.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `D` | Inject the weld-drift fault now |
| `R` | Reset the simulation |
| `Space` | Pause / resume |
| `Q` | Switch inspection mode (every weld / 1 in 7) |
| `I` | Open the incident replay |
| `Esc` | Close the topmost overlay / deselect the robot |
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
What changes with the inspection-mode switch is only whether that trend
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
- The robot arms are now proportioned like real body-shop machines, but the
  cars still arrive at Panel Fitting looking finished, so the whole-body
  shell reveal at that station does not read.
- No automatic quality step-down for low-end GPUs.
- Fitting the whole 30m line across a ~1.36 aspect frame leaves roughly 22m
  of vertical for a subject about 4m tall, so the settle shot carries a wide
  band of empty floor below the line. Shortening `STATION_SPACING` is the
  real fix; the camera cannot solve it on its own.
