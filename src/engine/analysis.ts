import { destinationPoint, distanceToPolygonMeters, haversineMeters, pointInPolygon } from "./geo";
import { demoTerrain, type TerrainSampler } from "./terrain";
import type {
  AircraftProfile,
  Mission,
  SafetyFinding,
  Sample,
  Severity,
  SimValidationResult,
} from "./types";
import { validateMission } from "./validate";
import { chainageLabel } from "../data/highwayMission";

export type Dimension = "safety" | "reachability" | "effectiveness";
export type RiskLevel = "pass" | "low" | "mid" | "high";

export interface AnalysisEvent {
  id: string;
  code: string;
  name: string;
  dimension: Dimension;
  level: RiskLevel;
  detail: string;
  locationLabel: string;
  t?: number;
  lat?: number;
  lng?: number;
  waypointIndex?: number;
  segmentIndex?: number;
  rule: string;
}

export interface DimensionScore {
  dimension: Dimension;
  displayName: string;
  caption: string;
  score: number;
  stars: number;
  worst: RiskLevel;
}

export interface Evaluation {
  scores: DimensionScore[];
  events: AnalysisEvent[];
  verdict: "pass" | "optimize" | "block";
  verdictLabel: string;
  summary: string;
  duration: number;
}

export const DIMENSION_META: Record<
  Dimension,
  { displayName: string; caption: string }
> = {
  safety: {
    displayName: "全程安全",
    caption: "从起飞到降落，会不会撞、会不会贴太近、高度速度过不过线",
  },
  reachability: {
    displayName: "航点都能到",
    caption: "电够不够飞完这条线，有没有被禁飞/限制空域挡住",
  },
  effectiveness: {
    displayName: "巡检完整有效",
    caption: "该巡的区域巡全了没有，拍出来的画面算法认不认得",
  },
};

const SAFETY_RULES = new Set([
  "waypoint_count",
  "waypoint_spacing",
  "max_altitude",
  "min_altitude",
  "terrain_collision",
  "terrain_clearance",
  "ascent_rate",
  "descent_rate",
  "max_speed",
  "turn_rate",
  "rth_terrain",
]);

const REACH_RULES = new Set([
  "nfz_penetration",
  "zone_intersection",
  "zone_proximity",
  "max_distance",
  "video_range",
  "rc_range",
  "battery_endurance",
  "battery_reserve",
]);

const EFFECT_RULES = new Set(["fov_quality", "coverage_gap"]);

export function dimensionOf(rule: string): Dimension {
  if (REACH_RULES.has(rule)) return "reachability";
  if (EFFECT_RULES.has(rule)) return "effectiveness";
  if (SAFETY_RULES.has(rule)) return "safety";
  return "safety";
}

export function severityToLevel(severity: Severity, rule: string): RiskLevel {
  if (severity === "critical") return "high";
  if (severity === "warning") return rule === "zone_proximity" ? "low" : "mid";
  return "low";
}

function displayNameFor(rule: string, fallback: string): string {
  if (rule.startsWith("terrain")) return "碰撞风险";
  if (rule === "nfz_penetration" || rule === "zone_intersection") return "空域风险";
  if (rule === "zone_proximity") return "空域邻近";
  if (rule === "fov_quality") return "检测质量不足";
  if (rule === "coverage_gap") return "区域未覆盖";
  if (rule.startsWith("battery")) return "航程不足";
  if (rule === "rth_terrain") return "返航贴障";
  if (rule === "max_altitude" || rule === "min_altitude") return "飞行参数越限";
  if (rule === "max_speed") return "超速";
  return fallback.replace(/[。.].*$/, "") || fallback;
}

function padCode(index: number): string {
  return String(index).padStart(2, "0");
}

function locationOf(finding: SafetyFinding, mission: Mission): string {
  const wp = finding.waypointIndex
    ? mission.waypoints.find((w) => w.index === finding.waypointIndex)
    : undefined;
  const chain = finding.lat != null
    ? chainageLabel(haversineMeters(mission.home, { lat: finding.lat, lng: finding.lng ?? mission.home.lng }))
    : "";
  if (finding.segmentIndex && finding.waypointIndex) {
    const from = Math.max(1, finding.waypointIndex - 1);
    return `航段 P${String(from).padStart(2, "0")}–P${String(finding.waypointIndex).padStart(2, "0")}${chain ? ` · ${chain}` : ""}`;
  }
  if (wp) {
    return `邻近航点 P${String(wp.index).padStart(2, "0")}${chain ? ` · ${chain}` : ""}`;
  }
  return chain || "全航线";
}

function extraEffectiveness(mission: Mission): Omit<SafetyFinding, "id">[] {
  const extra: Omit<SafetyFinding, "id">[] = [];
  const wps = mission.waypoints.filter((w) => w.visible);
  for (const wp of wps) {
    const tooHigh = wp.relativeAlt >= 100;
    const shallow = wp.gimbalPitch > -18;
    if (tooHigh || shallow) {
      extra.push({
        rule: "fov_quality",
        severity: "warning",
        title: "检测质量不足",
        detail: tooHigh
          ? `航点 P${String(wp.index).padStart(2, "0")} 巡检高度 ${wp.relativeAlt.toFixed(0)} m，视场偏高，算法难以稳定检出车辆故障与行人目标。`
          : `航点 P${String(wp.index).padStart(2, "0")} 云台俯仰 ${wp.gimbalPitch.toFixed(0)}°，画面过于平视，路面目标不稳定检出。`,
        recommendation: "下调巡检高度或加大云台下视角，使 FOV 满足采集要求。",
        waypointIndex: wp.index,
        lat: wp.lat,
        lng: wp.lng,
      });
      break;
    }
  }

  if (wps.length >= 2) {
    const last = wps[wps.length - 1];
    const span = haversineMeters(mission.home, last);
    if (span < 2500 && wps.length < 8) {
      extra.push({
        rule: "coverage_gap",
        severity: "warning",
        title: "区域未覆盖",
        detail: `航线末端距起飞点仅 ${(span / 1000).toFixed(2)} km，任务区域后段尚未覆盖。`,
        recommendation: "补点或延长航迹，覆盖任务目标区域。",
        waypointIndex: last.index,
        lat: last.lat,
        lng: last.lng,
      });
    }
  }
  return extra;
}

function timeForFinding(finding: SafetyFinding, samples: Sample[], fallback: number): number {
  if (finding.t != null) return finding.t;
  if (finding.lat == null || finding.lng == null || !samples.length) return fallback;
  let best = samples[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const s of samples) {
    const d = (s.lat - finding.lat) ** 2 + (s.lng - finding.lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best.t;
}

function toEvents(mission: Mission, result: SimValidationResult): AnalysisEvent[] {
  const extras = extraEffectiveness(mission).map((item, i) => ({
    id: `${item.rule}-x${i}`,
    ...item,
  }));
  const merged: SafetyFinding[] = [...result.report.findings, ...extras];
  const duration = result.trajectory.duration;

  const ranked = [...merged].sort((a, b) => {
    const rank = (s: Severity) => (s === "critical" ? 0 : s === "warning" ? 1 : 2);
    return rank(a.severity) - rank(b.severity);
  });

  return ranked.map((finding, i) => {
    const dimension = dimensionOf(finding.rule);
    return {
      id: padCode(i + 1),
      code: padCode(i + 1),
      name: displayNameFor(finding.rule, finding.title),
      dimension,
      level: severityToLevel(finding.severity, finding.rule),
      detail: finding.detail,
      locationLabel: locationOf(finding, mission),
      t: timeForFinding(finding, result.trajectory.samples, duration * 0.5),
      lat: finding.lat,
      lng: finding.lng,
      waypointIndex: finding.waypointIndex,
      segmentIndex: finding.segmentIndex,
      rule: finding.rule,
    };
  });
}

function worstLevel(events: AnalysisEvent[]): RiskLevel {
  if (events.some((e) => e.level === "high")) return "high";
  if (events.some((e) => e.level === "mid")) return "mid";
  if (events.some((e) => e.level === "low")) return "low";
  return "pass";
}

function scoreFor(worst: RiskLevel, events: AnalysisEvent[]): number {
  if (worst === "pass") return 4.8;
  if (worst === "low") return 4.3;
  if (worst === "mid") {
    const n = events.filter((e) => e.level === "mid").length;
    return Math.max(3.0, 3.8 - Math.min(0.6, (n - 1) * 0.3));
  }
  const n = events.filter((e) => e.level === "high").length;
  return Math.max(0.8, 2.6 - Math.min(1.4, (n - 1) * 0.4));
}

function starsFor(score: number): number {
  if (score >= 4.6) return 5;
  if (score >= 4.0) return 4;
  if (score >= 3.0) return 3;
  if (score >= 1.5) return 2;
  return 1;
}

export function evaluateDimensions(
  mission: Mission,
  result: SimValidationResult,
): Evaluation {
  const events = toEvents(mission, result);
  const dims: Dimension[] = ["safety", "reachability", "effectiveness"];
  const scores = dims.map((dimension) => {
    const subset = events.filter((e) => e.dimension === dimension);
    const worst = worstLevel(subset);
    const score = Number(scoreFor(worst, subset).toFixed(1));
    const meta = DIMENSION_META[dimension];
    return {
      dimension,
      displayName: meta.displayName,
      caption: meta.caption,
      score,
      stars: starsFor(score),
      worst,
    };
  });

  const hasHigh = events.some((e) => e.level === "high");
  const hasMid = events.some((e) => e.level === "mid");
  const allOk = scores.every((s) => s.score >= 4.0) && !hasHigh;

  let verdict: Evaluation["verdict"] = "pass";
  let verdictLabel = "可以进入实飞流程";
  if (hasHigh) {
    verdict = "block";
    verdictLabel = "存在风险，不建议直接执行";
  } else if (hasMid || !allOk) {
    verdict = "optimize";
    verdictLabel = "存在风险，建议优化后再执行";
  }

  const hit = events.filter((e) => e.level === "high" || e.level === "mid");
  const names = hit.slice(0, 3).map((e) => e.name).join("、");
  const summary =
    verdict === "pass"
      ? "三维均通过：全程可安全飞行，航点都能到，巡检覆盖与视场满足算法采集要求。可以进入实飞流程。"
      : `仿真发现 ${hit.length} 项需要处理的问题${names ? `（${names}）` : ""}。${verdictLabel}。请返回手动修改，或使用 AI 一键优化后再进入实飞。`;

  return {
    scores,
    events,
    verdict,
    verdictLabel,
    summary,
    duration: result.trajectory.duration,
  };
}

export function runAnalysis(
  mission: Mission,
  aircraft: AircraftProfile,
  terrain: TerrainSampler = demoTerrain,
): { result: SimValidationResult; evaluation: Evaluation } {
  const result = validateMission(mission, aircraft, terrain);
  return { result, evaluation: evaluateDimensions(mission, result) };
}

function offsetOutsideZones(mission: Mission, heading: number): Mission {
  const next = structuredClone(mission) as Mission;
  next.waypoints = next.waypoints.map((wp) => {
    let point = { lat: wp.lat, lng: wp.lng };
    for (const zone of next.zones) {
      const insideOrNear =
        pointInPolygon(point, zone.polygon) || distanceToPolygonMeters(point, zone.polygon) < 90;
      if (insideOrNear) {
        point = destinationPoint(point, heading + 90, 160);
      }
    }
    return { ...wp, lat: point.lat, lng: point.lng };
  });
  return next;
}

export function optimizeMission(
  mission: Mission,
  aircraft: AircraftProfile,
  terrain: TerrainSampler = demoTerrain,
): { mission: Mission; rthAltitudeAgl: number } {
  let next = structuredClone(mission) as Mission;
  next.id = `${mission.id}-ai`;
  next.name = mission.name.replace(/ · AI 优化$/, "") + " · AI 优化";

  const heading =
    typeof next.waypoints[0]?.heading === "number" ? next.waypoints[0].heading : 52;

  next.waypoints = next.waypoints.map((wp) => {
    const asl = next.homeElevation + wp.relativeAlt;
    const agl = asl - terrain.elevationAsl(wp.lat, wp.lng);
    let relativeAlt = wp.relativeAlt;
    let gimbalPitch = wp.gimbalPitch;
    if (agl < aircraft.minClearance + 25) {
      const needAsl = terrain.elevationAsl(wp.lat, wp.lng) + aircraft.minClearance + 40;
      relativeAlt = Math.max(relativeAlt, needAsl - next.homeElevation);
    }
    if (relativeAlt >= 100 || gimbalPitch > -18) {
      relativeAlt = Math.min(relativeAlt, 55);
      gimbalPitch = Math.min(gimbalPitch, -35);
    }
    return { ...wp, relativeAlt, gimbalPitch };
  });

  next = offsetOutsideZones(next, heading);

  return { mission: next, rthAltitudeAgl: Math.max(aircraft.rthAltitudeAgl, 180) };
}
