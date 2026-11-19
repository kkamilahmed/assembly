# Northgate Payments - Real-Time Fraud Monitor

A React Three Fiber demo of a card payment network, driven by a **simulated** Kafka + Flink streaming pipeline and drawn as a live 3D globe.
Payments arc across a dotted globe from card holders' cities into Northgate's scoring hub in New York, and into TechDealz Online's checkout in Chicago; every one is scored as it is sent.
The presenter starts a card-testing attack from the keyboard, shows on the dashboard what it is costing, shows on the sources screen which merchant and which rule are to blame, freezes the merchant, fixes the rule, and then lets the network block the next wave on its own.

This branch (`fraud`) is the fraud-detection version of the bakery demo on `food-processing`.
The story, controls and architecture are the same.

## Quick start

```bash
npm install
npm run dev
```

The app opens on the network.
Drag the globe to turn it; it drifts back to the Americas and the Atlantic a few seconds after you let go. With `prefers-reduced-motion` it holds still.

## The story

Three screens, left to right: **Sources | Network | Dashboard**. The arrow keys walk between them and the app opens on the network.
The network shows the payments flying, the dashboard shows what is getting through (the effect), and the sources screen shows which merchant it is coming from and which rule is letting it through (the cause).
Both side screens show who is on shift (Maya R., fraud analyst) and a live incident timeline: attack, alert, freeze, refit, autopilot catch, each with its measured time.

The moral: because every payment is scored as it streams, you can stop fraud the minute it starts, instead of finding it in tomorrow morning's overnight batch check, when the money is already gone.

| Beat | Do | What the room sees |
|---|---|---|
| 1. The network | Nothing. Talk. | Green arcs fly into New York from cities around the world, each one a payment scored and approved. |
| 2. Something starts | `D` | TechDealz Online in Chicago starts pulsing red: card-testing arcs fire into it from a handful of countries, are scored as fraud, and land anyway. |
| 3. The effect | `→` Dashboard | "Fraud losses climbing": fraud rate about 0.9% and rising over its limit, about $12k lost per 10 minutes, about $1.4M on track by tomorrow's batch check. Red climbs up the stacked bars. |
| 4. The cause | `←` `←` Sources | TechDealz is flagged: about 4,800 charges of $1 from new cards in 5 minutes, card testing. The small-amount velocity rule only trips above 1,000 charges a minute, so its threshold is too loose. The other sources and rules are healthy. |
| 5. Freeze and fix | `S`, then `C` | The merchant is frozen: TechDealz's arcs stop mid-flight and die away, and everyone else's traffic keeps flying. The freeze report shows how fast it was caught and what waiting would have cost. Recalibrating fits the rule to the attack. |
| 6. Back to the network | `→` Network, `A` | Autopilot unfreezes the merchant. Press `D` or `E` again: the stream flags the attack and the rule is refit within about a second, and the next wave's arcs turn grey and die just short of TechDealz. |

`E` is the emergency version of `D`: an account-takeover wave from many more countries, with stolen logins paying into New York at the same time.

Nothing happens on its own; the network stays healthy until a key is pressed.
Only analyst actions (Freeze, Recalibrate, Autopilot) are on screen, so the audience never sees a "break it" button.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `D` | Slight deviation: card testing at TechDealz Online |
| `E` | Emergency: account-takeover wave |
| `S` | Freeze / unfreeze the merchant |
| `C` | Recalibrate the rule |
| `A` | Run on autopilot (press again to turn it off) |
| `←` / `→` | Move between Sources, Network, Dashboard |
| `F` | Manual signal fault-injection panel (sources screen) |
| `R` | Reset the demo (autopilot stays as it was) |
| `Esc` | Close the topmost overlay |
| `?` | Shortcut overlay |

## How the attack is modelled

**The flights.**
Every source sends payments in turn, each from a card holder's city; the attack adds its own storm of card-testing charges at TechDealz, from attacker cities (`streaming/networkConfig.ts`).
As a payment is sent it is given a risk score and the production rules decide whether to approve it.
While an attack is running it is paced under the rules, so the stream flags it (red) but the rules approve it and it lands: money lost.
Once the rule is recalibrated, flagged payments are blocked (grey) and die just short of landing.
An arc's colour is the stream's verdict, so what the room sees is what the scoring measured.

**The sources' own signals.**
An attack also moves its merchant's approval velocity and new-card share (`SIGNAL_SIGNATURE` in `state/storyDirector.ts`).
Those stream every 0.9 s, which is why the sources screen reacts before the first fraudulent card reaches the scanner.

**Detection and autopilot act on the data, not on the script.**
"Detected" is stamped the first time TechDealz's combined condition (worst of the risk of its approved charges and its signals, `sourceSeverity` in `state/store.ts`) leaves healthy, and the autopilot waits for that same condition.

**Every number on screen is measured.**
The freeze report and the autopilot summary come from timestamps taken as things happened.
The dashboard converts the measured rate of fraud settling into network terms using the illustrative figures in `ui/businessCase.ts` (3,000 payments a second, 4 real charges per red card, $1.25 lost per fraudulent charge, 19.5 hours to the overnight batch check); set them to a customer's numbers before a talk.

## Presenter settings

- `?speed=2` runs the network and the attack at 2x, clamped to 0.5-3x.
- Risk noise is seeded (`presenter/rng.ts`) and reseeded on reset, so a rehearsal reproduces on stage. `?seed=1234` picks another seed, `?seed=random` opts out.
- `?still=1` renders the globe alone, full window, with no UI; the presenter keys still work. Used for screenshots.

## Architecture

```
src/
  streaming/   PaymentProducer (payments in flight), FraudAnalyzer
               (Flink-style per-payment scoring + windowed risk per source),
               SignalStream (per-source signals) - pure logic, no React/Three
  state/       store.ts (Zustand), engine.ts (the one file that wires
               streaming -> store), storyDirector.ts (presenter controls
               and the autopilot)
  scene/globe/ GlobeStage (camera, light, post FX), GlobeBody (ocean,
               land dots, atmosphere), Flights (arcs), Markers (New York,
               TechDealz), landDots.ts (generated)
  ui/          Top bar, action bar, globe HUD, overlays, shift and incident
               timeline, sources and dashboard screens
  sandbox/     Dev-only page for building one globe part in isolation:
               /sandbox.html?part=<name>
```

Every mesh and material is built in code; there are no model files and no runtime network fetches.
The land dots are precomputed from Natural Earth 1:50m land (the `world-atlas` package) by `node scripts/gen-land-dots.mjs`, which writes `src/scene/globe/landDots.ts`.

## Swapping in a real Kafka/Flink backend

`state/engine.ts` is the only file that imports both `streaming/` and `state/store.ts`.
Replacing the simulators means replacing the `PaymentProducer` / `FraudAnalyzer` / `SignalStream` construction there with something exposing the same listener surface; nothing in `state/store.ts`, `scene/` or `ui/` needs to know.

## Known limitations

- Visual quality was tuned in headless software rendering; check frame rate on the presenting machine before a talk.
- The global view is a little dramatised: a city network's fraud is mostly local, and the attacker and card holder cities are illustrative.
