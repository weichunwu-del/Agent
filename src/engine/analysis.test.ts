import { describe, expect, it } from "vitest";
import { aircraftById } from "../data/aircraft";
import { createHighwayMission } from "../data/highwayMission";
import { createSampleMission } from "../data/sampleMission";
import { dimensionOf, optimizeMission, runAnalysis } from "./analysis";
import { formatClock } from "./validate";

describe("dimension mapping", () => {
  it("keeps collision in safety, airspace in reachability, FOV in effectiveness", () => {
    expect(dimensionOf("terrain_collision")).toBe("safety");
    expect(dimensionOf("terrain_clearance")).toBe("safety");
    expect(dimensionOf("nfz_penetration")).toBe("reachability");
    expect(dimensionOf("zone_intersection")).toBe("reachability");
    expect(dimensionOf("battery_endurance")).toBe("reachability");
    expect(dimensionOf("fov_quality")).toBe("effectiveness");
    expect(dimensionOf("coverage_gap")).toBe("effectiveness");
  });
});

describe("highway mission analysis", () => {
  it("flags safety, reachability and effectiveness on the default K1-K4 route", () => {
    const mission = createHighwayMission();
    const aircraft = aircraftById(mission.aircraftId);
    const { evaluation } = runAnalysis(mission, aircraft);
    const names = evaluation.events.map((e) => e.name);
    expect(names.some((n) => n.includes("碰撞") || n.includes("贴障") || n.includes("返航"))).toBe(true);
    expect(evaluation.events.some((e) => e.dimension === "reachability")).toBe(true);
    expect(evaluation.events.some((e) => e.rule === "fov_quality")).toBe(true);
    expect(evaluation.verdict).not.toBe("pass");
    expect(evaluation.scores).toHaveLength(3);
    expect(evaluation.scores.map((s) => s.displayName)).toEqual([
      "全程安全",
      "航点都能到",
      "巡检完整有效",
    ]);
  });

  it("AI optimize raises / reroutes / lowers FOV so high risks drop", () => {
    const mission = createHighwayMission();
    const aircraft = aircraftById(mission.aircraftId);
    const before = runAnalysis(mission, aircraft).evaluation;
    expect(before.events.some((e) => e.level === "high")).toBe(true);

    const { mission: next, rthAltitudeAgl } = optimizeMission(mission, aircraft);
    const raised = { ...aircraft, rthAltitudeAgl };
    const after = runAnalysis(next, raised).evaluation;
    expect(after.events.filter((e) => e.level === "high").length).toBeLessThan(
      before.events.filter((e) => e.level === "high").length,
    );
    expect(after.events.some((e) => e.rule === "fov_quality")).toBe(false);
  });
});

describe("sample mission still produces terrain findings via analysis wrap", () => {
  it("maps ridge clip to safety", () => {
    const mission = createSampleMission();
    const aircraft = aircraftById(mission.aircraftId);
    const { evaluation } = runAnalysis(mission, aircraft);
    expect(evaluation.events.some((e) => e.dimension === "safety" && e.rule.startsWith("terrain"))).toBe(
      true,
    );
  });
});

describe("formatClock", () => {
  it("renders mm:ss under one hour", () => {
    expect(formatClock(525)).toBe("08:45");
    expect(formatClock(0)).toBe("00:00");
  });
});
