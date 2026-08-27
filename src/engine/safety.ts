import {
  distanceToPolygonMeters,
  haversineMeters,
  headingDelta,
  interpolateLatLng,
  pointInPolygon,
} from "./geo";
import type { TerrainSampler } from "./terrain";
import type {
  AircraftProfile,
  GeoZone,
  Mission,
  SafetyFinding,
  SafetyReport,
  Sample,
  Trajectory,
} from "./types";

const NEAR_ZONE_M = 80;

function finding(
  partial: Omit<SafetyFinding, "id"> & { id?: string },
  index: number,
): SafetyFinding {
  return {
    id: partial.id ?? `${partial.rule}-${index}`,
    ...partial,
  };
}

export function evaluateSafety(
  mission: Mission,
  aircraft: AircraftProfile,
  trajectory: Trajectory,
  terrain: TerrainSampler,
): SafetyReport {
  const raw: SafetyFinding[] = [];
  const push = (item: Omit<SafetyFinding, "id">) => {
    raw.push(finding(item, raw.length));
  };

  checkWaypointCount(mission, push);
  checkWaypointSpacing(mission, push);
  checkAltitudeEnvelope(mission, aircraft, trajectory, push);
  checkTerrainClearance(aircraft, trajectory, push);
  checkVerticalRate(aircraft, trajectory, push);
  checkSpeedEnvelope(aircraft, trajectory, push);
  checkTurnRate(trajectory, push);
  checkZones(mission, trajectory, push);
  checkLinkRange(aircraft, trajectory, push);
  checkBattery(aircraft, trajectory, push);
  checkRth(mission, aircraft, trajectory, terrain, push);

  const findings = dedupe(raw).sort(bySeverity);
  const critical = findings.filter((f) => f.severity === "critical").length;
  const warning = findings.filter((f) => f.severity === "warning").length;
  const info = findings.filter((f) => f.severity === "info").length;
  const passed = critical === 0;
  return {
    generatedAt: Date.now(),
    findings,
    critical,
    warning,
    info,
    passed,
    summary: summarize(critical, warning, info, trajectory),
  };
}

function checkWaypointCount(
  mission: Mission,
  push: (f: Omit<SafetyFinding, "id">) => void,
) {
  const visible = mission.waypoints.filter((w) => w.visible);
  if (visible.length < 2) {
    push({
      rule: "waypoint_count",
      severity: "critical",
      title: "航点数量不足",
      detail: "有效航点少于 2 个，无法构成可执行航线。",
      recommendation: "至少添加起飞点与一个目标航点后再进行仿真校验。",
    });
  }
}

function checkWaypointSpacing(
  mission: Mission,
  push: (f: Omit<SafetyFinding, "id">) => void,
) {
  const wps = mission.waypoints.filter((w) => w.visible);
  for (let i = 0; i < wps.length - 1; i++) {
    const dist = haversineMeters(wps[i], wps[i + 1]);
    if (dist < 1.5) {
      push({
        rule: "waypoint_spacing",
        severity: "warning",
        title: `航点 ${wps[i].index}→${wps[i + 1].index} 间距过近`,
        detail: `水平间距仅 ${dist.toFixed(1)} m，易导致姿态抖动与重复动作。`,
        recommendation: "合并航点或拉开至少 2 m。",
        waypointIndex: wps[i + 1].index,
        segmentIndex: i + 1,
        lat: wps[i + 1].lat,
        lng: wps[i + 1].lng,
      });
    }
    if (dist > 8_000) {
      push({
        rule: "waypoint_spacing",
        severity: "warning",
        title: `航点 ${wps[i].index}→${wps[i + 1].index} 跨度过大`,
        detail: `单段 ${ (dist / 1000).toFixed(2) } km，中途缺少可中断点。`,
        recommendation: "拆分航段，便于应急悬停与返航决策。",
        waypointIndex: wps[i + 1].index,
        segmentIndex: i + 1,
      });
    }
  }
}

function checkAltitudeEnvelope(
  mission: Mission,
  aircraft: AircraftProfile,
  trajectory: Trajectory,
  push: (f: Omit<SafetyFinding, "id">) => void,
) {
  for (const wp of mission.waypoints) {
    if (wp.relativeAlt > aircraft.maxAltAgl) {
      push({
        rule: "max_altitude",
        severity: "critical",
        title: `航点 ${wp.index} 超出最大相对高度`,
        detail: `相对高度 ${wp.relativeAlt.toFixed(1)} m，机型上限 ${aircraft.maxAltAgl} m。`,
        recommendation: `将航点 ${wp.index} 降至 ${aircraft.maxAltAgl} m 以下。`,
        waypointIndex: wp.index,
        lat: wp.lat,
        lng: wp.lng,
      });
    }
    if (wp.relativeAlt < aircraft.minAltAgl) {
      push({
        rule: "min_altitude",
        severity: "warning",
        title: `航点 ${wp.index} 低于建议最低高度`,
        detail: `相对高度 ${wp.relativeAlt.toFixed(1)} m，建议不低于 ${aircraft.minAltAgl} m。`,
        recommendation: "抬升航点以保留操控余量。",
        waypointIndex: wp.index,
        lat: wp.lat,
        lng: wp.lng,
      });
    }
  }

  for (const s of trajectory.samples) {
    if (s.altAgl > aircraft.maxAltAgl + 1) {
      push({
        rule: "max_altitude",
        severity: "critical",
        title: "航段超出最大离地高度",
        detail: `仿真点离地 ${s.altAgl.toFixed(1)} m，超过 ${aircraft.maxAltAgl} m。`,
        recommendation: "降低该航段高度或避开高地形上的叠加爬升。",
        t: s.t,
        lat: s.lat,
        lng: s.lng,
        altAsl: s.altAsl,
        segmentIndex: s.segmentIndex,
      });
      break;
    }
  }
}

function checkTerrainClearance(
  aircraft: AircraftProfile,
  trajectory: Trajectory,
  push: (f: Omit<SafetyFinding, "id">) => void,
) {
  let worst: Sample | null = null;
  for (const s of trajectory.samples) {
    // Vertical climb over the takeoff pad is treated as a surveyed corridor.
    if (s.segmentIndex === 0) continue;
    if (!worst || s.altAgl < worst.altAgl) worst = s;
  }
  if (!worst) return;

  if (worst.altAgl < 2) {
    push({
      rule: "terrain_collision",
      severity: "critical",
      title: "仿真预测地形碰撞",
      detail: `最低离地 ${worst.altAgl.toFixed(1)} m（地形海拔 ${worst.terrainAsl.toFixed(1)} m），航线将切入地表。`,
      recommendation: "抬升该航段，或绕开脊线 / 建筑群。",
      t: worst.t,
      lat: worst.lat,
      lng: worst.lng,
      altAsl: worst.altAsl,
      segmentIndex: worst.segmentIndex,
      waypointIndex: worst.toWaypoint,
    });
    return;
  }

  if (worst.altAgl < aircraft.minClearance) {
    push({
      rule: "terrain_clearance",
      severity: "critical",
      title: "离地间隙不足",
      detail: `最低离地 ${worst.altAgl.toFixed(1)} m，低于安全间隙 ${aircraft.minClearance} m。脊线海拔约 ${worst.terrainAsl.toFixed(1)} m。`,
      recommendation: `将该航段至少抬升至地形 + ${aircraft.minClearance} m，或改走谷地。`,
      t: worst.t,
      lat: worst.lat,
      lng: worst.lng,
      altAsl: worst.altAsl,
      segmentIndex: worst.segmentIndex,
      waypointIndex: worst.toWaypoint,
    });
    return;
  }

  if (worst.altAgl < aircraft.minClearance * 1.6) {
    push({
      rule: "terrain_clearance",
      severity: "warning",
      title: "离地间隙接近下限",
      detail: `最低离地 ${worst.altAgl.toFixed(1)} m，仅略高于 ${aircraft.minClearance} m 安全间隙。`,
      recommendation: "为风切变与定位误差预留额外 10–15 m。",
      t: worst.t,
      lat: worst.lat,
      lng: worst.lng,
      altAsl: worst.altAsl,
      segmentIndex: worst.segmentIndex,
    });
  }
}

function checkVerticalRate(
  aircraft: AircraftProfile,
  trajectory: Trajectory,
  push: (f: Omit<SafetyFinding, "id">) => void,
) {
  const samples = trajectory.samples;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const dt = b.t - a.t;
    if (dt < 1e-3) continue;
    const vs = (b.altAsl - a.altAsl) / dt;
    if (vs > aircraft.maxAscent + 0.4) {
      push({
        rule: "ascent_rate",
        severity: "warning",
        title: "爬升率超出机型能力",
        detail: `仿真段爬升 ${vs.toFixed(1)} m/s，机型上限 ${aircraft.maxAscent} m/s，实际将滞后于规划高度。`,
        recommendation: "拉长水平距离或降低目标高度差。",
        t: b.t,
        lat: b.lat,
        lng: b.lng,
        segmentIndex: b.segmentIndex,
      });
      break;
    }
    if (vs < -(aircraft.maxDescent + 0.4)) {
      push({
        rule: "descent_rate",
        severity: "warning",
        title: "下降率超出机型能力",
        detail: `仿真段下降 ${Math.abs(vs).toFixed(1)} m/s，机型上限 ${aircraft.maxDescent} m/s。`,
        recommendation: "提前开始下降，避免末端陡降贴近障碍。",
        t: b.t,
        lat: b.lat,
        lng: b.lng,
        segmentIndex: b.segmentIndex,
      });
      break;
    }
  }
}

function checkSpeedEnvelope(
  aircraft: AircraftProfile,
  trajectory: Trajectory,
  push: (f: Omit<SafetyFinding, "id">) => void,
) {
  const over = trajectory.samples.find((s) => s.speed > aircraft.maxSpeed + 0.05);
  if (over) {
    push({
      rule: "max_speed",
      severity: "warning",
      title: "航点速度超出包线",
      detail: `规划速度 ${over.speed.toFixed(1)} m/s，机型最大 ${aircraft.maxSpeed} m/s。`,
      recommendation: "降低该航段速度，或切换更高速机型。",
      t: over.t,
      waypointIndex: over.toWaypoint,
      segmentIndex: over.segmentIndex,
    });
  }
}

function checkTurnRate(
  trajectory: Trajectory,
  push: (f: Omit<SafetyFinding, "id">) => void,
) {
  const samples = trajectory.samples;
  for (let i = 2; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const dt = b.t - a.t;
    if (dt < 0.15 || a.speed < 2) continue;
    const yawRate = Math.abs(headingDelta(a.heading, b.heading)) / dt;
    if (yawRate > 45) {
      push({
        rule: "turn_rate",
        severity: "warning",
        title: "转弯过急",
        detail: `航向变化约 ${yawRate.toFixed(0)} °/s，高速下易失速或切出走廊。`,
        recommendation: "插入过渡航点，或在转弯前减速。",
        t: b.t,
        lat: b.lat,
        lng: b.lng,
        segmentIndex: b.segmentIndex,
      });
      break;
    }
  }
}

function checkZones(
  mission: Mission,
  trajectory: Trajectory,
  push: (f: Omit<SafetyFinding, "id">) => void,
) {
  for (const zone of mission.zones) {
    const hit = firstZoneHit(trajectory, zone);
    if (hit) {
      const severity = zone.kind === "nfz" ? "critical" : zone.kind === "restricted" ? "warning" : "info";
      push({
        rule: zone.kind === "nfz" ? "nfz_penetration" : "zone_intersection",
        severity,
        title: zone.kind === "nfz" ? `航线进入禁飞区「${zone.name}」` : `航线进入限制区「${zone.name}」`,
        detail: `约 T+${hit.t.toFixed(1)}s 进入 ${zone.name}。`,
        recommendation: "平移航点使航段完全位于区外，并保留 ≥80 m 缓冲。",
        t: hit.t,
        lat: hit.lat,
        lng: hit.lng,
        segmentIndex: hit.segmentIndex,
      });
      continue;
    }

    let nearest = Number.POSITIVE_INFINITY;
    let nearestSample = trajectory.samples[0];
    for (const s of trajectory.samples) {
      const d = distanceToPolygonMeters(s, zone.polygon);
      if (d < nearest) {
        nearest = d;
        nearestSample = s;
      }
    }
    if (nearest < NEAR_ZONE_M && zone.kind !== "warn") {
      push({
        rule: "zone_proximity",
        severity: "info",
        title: `航线距「${zone.name}」仅 ${nearest.toFixed(0)} m`,
        detail: "侧向余量不足，定位误差或侧风可能压线。",
        recommendation: "向外平移航线，保持 80 m 以上缓冲。",
        t: nearestSample?.t,
        lat: nearestSample?.lat,
        lng: nearestSample?.lng,
      });
    }
  }
}

function firstZoneHit(trajectory: Trajectory, zone: GeoZone): Sample | null {
  for (const s of trajectory.samples) {
    if (pointInPolygon(s, zone.polygon)) return s;
  }
  return null;
}

function checkLinkRange(
  aircraft: AircraftProfile,
  trajectory: Trajectory,
  push: (f: Omit<SafetyFinding, "id">) => void,
) {
  let farthest: Sample | null = null;
  for (const s of trajectory.samples) {
    if (!farthest || s.distanceFromHome > farthest.distanceFromHome) farthest = s;
  }
  if (!farthest) return;
  if (farthest.distanceFromHome > aircraft.maxDistance) {
    push({
      rule: "max_distance",
      severity: "critical",
      title: "超出限飞半径",
      detail: `最远点距 Home ${ (farthest.distanceFromHome / 1000).toFixed(2) } km，限飞 ${ (aircraft.maxDistance / 1000).toFixed(1) } km。`,
      recommendation: "缩短航线或把 Home 点前移。",
      t: farthest.t,
      lat: farthest.lat,
      lng: farthest.lng,
    });
  } else if (farthest.distanceFromHome > aircraft.videoRange) {
    push({
      rule: "video_range",
      severity: "warning",
      title: "超出图传可靠距离",
      detail: `最远 ${ (farthest.distanceFromHome / 1000).toFixed(2) } km，图传参考 ${ (aircraft.videoRange / 1000).toFixed(1) } km。`,
      recommendation: "升高天线或在中途增加中继观察点。",
      t: farthest.t,
      lat: farthest.lat,
      lng: farthest.lng,
    });
  } else if (farthest.distanceFromHome > aircraft.rcRange * 0.85) {
    push({
      rule: "rc_range",
      severity: "info",
      title: "接近遥控链路边缘",
      detail: `最远 ${ (farthest.distanceFromHome / 1000).toFixed(2) } km，遥控参考 ${ (aircraft.rcRange / 1000).toFixed(1) } km。`,
      recommendation: "确认遮挡与电磁环境，必要时缩短航线。",
      t: farthest.t,
    });
  }
}

function checkBattery(
  aircraft: AircraftProfile,
  trajectory: Trajectory,
  push: (f: Omit<SafetyFinding, "id">) => void,
) {
  if (!trajectory.samples.length) return;
  const last = trajectory.samples[trajectory.samples.length - 1];
  const rthDistance = last.distanceFromHome;
  const rthTime = rthDistance / Math.max(8, aircraft.cruiseSpeed * 0.85) + 20;
  const rthWh = (aircraft.cruisePowerW * rthTime) / 3600;
  const reserveWh = aircraft.batteryWh * (aircraft.reservePercent / 100);
  const need = trajectory.energyWh + rthWh + reserveWh;
  const remainWh = aircraft.batteryWh * last.batterySoc;

  if (need > aircraft.batteryWh) {
    push({
      rule: "battery_endurance",
      severity: "critical",
      title: "电量不足以完成任务并返航",
      detail: `任务 ${trajectory.energyWh.toFixed(1)} Wh + 返航 ${rthWh.toFixed(1)} Wh + 预留 ${reserveWh.toFixed(1)} Wh，超过电池 ${aircraft.batteryWh.toFixed(0)} Wh。`,
      recommendation: "缩短航线、降速，或在中途规划备降点。",
      t: last.t,
    });
  } else if (remainWh < rthWh + reserveWh) {
    push({
      rule: "battery_reserve",
      severity: "warning",
      title: "任务结束时返航余量不足",
      detail: `终点剩余 ${remainWh.toFixed(1)} Wh，返航+预留需要 ${(rthWh + reserveWh).toFixed(1)} Wh。`,
      recommendation: "提高返航触发电量，或减少悬停拍照时间。",
      t: last.t,
    });
  }
}

function checkRth(
  mission: Mission,
  aircraft: AircraftProfile,
  trajectory: Trajectory,
  terrain: TerrainSampler,
  push: (f: Omit<SafetyFinding, "id">) => void,
) {
  if (!trajectory.samples.length) return;
  const rthAsl = mission.homeElevation + aircraft.rthAltitudeAgl;
  let worstClear = Number.POSITIVE_INFINITY;
  let worstSample: Sample | null = null;
  let worstTerrain = 0;

  const checkpoints = stride(trajectory.samples, 6);
  for (const s of checkpoints) {
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const p = interpolateLatLng(s, mission.home, u);
      const ground = terrain.elevationAsl(p.lat, p.lng);
      const clearance = rthAsl - ground;
      if (clearance < worstClear) {
        worstClear = clearance;
        worstSample = s;
        worstTerrain = ground;
      }
    }
  }

  if (worstSample && worstClear < aircraft.minClearance) {
    push({
      rule: "rth_terrain",
      severity: worstClear < 2 ? "critical" : "warning",
      title: "返航高度无法越过沿途地形",
      detail: `RTH 高度 ${aircraft.rthAltitudeAgl.toFixed(0)} m AGL（海拔 ${rthAsl.toFixed(0)} m）在返航走廊上距脊线仅 ${worstClear.toFixed(1)} m（脊线海拔 ${worstTerrain.toFixed(0)} m）。`,
      recommendation: `将返航高度提升至至少 ${(worstTerrain - mission.homeElevation + aircraft.minClearance).toFixed(0)} m，或规划绕飞走廊。`,
      t: worstSample.t,
      lat: worstSample.lat,
      lng: worstSample.lng,
    });
  }
}

function stride<T>(items: T[], step: number): T[] {
  if (items.length <= 2) return items;
  const out: T[] = [];
  for (let i = 0; i < items.length; i += step) out.push(items[i]);
  const last = items[items.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function dedupe(findings: SafetyFinding[]): SafetyFinding[] {
  const seen = new Set<string>();
  const out: SafetyFinding[] = [];
  for (const f of findings) {
    const key = `${f.rule}|${f.title}|${f.segmentIndex ?? ""}|${f.waypointIndex ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function bySeverity(a: SafetyFinding, b: SafetyFinding): number {
  const order = { critical: 0, warning: 1, info: 2 };
  return order[a.severity] - order[b.severity];
}

function summarize(critical: number, warning: number, info: number, trajectory: Trajectory): string {
  if (!trajectory.samples.length) return "尚无可用航迹，无法完成仿真校验。";
  if (critical > 0) {
    return `校验未通过：发现 ${critical} 项致命风险、${warning} 项警告。请先修复后再执行实飞。`;
  }
  if (warning > 0) {
    return `无碰撞级风险，仍有 ${warning} 项警告、${info} 项提示，建议复核后放飞。`;
  }
  return `仿真航迹 ${trajectory.duration.toFixed(0)}s / ${(trajectory.pathLength / 1000).toFixed(2)} km，未发现安全违规。`;
}
