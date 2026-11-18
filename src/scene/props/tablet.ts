// The product, as geometry shared by the line (scene/Tablets.tsx) and the
// set dressing (rack trolleys, a carried tray, the reject bin): a shallow
// tray of 24 tablets, and the sealed blister card the tablets end up in.
// Tablets are drawn several times life size so a tray reads at the plant's
// zoom.
import * as THREE from 'three';
import { matte, metal, PALETTE, plastic, tabletColor } from '@/scene/style';
import { merged, mergedBoxes, studioWhite } from './kit';

/** Tray footprint: long side along x (the direction of travel). */
export const TRAY = { l: 0.46, w: 0.34, h: 0.045, floor: 0.012 } as const;
/** 6 x 4 tablets on a tray. */
const COLS = 6;
const ROWS = 4;
const TABLET_R = 0.031;
const TABLET_H = 0.022;

/** A shallow moulded tray, origin at the centre of its base. */
export function trayGeometry(): THREE.BufferGeometry {
  return mergedBoxes('tabletTray', () => {
    const { l, w, h, floor } = TRAY;
    const t = 0.018;
    return [
      { size: [l, floor, w], pos: [0, floor / 2, 0], r: 0.006 },
      { size: [l, h, t], pos: [0, h / 2, w / 2 - t / 2], r: 0.007 },
      { size: [l, h, t], pos: [0, h / 2, -w / 2 + t / 2], r: 0.007 },
      { size: [t, h, w - 2 * t + 0.004], pos: [l / 2 - t / 2, h / 2, 0], r: 0.007 },
      { size: [t, h, w - 2 * t + 0.004], pos: [-l / 2 + t / 2, h / 2, 0], r: 0.007 },
    ];
  }, 1);
}

/** One biconvex tablet lying flat, origin at the centre of its base. */
function tabletGeometry(): THREE.BufferGeometry {
  const r = TABLET_R;
  const h = TABLET_H;
  // Few segments: a tablet is a handful of pixels across at the plant's
  // zoom, and there are a couple of thousand of them on screen.
  const profile: Array<[number, number]> = [
    [0, 0],
    [r * 0.8, h * 0.08],
    [r, h * 0.5],
    [r * 0.8, h * 0.92],
    [0, h],
  ];
  return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 8);
}

/** The 24 tablets on a tray, as one geometry sitting on the tray floor.
 *  Scale it on y to draw thin, underweight tablets. */
export function trayTabletsGeometry(): THREE.BufferGeometry {
  return merged('trayTablets', () => {
    const out: THREE.BufferGeometry[] = [];
    const px = (TRAY.l - 0.06) / COLS;
    const pz = (TRAY.w - 0.06) / ROWS;
    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < ROWS; j++) {
        const g = tabletGeometry();
        // A hand-loaded look: not every tablet dead centre in its cell.
        const jx = Math.sin(i * 12.9898 + j * 78.233) * 0.004;
        const jz = Math.cos(i * 39.346 + j * 11.135) * 0.004;
        g.translate((i - (COLS - 1) / 2) * px + jx, TRAY.floor, (j - (ROWS - 1) / 2) * pz + jz);
        out.push(g);
      }
    }
    return out;
  });
}

/** A blister card: foil-backed, 2 x 5 clear pockets. Long side along x. */
export const CARD = { l: 0.4, w: 0.25, h: 0.012 } as const;

export function cardGeometry(): THREE.BufferGeometry {
  return mergedBoxes('blisterCard', () => [{ size: [CARD.l, CARD.h, CARD.w], pos: [0, CARD.h / 2, 0], r: 0.004 }], 1);
}

export function cardPocketsGeometry(): THREE.BufferGeometry {
  return merged('blisterPockets', () => {
    const out: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 2; j++) {
        const g = new THREE.SphereGeometry(0.034, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
        g.scale(1, 0.62, 1);
        g.translate((i - 2) * 0.072, CARD.h, (j - 0.5) * 0.11);
        out.push(g);
      }
    }
    return out;
  });
}

// Materials. Shared, so the line, the trolleys and the bin all look alike.
export const trayMaterial = () => plastic(PALETTE.blue, 0.4);
export const tabletMaterial = () => matte(studioWhite(`#${tabletColor(1).getHexString()}`, 0.86), 0.42);
export const foilMaterial = () => metal(PALETTE.foil, 0.32);
export const pocketMaterial = () => plastic(studioWhite(PALETTE.white, 0.9), 0.15);

/** A tray with its tablets, for set dressing: as one static group of
 *  meshes. Origin at the centre of the tray's base. */
export function trayParts(): Array<{ g: THREE.BufferGeometry; m: THREE.Material }> {
  return [
    { g: trayGeometry(), m: trayMaterial() },
    { g: trayTabletsGeometry(), m: tabletMaterial() },
  ];
}
