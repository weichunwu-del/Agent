import { DEMO_ORIGIN } from "../engine/terrain";
import { destinationPoint } from "../engine/geo";
import type { Mission, Waypoint } from "../engine/types";

function wp(
  index: number,
  lat: number,
  lng: number,
  relativeAlt: number,
  extras: Partial<Waypoint> = {},
): Waypoint {
  return {
    id: `wp-${index}`,
    index,
    lat,
    lng,
    relativeAlt,
    heading: "auto",
    speed: extras.speed ?? 10,
    gimbalPitch: extras.gimbalPitch ?? -35,
    gimbalYaw: extras.gimbalYaw ?? 0,
    hoverSeconds: extras.hoverSeconds ?? 0,
    actions: extras.actions ?? [],
    visible: true,
    ...extras,
  };
}

const home = { lat: DEMO_ORIGIN.lat, lng: DEMO_ORIGIN.lng };
const p2 = destinationPoint(home, 52, 420);
const p3 = destinationPoint(home, 48, 980);

const nfzWest = [
  destinationPoint(p2, 322, 50),
  destinationPoint(p3, 318, 50),
  destinationPoint(p3, 318, 170),
  destinationPoint(p2, 322, 170),
];

/**
 * Default demo route:
 * - 3 waypoints along a highway corridor (matches the reference HUD)
 * - Linear climb from WP2 → WP3 clips the forested ridge (terrain finding)
 * - RTH at 50 m AGL cannot clear the same ridge
 * - Path skirts a campus NFZ (proximity info)
 */
export function createSampleMission(): Mission {
  return {
    id: "mission-16",
    name: "新建航点路线(16)",
    aircraftId: "m30t",
    home,
    homeElevation: 59,
    waypoints: [
      wp(1, home.lat, home.lng, 32, {
        heading: 52,
        speed: 8,
        gimbalPitch: -20,
        actions: ["takePhoto"],
        hoverSeconds: 1.5,
      }),
      wp(2, p2.lat, p2.lng, 48, {
        speed: 10,
        gimbalPitch: -28,
        actions: ["startRecord"],
      }),
      wp(3, p3.lat, p3.lng, 119.7, {
        speed: 10,
        heading: 52,
        gimbalPitch: -42,
        actions: ["zoom", "takePhoto"],
        hoverSeconds: 2,
      }),
    ],
    zones: [
      {
        id: "nfz-campus",
        name: "园区禁飞",
        kind: "nfz",
        polygon: nfzWest,
      },
    ],
  };
}

export function createSafeMission(): Mission {
  const mission = createSampleMission();
  mission.id = "mission-16-safe";
  mission.name = "新建航点路线(16) · 抬升修订";
  mission.waypoints = mission.waypoints.map((w) => ({
    ...w,
    relativeAlt: Math.max(w.relativeAlt, w.index === 2 ? 130 : w.relativeAlt),
  }));
  mission.waypoints[2] = { ...mission.waypoints[2], relativeAlt: 160 };
  return mission;
}
