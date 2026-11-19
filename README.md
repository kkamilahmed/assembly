# Live Detection Demos

One story, told in four industries: a live operation, a fault caught by real-time stream processing within seconds, the cost of waiting on the dashboard, the cause on the machines screen, then stop, recalibrate and hand over to autopilot.
Each demo is a self-contained React Three Fiber app with the same three screens and the same keys, so a keynote uses whichever one fits the audience.

## Run a demo

```bash
npm run demo
```

It asks which demo you want, installs that demo's dependencies on first run, and opens it in the browser.
To skip the menu, name it: `npm run demo -- fraud`.

| Name | Folder | Port | Story |
|---|---|---|---|
| `bakery` | `demos/bakery` | 5181 | Goldcrust bakery: the oven runs hot and starts burning loaves |
| `battery` | `demos/battery` | 5182 | Voltline EV battery plant: the laser welder drifts and welds go weak |
| `pharma` | `demos/pharma` | 5183 | Meridian Pharma tablet line: the press drifts and tablets come out underdosed |
| `fraud` | `demos/fraud` | 5184 | Northgate Payments: card testing through TechDealz Online, on a live globe |

Each folder's own README covers its story beat by beat, its keyboard shortcuts and how its fault is modelled.

## Keys (every demo)

| Key | Does |
|---|---|
| `←` `→` | Switch between the three screens |
| `D` | Slight deviation: the fault starts creeping in |
| `E` | Emergency |
| `S` | Stop |
| `C` | Recalibrate |
| `A` | Autopilot: the system catches and fixes the next fault on its own |
| `R` | Reset |
| `?` | Show all shortcuts |

## Working on a demo

Each demo is an independent Vite app.

```bash
cd demos/battery
npm ci
npm run dev
npm run lint
npm run build
```

## History

The original car assembly plant demo lives on the `car` branch.
The four demos were built on the `food-processing`, `battery`, `healthcare` and `fraud` branches, whose history is merged into this one.
