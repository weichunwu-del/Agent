import { bearingDeg, haversineMeters, interpolateLatLng, lerp } from "./geo";
import type { AircraftProfile, Mission, Sample, Trajectory, Waypoint } from "./types";
import type { TerrainSampler } from "./terrain";

const SAMPLE_HZ = 8;

function aslOf(wp: Waypoint, homeElevation: number): number {
  return homeElevation + wp.relativeAlt;
}

function climbTime(dAlt: number, aircraft: AircraftProfile): number {
  if (dAlt > 0) return dAlt / aircraft.maxAscent;
  if (dAlt < 0) return Math.abs(dAlt) / aircraft.maxDescent;
  return 0;
}

function cruisePower(speed: number, aircraft: AircraftProfile): number {
  const ratio = Math.max(0.35, speed / Math.max(1, aircraft.cruiseSpeed));
  return aircraft.hoverPowerW * 0.55 + aircraft.cruisePowerW * 0.45 * ratio;
}

export function buildTrajectory(
  mission: Mission,
  aircraft: AircraftProfile,
  terrain: TerrainSampler,
): Trajectory {
  const samples: Sample[] = [];
  const home = mission.home;
  const wps = mission.waypoints.filter((w) => w.visible);
  if (wps.length === 0) {
    return emptyTrajectory();
  }

  let t = 0;
  let energyWh = 0;
  let pathDistance = 0;
  let maxAsl = Number.NEGATIVE_INFINITY;
  let minAgl = Number.POSITIVE_INFINITY;

  const pushSample = (
    point: { lat: number; lng: number; altAsl: number },
    heading: number,
    speed: number,
    segmentIndex: number,
    fromWaypoint: number,
    toWaypoint: number,
    gimbalPitch: number,
    gimbalYaw: number,
    dt: number,
    powerW: number,
  ) => {
    energyWh += (powerW * dt) / 3600;
    const used = energyWh / aircraft.batteryWh;
    const terrainAsl = terrain.elevationAsl(point.lat, point.lng);
    const altAgl = point.altAsl - terrainAsl;
    const distanceFromHome = haversineMeters(home, point);
    maxAsl = Math.max(maxAsl, point.altAsl);
    minAgl = Math.min(minAgl, altAgl);
    samples.push({
      t,
      lat: point.lat,
      lng: point.lng,
      altAsl: point.altAsl,
      altAgl,
      terrainAsl,
      heading,
      pitch: clamp((-speed / 40) * 4, -8, 6),
      roll: 0,
      speed,
      batterySoc: Math.max(0, 1 - used),
      distanceFromHome,
      pathDistance,
      segmentIndex,
      fromWaypoint,
      toWaypoint,
      gimbalPitch,
      gimbalYaw,
    });
    t += dt;
  };

  const first = wps[0];
  const takeoffAsl = aslOf(first, mission.homeElevation);
  const takeoffHeading = first.heading === "auto" ? 0 : first.heading;
  const takeoffDuration = Math.max(2, climbTime(first.relativeAlt, aircraft) + 1.5);
  const takeoffSteps = Math.max(2, Math.ceil(takeoffDuration * SAMPLE_HZ));
  for (let i = 0; i <= takeoffSteps; i++) {
    const u = i / takeoffSteps;
    const altAsl = lerp(mission.homeElevation + 1, takeoffAsl, smooth(u));
    const dt = takeoffDuration / takeoffSteps;
    pushSample(
      { lat: first.lat, lng: first.lng, altAsl },
      takeoffHeading,
      0.4,
      0,
      0,
      0,
      first.gimbalPitch,
      first.gimbalYaw,
      dt,
      aircraft.hoverPowerW,
    );
  }

  for (let s = 0; s < wps.length - 1; s++) {
    const from = wps[s];
    const to = wps[s + 1];
    const a = { lat: from.lat, lng: from.lng };
    const b = { lat: to.lat, lng: to.lng };
    const horiz = haversineMeters(a, b);
    const fromAsl = aslOf(from, mission.homeElevation);
    const toAsl = aslOf(to, mission.homeElevation);
    const speed = Math.min(aircraft.maxSpeed, Math.max(1, to.speed || from.speed));
    const horizTime = horiz / speed;
    const vertTime = climbTime(toAsl - fromAsl, aircraft);
    const duration = Math.max(horizTime, vertTime, 0.4);
    const steps = Math.max(2, Math.ceil(duration * SAMPLE_HZ));
    const headingAuto = horiz > 0.3 ? bearingDeg(a, b) : (to.heading === "auto" ? from.heading === "auto" ? 0 : from.heading : to.heading);
    const endHeading = to.heading === "auto" ? headingAuto : to.heading;

    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const p = interpolateLatLng(a, b, u);
      const altAsl = lerp(fromAsl, toAsl, u);
      const heading = lerpHeading(headingAuto, endHeading, u);
      const dt = duration / steps;
      pathDistance += horiz / steps;
      const gimbalPitch = lerp(from.gimbalPitch, to.gimbalPitch, u);
      const gimbalYaw = lerp(from.gimbalYaw, to.gimbalYaw, u);
      pushSample(
        { ...p, altAsl },
        heading,
        speed,
        s + 1,
        from.index,
        to.index,
        gimbalPitch,
        gimbalYaw,
        dt,
        cruisePower(speed, aircraft),
      );
    }

    if (to.hoverSeconds > 0) {
      const hoverSteps = Math.max(1, Math.ceil(to.hoverSeconds * SAMPLE_HZ));
      for (let i = 1; i <= hoverSteps; i++) {
        const dt = to.hoverSeconds / hoverSteps;
        pushSample(
          { lat: to.lat, lng: to.lng, altAsl: toAsl },
          endHeading,
          0,
          s + 1,
          to.index,
          to.index,
          to.gimbalPitch,
          to.gimbalYaw,
          dt,
          aircraft.hoverPowerW,
        );
      }
    }
  }

  return {
    samples,
    duration: samples.length ? samples[samples.length - 1].t : 0,
    pathLength: pathDistance,
    maxAsl: Number.isFinite(maxAsl) ? maxAsl : mission.homeElevation,
    minAgl: Number.isFinite(minAgl) ? minAgl : 0,
    energyWh,
  };
}

function emptyTrajectory(): Trajectory {
  return {
    samples: [],
    duration: 0,
    pathLength: 0,
    maxAsl: 0,
    minAgl: 0,
    energyWh: 0,
  };
}

function smooth(u: number): number {
  return u * u * (3 - 2 * u);
}

function lerpHeading(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return ((a + d * t) % 360 + 360) % 360;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function sampleAt(trajectory: Trajectory, time: number): Sample | null {
  const { samples } = trajectory;
  if (!samples.length) return null;
  if (time <= samples[0].t) return samples[0];
  if (time >= samples[samples.length - 1].t) return samples[samples.length - 1];
  let lo = 0;
  let hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= time) lo = mid;
    else hi = mid;
  }
  return samples[lo];
}
