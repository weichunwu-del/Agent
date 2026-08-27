import { describe, expect, it } from "vitest";
import { aircraftById } from "../data/aircraft";
import { createSafeMission, createSampleMission } from "../data/sampleMission";
import { demoTerrain } from "./terrain";
import type { Mission, Waypoint } from "./types";
import { validateMission } from "./validate";

const aircraft = aircraftById("m30t");

function cloneMission(overrides: Partial<Mission> = {}): Mission {
  return { ...createSampleMission(), ...overrides };
}

describe("validateMission", () => {
  it("flags terrain clearance on the default ridge-clipping route", () => {
    const { trajectory, report } = validateMission(createSampleMission(), aircraft, demoTerrain);
    expect(trajectory.samples.length).toBeGreaterThan(10);
    const cruiseMin = Math.min(
      ...trajectory.samples.filter((s) => s.segmentIndex > 0).map((s) => s.altAgl),
    );
    expect(cruiseMin).toBeLessThan(aircraft.minClearance);
    const terrainHit = report.findings.find(
      (f) => f.rule === "terrain_clearance" || f.rule === "terrain_collision",
    );
    expect(terrainHit).toBeTruthy();
    expect(terrainHit?.severity).toBe("critical");
    expect(report.passed).toBe(false);
  });

  it("flags RTH height against the same ridge", () => {
    const { report } = validateMission(createSampleMission(), aircraft, demoTerrain);
    const rth = report.findings.find((f) => f.rule === "rth_terrain");
    expect(rth).toBeTruthy();
  });

  it("reports NFZ proximity without requiring penetration", () => {
    const { report } = validateMission(createSampleMission(), aircraft, demoTerrain);
    const zone = report.findings.find((f) => f.rule === "zone_proximity" || f.rule === "nfz_penetration");
    expect(zone).toBeTruthy();
  });

  it("passes after the route is raised over the ridge", () => {
    const raised = createSafeMission();
    raised.waypoints = raised.waypoints.map((w) => ({ ...w, relativeAlt: Math.max(w.relativeAlt, 140) }));
    const highRth = { ...aircraft, rthAltitudeAgl: 180 };
    const { report, trajectory } = validateMission(raised, highRth, demoTerrain);
    const cruiseMin = Math.min(
      ...trajectory.samples.filter((s) => s.segmentIndex > 0).map((s) => s.altAgl),
    );
    expect(cruiseMin).toBeGreaterThan(highRth.minClearance);
    expect(report.findings.some((f) => f.rule.startsWith("terrain"))).toBe(false);
    expect(report.critical).toBe(0);
    expect(report.passed).toBe(true);
  });

  it("rejects a single-waypoint mission", () => {
    const mission = cloneMission({
      waypoints: [createSampleMission().waypoints[0]],
    });
    const { report } = validateMission(mission, aircraft, demoTerrain);
    expect(report.findings.some((f) => f.rule === "waypoint_count")).toBe(true);
    expect(report.passed).toBe(false);
  });

  it("detects NFZ penetration when a waypoint sits inside the polygon", () => {
    const mission = createSampleMission();
    const zone = mission.zones[0];
    const inside = zone.polygon.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat / zone.polygon.length, lng: acc.lng + p.lng / zone.polygon.length }),
      { lat: 0, lng: 0 },
    );
    mission.waypoints[1] = { ...mission.waypoints[1], lat: inside.lat, lng: inside.lng };
    const { report } = validateMission(mission, aircraft, demoTerrain);
    expect(report.findings.some((f) => f.rule === "nfz_penetration")).toBe(true);
  });

  it("flags altitude above the aircraft envelope", () => {
    const mission = createSampleMission();
    mission.waypoints[2] = { ...mission.waypoints[2], relativeAlt: 800 };
    const { report } = validateMission(mission, aircraft, demoTerrain);
    expect(report.findings.some((f) => f.rule === "max_altitude")).toBe(true);
  });

  it("accumulates duration and energy along the path", () => {
    const { trajectory } = validateMission(createSampleMission(), aircraft, demoTerrain);
    expect(trajectory.duration).toBeGreaterThan(20);
    expect(trajectory.pathLength).toBeGreaterThan(800);
    expect(trajectory.energyWh).toBeGreaterThan(1);
    const last = trajectory.samples[trajectory.samples.length - 1];
    expect(last.batterySoc).toBeGreaterThan(0.5);
    expect(last.batterySoc).toBeLessThan(1);
  });
});

describe("waypoint helpers", () => {
  it("keeps waypoint indexes stable on the sample mission", () => {
    const wps: Waypoint[] = createSampleMission().waypoints;
    expect(wps.map((w) => w.index)).toEqual([1, 2, 3]);
  });
});
