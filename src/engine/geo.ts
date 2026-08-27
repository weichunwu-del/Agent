import type { LatLng } from "./types";

export const EARTH_RADIUS_M = 6_371_000;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function wrapHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function headingDelta(from: number, to: number): number {
  const d = wrapHeading(to - from);
  return d > 180 ? d - 360 : d;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return wrapHeading(toDeg(Math.atan2(y, x)));
}

export function interpolateLatLng(a: LatLng, b: LatLng, t: number): LatLng {
  const clamped = Math.min(1, Math.max(0, t));
  return {
    lat: a.lat + (b.lat - a.lat) * clamped,
    lng: a.lng + (b.lng - a.lng) * clamped,
  };
}

export function destinationPoint(start: LatLng, heading: number, distanceM: number): LatLng {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = toRad(heading);
  const φ1 = toRad(start.lat);
  const λ1 = toRad(start.lng);
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(Math.min(1, Math.max(-1, sinφ2)));
  const λ2 =
    λ1 + Math.atan2(Math.sin(θ) * sinδ * cosφ1, cosδ - sinφ1 * Math.sin(φ2));
  return { lat: toDeg(φ2), lng: toDeg(λ2) };
}

export function pointInPolygon(point: LatLng, ring: LatLng[]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng;
    const yi = ring[i].lat;
    const xj = ring[j].lng;
    const yj = ring[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function orientation(a: LatLng, b: LatLng, c: LatLng): number {
  const v = (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
  if (Math.abs(v) < 1e-15) return 0;
  return v > 0 ? 1 : 2;
}

function onSegment(a: LatLng, b: LatLng, c: LatLng): boolean {
  return (
    Math.min(a.lat, c.lat) - 1e-12 <= b.lat &&
    b.lat <= Math.max(a.lat, c.lat) + 1e-12 &&
    Math.min(a.lng, c.lng) - 1e-12 <= b.lng &&
    b.lng <= Math.max(a.lng, c.lng) + 1e-12
  );
}

export function segmentsIntersect(p1: LatLng, q1: LatLng, p2: LatLng, q2: LatLng): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

export function segmentIntersectsPolygon(a: LatLng, b: LatLng, ring: LatLng[]): boolean {
  if (pointInPolygon(a, ring) || pointInPolygon(b, ring)) return true;
  for (let i = 0; i < ring.length; i++) {
    const c = ring[i];
    const d = ring[(i + 1) % ring.length];
    if (segmentsIntersect(a, b, c, d)) return true;
  }
  return false;
}

export function distanceToPolygonMeters(point: LatLng, ring: LatLng[]): number {
  if (ring.length < 2) return Number.POSITIVE_INFINITY;
  if (pointInPolygon(point, ring)) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    min = Math.min(min, distanceToSegmentMeters(point, a, b));
  }
  return min;
}

export function distanceToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const ab = haversineMeters(a, b);
  if (ab < 1e-6) return haversineMeters(p, a);
  const ap = haversineMeters(a, p);
  const bp = haversineMeters(b, p);
  const bearingAB = bearingDeg(a, b);
  const bearingAP = bearingDeg(a, p);
  const along = ap * Math.cos(toRad(headingDelta(bearingAB, bearingAP)));
  if (along <= 0) return ap;
  if (along >= ab) return bp;
  const cross = Math.abs(ap * Math.sin(toRad(headingDelta(bearingAB, bearingAP))));
  return cross;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
