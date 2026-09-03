# 4-Station Assembly Line Redesign

## Status (read this first)

Build-order steps 1-3 are **done and independently verified** (re-checked directly, not just self-reported by whatever built them):

1. **Backdrop** — `src/scene/Backdrop.tsx` (new) + `Scene.tsx` wiring + `COLORS.backdrop` in `constants.ts`. One back wall + two end-cap walls, no wall on the +Z siding side (fog handles that edge).
2. **ID rename + dashboard shrink** — `ROBOT_IDS`/`ROBOT_LABELS` renamed to job-scoped IDs (`PANEL-01`/`WELD-01`/`PAINT-01`/`WHEEL-01`; `WELD-01` kept at index 1 so `PROBLEM_ROBOT_ID` needed no change). `RobotArm.tsx`'s `MACHINES` record keys renamed to match (pure rename, zero behavior change — same brand/color/shape/animStyle per station, just under new keys). Dashboard (`RobotPanel.tsx`) shrunk to one hardcoded `WELD-01` card. `state/engine.ts` now constructs a `DriftAnalyzer` only for `WELD-01` (new `ANALYZED_ROBOT_IDS` const). `TopBar.tsx` subtitle updated.
3. **Walking-beam conveyor foundation** — the biggest architectural change in the plan:
   - `state/store.ts`: `ActiveCar` extended with `stationIndex`/`dockedAt`; new actions `advanceCar`, `ingestCarExit`, `shiftDockedTimestamps`; `carsBuilt` now increments on `ingestCarExit`, not `ingestCarSpawn`.
   - `streaming/lineConfig.ts`: added `STATION_CYCLE_MS` (4800), `WORK_MS` per station, `EXIT_STATION_INDEX`, `SIDING_STATION_INDEX` (-1). Deleted `CAR_SPAWN_INTERVAL_MS`/`CAR_SPAWN_JITTER_MS` (spawn cadence = index cadence now). Kept `ROBOT_TRANSIT_MS` since `STATION_SPACING` in `scene/constants.ts` still derives from it.
   - `streaming/CarProducer.ts`: full rewrite — `pending` task queue replaced by a `slots` array (5 slots: 4 stations + exit-lane) + a single `nextIndexAt` deadline. One weld measurement fires synchronously the instant a car indexes into the `WELD-01` slot (`WELD_SLOT_INDEX` is derived via `ROBOT_IDS.indexOf`, not hardcoded). A QC-suspect car diverts to the siding on its very next departure check via a `flaggedCarIds` Set. Exit is a genuine one-cycle dwell (not instant removal) so `CarShell` has time to glide toward `DESPAWN_X`. Pause/resume shifts `nextIndexAt` **and** fires `onPauseShift` so every in-flight car's `dockedAt` shifts too (without this, resuming would make every dwelling animation jump).
   - `scene/CarShell.tsx`: `distRef`/`zRef` frame-accumulation deleted. Position now driven entirely by `stationIndex`/`dockedAt` — an 800ms smoothstep glide to the new station's fixed `(x,z)` (via a `targetFor()` lookup built from `ROBOT_X`/`DESPAWN_X`/`REWORK_STOP_X`/`REWORK_SIDING_Z`), then sits still for the rest of the dwell. Wheel roll now driven by actual per-frame distance moved (eases in/out, stops while dwelling) instead of constant speed. A line-wide skid/pallet slab was added under every car (visible now; hiding it after wheel-mount is step 7's job).
   - `state/engine.ts`: wired `onCarAdvance`/`onCarSiding`/`onCarExit`/`onPauseShift` to the new store actions (the siding case just reuses `advanceCar` with the `SIDING_STATION_INDEX` sentinel — no separate action needed).

`npx tsc -b` and `npx oxlint src/` are both clean right now. The **only** expected warning is a known pre-existing false positive in `CarShell.tsx`'s `wheels` `useMemo`/mutation pattern (`react(immutability)` — the rule doesn't understand the R3F mutate-in-`useFrame` idiom; this predates this feature work, do not try to "fix" it).

**Next up: build-order step 4** (shared 2-bone IK solver + envelope helper) — attempted but **not completed**, no code was written for it (no `src/scene/ik.ts` exists), so start it fresh. See "Architecture change 2" below for full detail. The one refinement beyond that section's original wording: build a single reasonable placeholder reach-target (e.g. car-body-center-ish) for all 4 stations in this step — the real per-station target geometry (weld seams, paint sweep path, wheel hubs, panel placement point / `stationTargets.ts`) is step 5-8's job, not step 4's.

Steps 5-9 are as originally planned, untouched — see "Build order" below.

---

## Steps 4-9 — DONE

4. **IK helper + envelope extraction** — `src/scene/ik.ts` (`solveTwoBoneIK` law-of-cosines 2-bone solver with reach clamping + `triangleEnvelope` + `smoothstep`), `src/scene/stationTargets.ts` (placeholder reach target, car-frame geometry, phase schedules, ride-height, `useWheelHubOffsets` cache). The shoulder joint in `RobotArm.tsx` is now ref-driven; `useFrame` blends the authored rest pose → IK solution via a `reachBlend` envelope. Verified with a Playwright probe reading the live R3F scene: all 4 arms hit the IK solution exactly at peak blend.
5. **Painting** — new `spray` end-effector (nozzle + spinning wrist collar + recoloured spark/fan), IK target sweeps front→rear (`paintSweepProgress`), `CarShell` lerps body colour primer→palette in lockstep with the sweep. Verified: PAINT-station body colours include primer, final palette, and intermediate blends.
6. **Welding re-scoping** — 3 fixed near-side seam points, `weldDartPhase` (smoothstep dart + triangle spark pulse at each), one QC measurement per car (unchanged `DriftAnalyzer`/store wiring). Deleted `storyDirector.ts`'s ambient-blip subsystem (`pickAmbientRobot`/`ambientBlip`/`ambientTimers`/`ambientIntervalId`/`AMBIENT_*`). Verified: flagged cars reach the siding, `suspectWeldsCaught` ticks, unflagged cars still exit (`carsBuilt` climbs).
7. **Wheel mounting** — shared `PropStack` (depletes-on-pick/refills) with `TyreProp`; 4 sequential mount cycles (`wheelMountPhase`: reach stack → grip → carry to hub → mount pulse flips that wheel group `visible`), then a smoothstep body rise from `LOW_RIDE_Y` to `CONVEYOR_Y` with the skid fading out. `useWheelHubOffsets` reads each wheel's car-frame offset once from the GLB. Verified: visible-wheel-count climbs 0→1→2→3→4; exit-lane cars have all 4 wheels visible, skid hidden, ride height 0.5.
8. **Panel attachment** — `PropStack` rack with `ShellSlab`; `panelPhase` (reach rack → grip → carry → reveal → retract); `CarShell` scales the body shell 0→1 on the reveal beat; a held-shell placeholder rides the tool during carry. Verified: PANEL body scale ramps 0→1.
9. **Polish** — TopBar subtitle already "Assembly Line Monitor" (step 2). Camera waypoints remain valid against the final geometry (props sit behind the robots, inside the backdrop envelope; tuning is visual-QA-only per the plan). Optional paint-wipe shader and Panel/Paint/Wheel feed lines skipped — the global colour lerp reads well and the plan marks them not-required.

`npx tsc -b` clean. `npx oxlint src/` clean except the known pre-existing `react(immutability)` false positives (the `CarShell` `wheels` useMemo mutation pattern + the module-scope `hubCache` in `stationTargets.ts` — both the accepted R3F/cache idiom the plan says not to chase).

---

## Context

The demo currently models a "weld line": 4 stations that are cosmetically different (brand/color/shape, from earlier session work) but functionally identical — all 4 robots just weld cars gliding past on a continuous conveyor, timed by wall-clock scheduling that's only "best-effort" aligned with where the car mesh visually is. The user wants to turn this into a real 4-*process* assembly line — panel attachment, welding, painting, wheel mounting — where each station visibly does its own distinct job to the car, plus fix positioning/reach/background/counter issues that make the current scene feel disconnected and gimmicky.

This is a large, foundational change: it requires switching car motion from continuous physics-style accumulation to a discrete, snapped "walking-beam" conveyor before any station's multi-second choreography can read convincingly, plus real arm-to-point targeting (IK) instead of hand-tuned approximate poses. Two scope questions were resolved with the user before finalizing this plan:

1. **Panel attachment asset gap** — the car body is a single fused mesh in the GLB (51k verts, no separate door/hood sub-meshes; confirmed via `@gltf-transform/cli inspect` + manual GLB JSON-chunk parse). A literal per-door reveal isn't achievable without commissioning new 3D geometry. **Decision: whole-body reveal** — the entire body shell is hidden until the panel station, where the arm "installs" it in one motion. No new assets this phase.
2. **Dashboard cards** — today's 4 identical drift/QC cards only make sense for a station that actually welds. **Decision: shrink to 1 card** (Welding only); panel/paint/wheel stations are visual-only in the 3D scene, no dashboard entry.

**Working assumption** (well-supported by the user's message structure, not separately asked): the rework/quality-flagging mechanic stays exclusive to Welding — the other 3 stations are deterministic this phase, no defect/flagging logic.

## Architecture change 1: walking-beam conveyor (foundation for everything else) — DONE, see Status

Replace continuous per-frame distance accumulation with a discrete indexed conveyor — the real-world mechanism this maps to is a walking beam: every occupied station's car advances one slot in lockstep on a shared cadence, dwells for its station's choreography, then advances again.

- **`src/state/store.ts`** — extend `ActiveCar`:
  ```ts
  export interface ActiveCar {
    carId: string;
    spawnedAt: number;
    flaggedRobotId: RobotId | null;
    stationIndex: number;   // 0..3 = docked at a station, 4 = exit lane, -1 = rework siding
    dockedAt: number;       // wall-clock ts this car arrived at its CURRENT stationIndex
  }
  ```
  No separate "which car is at my station" record — `RobotArm` and `CarShell` both derive everything from this one field, avoiding a second source of truth that can drift out of sync.
  Add `ingestCarExit(carId, timestamp)`: increments `carsBuilt`, removes the car from `activeCars`. Remove the existing `carsBuilt` increment from `ingestCarSpawn` (currently counts cars *entering*, not finishing — this is the "ticks up on exit" fix).

- **`src/streaming/CarProducer.ts`** — replace the `pending: PendingTask[]` wall-clock task queue with:
  - `slots: Array<string | null>` (length 4)
  - one `nextIndexAt: number` deadline
  - `tick()`: when `now >= nextIndexAt`, walk stations index 3→0 (avoid overwrite-before-read), route each occupied slot to its next destination (siding if just-flagged at the Welding slot, otherwise `+1`, or exit-lane past the last slot), fire the corresponding store action, then admit a new spawn into slot 0. Schedule `nextIndexAt += STATION_CYCLE_MS`.
  - This **deletes** the independent `CAR_SPAWN_INTERVAL_MS`/`CAR_SPAWN_JITTER_MS` concept entirely — spawn cadence = index cadence, one car enters exactly when another vacates slot 0.
  - Weld measurement fires once, synchronously, the instant a car indexes into the Welding slot — replaces the old `for (const robotId of ROBOT_IDS) {...}` loop with one call into the single surviving `DriftAnalyzer`. The verdict is known immediately, so the very next index step can route a flagged car to the siding.
  - Reuse the exact existing pause-handling pattern in `configure()` (shifts pending deadlines by the pause duration) — apply it to `nextIndexAt` **and** to every in-flight car's `dockedAt`. This is the one easy-to-miss correctness bug: without shifting `dockedAt` too, resuming from a pause makes every station's `elapsed = now - dockedAt` jump forward by the full pause length, and every mid-dwell animation lurches to whatever phase that elapsed time now maps to.
  - `reset()` clears `slots` and resets `nextIndexAt`, mirroring today's `pending = []`.

- **`src/streaming/lineConfig.ts`** — add `STATION_CYCLE_MS` (~4800ms, sized to comfortably fit the slowest station's choreography + an ~800ms snap transition with margin) and per-station `WORK_MS` (Panel ≈3200, Weld ≈3600, Paint ≈3000, Wheel ≈3400, all under the cycle). Delete `CAR_SPAWN_INTERVAL_MS`/`CAR_SPAWN_JITTER_MS` (dead once spawn = index cadence). Rename `ROBOT_IDS` values to job-scoped IDs: `['PANEL-01', 'WELD-01', 'PAINT-01', 'WHEEL-01']` — keep `WELD-01` in its current 2nd slot so `PROBLEM_ROBOT_ID = 'WELD-01'` and the drift story need zero further changes. Update `ROBOT_LABELS` to job names (Panel Fitting / Body Weld / Paint Booth / Wheel Mount). TypeScript's `Record<RobotId, MachineSpec>` in `RobotArm.tsx` will hard-error on any stale key, so this rename is self-checking.

- **`src/scene/CarShell.tsx`** — delete `distRef`/`zRef` frame accumulation. Read this car's `stationIndex`/`dockedAt`/`flaggedRobotId` (same `activeCars.find` selector pattern already used for `flaggedRobotId`, just widened). Map `stationIndex` (or the siding sentinel) to a target `(x, z)` via a small lookup table built from `ROBOT_X`/`DESPAWN_X`/`REWORK_STOP_X`/`REWORK_SIDING_Z` (all already exist in `scene/constants.ts`). For the first ~800ms after `dockedAt`, smoothstep-interpolate from the previous target to the new one (duration-based, **not** `THREE.MathUtils.damp` — damp is asymptotic and never fully settles, which would leave every IK target chasing a slightly-off position indefinitely); after that window the car sits exactly at the station X for the rest of the dwell. `paused` gates this exactly as today (skip the frame).

- **Bundle into this same step**: the skid/pallet prop (a simple low slab) is line-wide — visible under every car from spawn through the Wheel station, not specific to Wheel's own choreography — and the default pre-paint body material color (`COLORS.primer`, a neutral grey) both belong here since they're conveyor-level defaults every later station builds on.

**Milestone**: cars visibly snap between 4 fixed slots with a clean transition; no station reaches for anything yet. Independently testable before any IK/choreography work starts.

## Architecture change 2: shared 2-bone IK + envelope helper — NEXT UP (see Status)

- **`src/scene/RobotArm.tsx`** — convert the currently-static `<group rotation={[spec.upperTilt,0,0]}>` wrapping the upper link into a ref-driven group. Today only `baseRef.rotation.y` and `forearmRef.rotation.x` are frame-dynamic; making the shoulder joint drivable too is required, not cosmetic.
- **New `src/scene/ik.ts`** — analytic 2-bone solver (law of cosines), consistent with the existing convention that base yaw handles horizontal aim and the two links move in one vertical plane (the same assumption already baked into today's hand-tuned poses):
  ```ts
  export interface TwoBoneSolution { baseYaw: number; upperTilt: number; foreTilt: number; }
  export function solveTwoBoneIK(
    targetLocal: THREE.Vector3, // relative to the robot's base pivot
    upperLen: number, forearmLen: number, shoulderHeight = 0.7,
  ): TwoBoneSolution
  ```
  Clamp reach distance to `0.98 * (upperLen+forearmLen)` so an unreachable target never produces `NaN` from `acos`. Each `MachineSpec`'s existing authored `upperTilt`/`foreTilt` becomes that arm's *idle/rest* pose; IK output blends in during active reach phases. Verify the sign conventions empirically against `RobotArm.tsx`'s existing authored poses (e.g. `PANEL-01`'s `baseYaw:0.12, upperTilt:0.42, foreTilt:-1.25`) before wiring it in for real.
- **New `src/scene/stationTargets.ts`** — car-local geometry facts: weld-seam points, paint sweep endpoints, panel placement point, and a `useWheelHubOffsets()` hook wrapping the already-preloaded `useFerrariModel()` to read each wheel group's local position **once**, cached at module scope (every car instance shares identical local offsets — confirmed from the GLB's node transforms). `RobotArm` imports target points from here; it stays free of any GLTF/CarShell dependency, preserving the existing clean separation. (Building this file's full per-station geometry is step 5-8's job — step 4 only needs one placeholder target shared by all 4 stations, to prove the IK pipeline end to end.)
- Extract the existing pulse math (`pulseAge`/`pulseT`/`dab = sin(pulseT*Math.PI)`) out of `RobotArm`'s `useFrame` switch into a small shared `triangleEnvelope(elapsedMs, startMs, durationMs)` helper, colocated with `ik.ts`. Every station's choreography becomes a sequence of envelope calls (Weld: 3 darts, Wheel: 4 mounts, Panel/Paint: 1-2 beats) instead of one rigid pulse-per-weld-event — this is what makes the existing `animStyle` machinery extensible to multi-beat sequences. This is a refactor of currently-working animation code (the 4 existing weld-flavor pulse animations) — verify nothing regressed visually after extracting it.
- Add `CAR_WIDTH`/`CAR_HEIGHT` to `scene/constants.ts` (hand-authored constants, same spirit as the existing `CAR_LENGTH`) for local-offset math.

**Milestone**: all 4 arms point at (or visibly bend toward) whatever car is docked at their station — not a fixed idle pose regardless of car position — validated visually per station, before building per-station sequences on top.

## The 4 stations

**Shared prop component**: Panel's rack and Wheel's stack both need "N items, depletes by one per pick, refills when empty" — factor into one `src/scene/PropStack.tsx` (item geometry/material, count, pick-point) rather than two bespoke implementations. Both use stylized primitives (`RoundedBox`, already imported in `RobotArm.tsx`, or simple cylinders) — never clone the real 51k-vert `body` mesh or wheel sub-meshes for rack/stack items.

**Painting (`PAINT-01`) — build first, simplest, validates the whole pipeline end to end**
- New `sprayNozzle` end-effector branch (cone/cylinder nozzle + a thin transparent "fan" cue reusing the existing spark's transparent-material/point-light trick, recolored).
- IK target sweeps front-to-back (`lerp(frontLocalPoint, rearLocalPoint, smoothstep(phaseT))`) over the dwell.
- Color change, MVP: `CarShell` stops setting palette color at construction; every car's `MeshPhysicalMaterial.color` starts at `COLORS.primer`. While docked at Paint, lerp `color` from primer to `paletteColorFor(carId)` keyed to sweep progress — same "derive local progress from `dockedAt`" pattern reused by Panel's reveal and Wheel's rise, worth factoring into one small `useStationPhaseProgress(stationIndex, carId, workMs)` helper in `CarShell`.
- Stretch (explicitly not MVP): a literal traveling paint-front via `onBeforeCompile` on the existing material, animating a local-space X uniform to mix primer/final color per-fragment. Ship the global lerp first; only build this if the simple version doesn't read well.

**Welding (`WELD-01`) — mostly re-plumbing existing machinery**
- Keep all existing spark/light/jaw/torch infrastructure verbatim.
- Pick 3 fixed local seam points reachable by one side-mounted arm (near-side door seam low, near-side roofline/B-pillar, near-side rear quarter) — a deliberate reduction from "4 arms split the whole car" to "1 arm covers what it can plausibly reach."
- Between points: IK-interpolate from point A's solution to point B's (smoothstep dart), hold with a `triangleEnvelope` pulse (spark+jaw, reused verbatim) at each point.
- One `WeldEvent`/QC measurement per car, regardless of how many points the arm visually darts to — the darts are cosmetic; don't multiply the underlying measurement. Keeps `DriftAnalyzer`/`types.ts`/store QC logic completely untouched.
- Rework flag stays exactly as today's mechanism (`CarShell`'s existing red cone marker, driven by `activeCars[].flaggedRobotId`) — zero changes needed there.
- Delete `storyDirector.ts`'s ambient-blip subsystem (`pickAmbientRobot`, `ambientBlip`, `ambientTimers`/`afterAmbient`/`clearAmbientTimers`, `ambientIntervalId`, `AMBIENT_BLIP_CHANCE`/`AMBIENT_INTERVAL_MS`, and the `initStoryDirector` wiring that starts it). Confirmed by reading the file: it exists purely to jitter bias on "some other robot" for dashboard texture — with only one drift-capable station now, and that station already running its own scripted cycle, this becomes fully inert dead code, not just redundant.

**Wheel mounting (`WHEEL-01`) — moderate lift, reuses the most existing geometry**
- Wheel groups (`wheel_fl/fr/rl/rr`) are already independently-hideable nodes — zero new geometry needed for the wheels themselves, just `.visible` toggles per group (matches the existing wheel-name lookup already used for rotation).
- Before this station: body sits ~`WHEEL_RADIUS` below final `CONVEYOR_Y` (on the skid prop from the conveyor foundation step), all 4 wheel groups `visible=false`.
- New wheel-stack prop (via shared `PropStack`), stylized tire/rim stand-ins.
- 4 sequential mount cycles (~800ms each): reach to stack top → grip → carry to that wheel's hub target (from `stationTargets.ts`'s cached local offsets) → mount pulse (flips that wheel group `visible=true`) → retract.
- After all 4: one smoothstep rise from low-Y to `CONVEYOR_Y` over the final ~500ms; skid fades out at completion.

**Panel attachment (`PANEL-01`) — biggest lift, do last**
- Rack prop (via shared `PropStack`) placed clear of both the car path and the robot pedestal (roughly `z = ROBOT_Z - 1.6`), stylized "raw shell" gray slabs on a simple A-frame.
- Phases: reach to rack top item (IK) → grip (jaw-close reuse; hide the rack item, show a small held-panel placeholder riding the tool rather than reparenting the real mesh mid-flight) → carry+lower to the placement point above the chassis → **reveal**: `CarShell`'s `body` mesh (invisible/scale-0 for this car until now) pops to full scale, using the same phase-progress pattern as Paint's color lerp → retract.
- Rack count is local component state — nothing outside this component needs it.

## Background/backdrop — DONE, see Status

New `src/scene/Backdrop.tsx`, composed right after `<Floor/>` in `Scene.tsx`. The scripted camera flythrough (`camera/waypoints.ts`) roams to `z=-14` (shot 0) and `z=+16` (shot 2), and free-orbit allows `maxDistance=80` (confirmed in `CameraRig.tsx`) — a fully enclosing backdrop isn't practical without clipping those shots. Concrete, low-effort "clean studio" proposal:
- One large back wall behind the robots (`z ≈ -18` to `-20`, clearing the `z=-14` excursion with margin), spanning the line length + margin, ~14-16m tall.
- Two end-cap walls at the X extremes (before `LINE_START_X`, past `DESPAWN_X`) — safe to size tightly since camera X excursions stay within the line's own span.
- Deliberately **no** wall on the +Z (rework-siding) side — the `z=+16` shot and free-orbit range make that impractical; existing fog (`far=48`) already softens that side.
- New `COLORS.backdrop` (a touch deeper than `COLORS.floor`), matte (`roughness≈0.8`, `metalness=0`), `receiveShadow` only.
- Optional stretch, not default: a "dressed factory" version (roof trusses, cable trays) reads more literal but costs more time — ship the clean-studio wall first.

Note: ground plane (`Floor.tsx`) and contact shadows (`<ContactShadows>` in `Scene.tsx`) already exist and need no changes — the actual gap closed here is background geometry only.

## Dashboard shrink — DONE, see Status

Minimal-diff path: **`store.ts`'s `robots: Record<RobotId, RobotState>` shape is untouched.** Once `state/engine.ts` constructs a `DriftAnalyzer` only for `WELD-01`, the other three keys' `RobotState` entries simply never receive events and sit frozen at harmless defaults — zero behavior risk. In `src/ui/RobotPanel.tsx`, replace the `ROBOT_IDS.map(...)` with rendering a single hardcoded `'WELD-01'` card, keeping the exact same JSX body. ~10-line diff, one file.

## Ripple effects (small, do alongside the relevant step above)

- `ui/TopBar.tsx`: counters update automatically via the store wiring above. Update the stale subtitle ("Body Shop 2 — Weld Line Monitor" → something like "Body Shop 2 — Assembly Line Monitor") since 3 of 4 stations no longer weld. **(Done as part of step 2.)**
- `ui/EventFeed.tsx`: no required changes (templates already interpolate `robot_id` generically). Optional additive nice-to-have: feed lines for Panel/Paint/Wheel completions — not required.
- `ui/ShortcutOverlay.tsx` / `interactions/useKeyboardShortcuts.ts`: confirmed no station-count-dependent logic — no changes needed.
- `camera/waypoints.ts`: logic stays valid with the `WELD-01`-stays-in-slot-2 ID choice; the hardcoded numeric shot positions need a manual re-eyeball pass once station spacing/props/backdrop exist (visual QA, not a logic fix) — do this in a final polish step.
- `README.md`: out of scope for this phase per earlier discussion — it's already stale describing 4 identical weld robots; flag for a rewrite later (note when that happens: the "spark timing isn't frame-exact" known-limitation actually gets fixed, not worse, under the snap conveyor).

## Build order

1. ~~**Backdrop**~~ — DONE.
2. ~~**ID rename (`ROBOT_IDS`/`ROBOT_LABELS`) + dashboard shrink**~~ — DONE.
3. ~~**Conveyor foundation**~~ — DONE. Milestone confirmed: cars snap cleanly between slots, arms idle.
4. **IK helper + envelope extraction** — NEXT. `ik.ts`, `stationTargets.ts` (placeholder target only), dynamic shoulder joint. Milestone: all 4 arms correctly aim at their docked car.
5. **Painting** — simplest full choreography; validates phase-machine + IK sweep + color lerp end to end.
6. **Welding re-scoping** — scope `DriftAnalyzer`/`CarProducer` to one robot, delete the ambient-blip subsystem, build the multi-point dart.
7. **Wheel mounting** — reuses hideable wheel groups + `PropStack`.
8. **Panel attachment** — biggest lift, needs `PropStack` (built in step 7).
9. **Polish** — camera waypoint re-tuning against final geometry, TopBar subtitle, optional paint-wipe shader upgrade, optional new feed lines.

## Verification (per step, before moving to the next)

- `npx tsc -b` and `npx oxlint src/` clean after every step (matches this project's existing bar — both were kept clean throughout earlier session work on this codebase). The one known pre-existing exception: a `react(immutability)` false positive on `CarShell.tsx`'s `wheels` `useMemo`/mutation pattern — not a real bug, don't chase it.
- Run `npm run dev`, load in a browser, and visually confirm the specific milestone for that step (cars snapping cleanly / arms aiming correctly / one station's full choreography reading well) before starting the next — each step above is independently testable in isolation, by design. (No `chromium-cli` is set up for this project — drive verification with a plain Node script using the `playwright` package, and actually read screenshots back rather than only checking for console errors.)
- After step 3: confirm pause/resume doesn't cause a visible animation lurch (the `dockedAt` pause-shift fix) — pause mid-dwell at a station, wait a few seconds, resume, watch for a jump. **(Confirmed clean.)**
- After step 6: confirm a flagged car actually reaches the rework siding and the "flagged for rework" counter ticks, and an unflagged car reaches `carsBuilt` on exit.
- Final pass: full line run for several car cycles, watching for any station whose dwell time (`WORK_MS`) doesn't comfortably fit `STATION_CYCLE_MS`, and re-tune the camera flythrough against the finished scene.
