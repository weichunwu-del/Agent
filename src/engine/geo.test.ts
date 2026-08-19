import { describe, expect, it } from "vitest";
import { formatEta } from "./validate";
import {
  bearingDeg,
  haversineMeters,
  headingDelta,
  pointInPolygon,
  segmentIntersectsPolygon,
  wrapHeading,
} from "./geo";

describe("geo", () => {
  it("computes short-range haversine close to planar meters", () => {
    const a = { lat: 37.4068, lng: -122.0784 };
    const b = { lat: 37.4068, lng: -122.0774 };
    const d = haversineMeters(a, b);
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(100);
  });

  it("returns ~0 for identical points", () => {
    const p = { lat: 22.5, lng: 114.1 };
    expect(haversineMeters(p, p)).toBeLessThan(1e-6);
  });

  it("bearing is eastward for same-lat increasing lng", () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 0, lng: 0.01 };
    expect(bearingDeg(a, b)).toBeGreaterThan(85);
    expect(bearingDeg(a, b)).toBeLessThan(95);
  });

  it("wraps heading and signed delta", () => {
    expect(wrapHeading(-10)).toBe(350);
    expect(headingDelta(350, 10)).toBeCloseTo(20, 5);
    expect(headingDelta(10, 350)).toBeCloseTo(-20, 5);
  });

  it("detects point in polygon and segment crossing", () => {
    const square = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 1 },
      { lat: 1, lng: 0 },
    ];
    expect(pointInPolygon({ lat: 0.5, lng: 0.5 }, square)).toBe(true);
    expect(pointInPolygon({ lat: 2, lng: 2 }, square)).toBe(false);
    expect(
      segmentIntersectsPolygon({ lat: -1, lng: 0.5 }, { lat: 2, lng: 0.5 }, square),
    ).toBe(true);
    expect(
      segmentIntersectsPolygon({ lat: 2, lng: 2 }, { lat: 3, lng: 3 }, square),
    ).toBe(false);
  });
});

describe("formatEta", () => {
  it("does not render 1m 60s", () => {
    expect(formatEta(119.6)).toBe("2m 00s");
    expect(formatEta(59.4)).toBe("59s");
  });
});
