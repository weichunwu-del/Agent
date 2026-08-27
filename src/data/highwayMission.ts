import { DEMO_ORIGIN, RIDGE_CENTER } from "../engine/terrain";
import { destinationPoint } from "../engine/geo";
import type { Mission, Waypoint } from "../engine/types";

const HEADING = 52;
const SPACING = 330;
const COUNT = 32;

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
    heading: extras.heading ?? "auto",
    speed: extras.speed ?? 12,
    gimbalPitch: extras.gimbalPitch ?? -28,
    gimbalYaw: extras.gimbalYaw ?? 0,
    hoverSeconds: extras.hoverSeconds ?? 0,
    actions: extras.actions ?? [],
    visible: true,
    ...extras,
  };
}

/**
 * PRD demo: 绕城高速 K1–K4 巡检.
 * - Early waypoints clip the synthetic ridge (safety / collision).
 * - Mid corridor punches a restricted box (reachability / airspace).
 * - Later cruise is too high with a shallow gimbal (effectiveness / FOV).
 */
export function createHighwayMission(): Mission {
  const home = { lat: DEMO_ORIGIN.lat, lng: DEMO_ORIGIN.lng };
  const waypoints: Waypoint[] = [];

  for (let i = 1; i <= COUNT; i++) {
    const pos =
      i === 4
        ? { lat: RIDGE_CENTER.lat, lng: RIDGE_CENTER.lng }
        : destinationPoint(home, HEADING, (i - 1) * SPACING);

    let relativeAlt = 80;
    let gimbalPitch = -28;
    let speed = 12;
    const extras: Partial<Waypoint> = {};

    if (i === 1) {
      relativeAlt = 32;
      speed = 8;
      gimbalPitch = -20;
      extras.heading = HEADING;
      extras.actions = ["takePhoto"];
      extras.hoverSeconds = 1.2;
    } else if (i >= 16 && i <= 18) {
      relativeAlt = 118;
      gimbalPitch = -8;
    }

    waypoints.push(wp(i, pos.lat, pos.lng, relativeAlt, { ...extras, speed, gimbalPitch }));
  }

  const p12 = waypoints[11];
  const p14 = waypoints[13];
  const restricted = [
    destinationPoint(p12, HEADING + 90, 90),
    destinationPoint(p14, HEADING + 90, 90),
    destinationPoint(p14, HEADING - 90, 90),
    destinationPoint(p12, HEADING - 90, 90),
  ];

  return {
    id: "mission-k14",
    name: "绕城高速 K1-K4 巡检任务",
    aircraftId: "evo-max-4t",
    home,
    homeElevation: 59,
    area: "绕城高速 K1-K4",
    content: "车辆故障、行人闯入",
    simTaskId: "SIM-20260821-K14",
    waypoints,
    zones: [
      {
        id: "restricted-k2",
        name: "K2 限制空域",
        kind: "restricted",
        polygon: restricted,
      },
    ],
  };
}

export function chainageLabel(pathMeters: number): string {
  const km = Math.floor(pathMeters / 1000);
  const m = Math.round(pathMeters - km * 1000);
  return `K${Math.max(1, km + 1)}+${m.toString().padStart(3, "0")}`;
}
