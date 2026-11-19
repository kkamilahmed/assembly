// Places on the globe and the flights between them. The globe has radius 1,
// centred on the origin, north up (+y), longitude 0 facing +z.
import * as THREE from 'three';

export const DEG = Math.PI / 180;

/** Unit-sphere point for a latitude and longitude in degrees, scaled to
 *  radius `r`. */
export function latLon(lat: number, lon: number, r = 1, out = new THREE.Vector3()): THREE.Vector3 {
  const c = Math.cos(lat * DEG);
  return out.set(r * c * Math.sin(lon * DEG), r * Math.sin(lat * DEG), r * c * Math.cos(lon * DEG));
}

/**
 * A great-circle flight from `a` to `b` (unit vectors) that rises off the
 * surface in the middle: higher the further it goes, so long hauls arc well
 * clear of the globe and short hops stay low.
 */
export class Flight {
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  private readonly omega: number;
  private readonly sinOmega: number;
  private readonly lift: number;

  constructor(a: THREE.Vector3, b: THREE.Vector3) {
    this.a = a.clone().normalize();
    this.b = b.clone().normalize();
    this.omega = Math.acos(THREE.MathUtils.clamp(this.a.dot(this.b), -1, 1));
    this.sinOmega = Math.sin(this.omega);
    this.lift = 0.05 + 0.42 * (this.omega / Math.PI);
  }

  /** The point `t` (0-1) of the way along, written into `out`. */
  at(t: number, out: THREE.Vector3): THREE.Vector3 {
    if (this.sinOmega < 1e-5) out.copy(this.a);
    else {
      const k1 = Math.sin((1 - t) * this.omega) / this.sinOmega;
      const k2 = Math.sin(t * this.omega) / this.sinOmega;
      out.copy(this.a).multiplyScalar(k1).addScaledVector(this.b, k2);
    }
    return out.multiplyScalar(1.004 + Math.sin(Math.PI * t) * this.lift);
  }
}

/** Where the view rests: the Americas and the Atlantic, New York and
 *  Chicago up and left of centre. */
export const REST_VIEW = { lon: -58, tilt: 26 } as const;
