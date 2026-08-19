import type { LatLng } from "./types";

/** Demo area origin — suburban highway corridor used by the sample mission. */
export const DEMO_ORIGIN = { lat: 37.4068, lng: -122.0784 };

/** Ridge planted on the default WP2→WP3 climb so linear interpolation clips terrain. */
export const RIDGE_CENTER = { lat: 37.411006, lng: -122.072283 };

export interface TerrainSampler {
  elevationAsl: (lat: number, lng: number) => number;
}

/**
 * Synthetic DEM shared by safety checks and the Cesium heightmap so
 * visualized terrain and validation stay consistent.
 *
 * Base ~59 m ASL (matches the reference HUD: 178.7 − 119.7).
 * A forested ridge sits between WP2 and WP3 to force a clearance finding
 * on the default linear climb.
 */
export function sampleDemoTerrain(lat: number, lng: number): number {
  const dLat = (lat - DEMO_ORIGIN.lat) * 111_320;
  const dLng = (lng - DEMO_ORIGIN.lng) * 111_320 * Math.cos((DEMO_ORIGIN.lat * Math.PI) / 180);

  const base = 59;
  const rolling = 6 * Math.sin(dLng / 180) * Math.cos(dLat / 220);
  const valley = -8 * Math.exp(-((dLat + 40) ** 2) / 90_000);

  const ridgeEast = (lng - RIDGE_CENTER.lng) * 111_320 * Math.cos((DEMO_ORIGIN.lat * Math.PI) / 180);
  const ridgeNorth = (lat - RIDGE_CENTER.lat) * 111_320;
  const ridge = 118 * Math.exp(-(ridgeEast ** 2) / 22_000 - (ridgeNorth ** 2) / 40_000);

  const knoll = 22 * Math.exp(-((dLng + 180) ** 2) / 18_000 - ((dLat - 80) ** 2) / 16_000);

  return base + rolling + valley + ridge + knoll;
}

export const demoTerrain: TerrainSampler = {
  elevationAsl: sampleDemoTerrain,
};

export function heightmapTile(x: number, y: number, level: number, size = 32): Float32Array {
  const buffer = new Float32Array(size * size);
  const tiles = 1 << level;
  const tileWidth = 180 / tiles;
  const west = -180 + x * (360 / tiles);
  const north = 90 - y * tileWidth;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const lng = west + ((col + 0.5) / size) * (360 / tiles);
      const lat = north - ((row + 0.5) / size) * tileWidth;
      buffer[row * size + col] = sampleDemoTerrain(lat, lng);
    }
  }
  return buffer;
}

export function aglAt(point: LatLng, altAsl: number, terrain: TerrainSampler): number {
  return altAsl - terrain.elevationAsl(point.lat, point.lng);
}
