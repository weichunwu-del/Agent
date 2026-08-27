export type Severity = "critical" | "warning" | "info";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LatLngAlt extends LatLng {
  alt: number;
}

export type WaypointAction =
  | "takePhoto"
  | "startRecord"
  | "stopRecord"
  | "hover"
  | "gimbalAim"
  | "zoom";

export interface Waypoint {
  id: string;
  index: number;
  lat: number;
  lng: number;
  /** Height above takeoff / home ellipsoid, meters. */
  relativeAlt: number;
  heading: number | "auto";
  speed: number;
  gimbalPitch: number;
  gimbalYaw: number;
  hoverSeconds: number;
  actions: WaypointAction[];
  visible: boolean;
}

export interface AircraftProfile {
  id: string;
  name: string;
  maxSpeed: number;
  cruiseSpeed: number;
  maxAscent: number;
  maxDescent: number;
  maxAltAgl: number;
  minAltAgl: number;
  minClearance: number;
  maxDistance: number;
  rcRange: number;
  videoRange: number;
  batteryWh: number;
  hoverPowerW: number;
  cruisePowerW: number;
  reservePercent: number;
  rthAltitudeAgl: number;
  massKg: number;
}

export interface GeoZone {
  id: string;
  name: string;
  kind: "nfz" | "restricted" | "warn";
  polygon: LatLng[];
}

export interface Mission {
  id: string;
  name: string;
  aircraftId: string;
  home: LatLng;
  homeElevation: number;
  waypoints: Waypoint[];
  zones: GeoZone[];
  area?: string;
  content?: string;
  simTaskId?: string;
}

export interface Sample {
  t: number;
  lat: number;
  lng: number;
  altAsl: number;
  altAgl: number;
  terrainAsl: number;
  heading: number;
  pitch: number;
  roll: number;
  speed: number;
  batterySoc: number;
  distanceFromHome: number;
  pathDistance: number;
  segmentIndex: number;
  fromWaypoint: number;
  toWaypoint: number;
  gimbalPitch: number;
  gimbalYaw: number;
}

export interface Trajectory {
  samples: Sample[];
  duration: number;
  pathLength: number;
  maxAsl: number;
  minAgl: number;
  energyWh: number;
}

export interface SafetyFinding {
  id: string;
  rule: string;
  severity: Severity;
  title: string;
  detail: string;
  recommendation: string;
  t?: number;
  lat?: number;
  lng?: number;
  altAsl?: number;
  waypointIndex?: number;
  segmentIndex?: number;
}

export interface SafetyReport {
  generatedAt: number;
  findings: SafetyFinding[];
  critical: number;
  warning: number;
  info: number;
  passed: boolean;
  summary: string;
}

export interface SimValidationResult {
  trajectory: Trajectory;
  report: SafetyReport;
}
