import { evaluateSafety } from "./safety";
import { demoTerrain, type TerrainSampler } from "./terrain";
import { buildTrajectory } from "./trajectory";
import type { AircraftProfile, Mission, SimValidationResult } from "./types";

export function validateMission(
  mission: Mission,
  aircraft: AircraftProfile,
  terrain: TerrainSampler = demoTerrain,
): SimValidationResult {
  const trajectory = buildTrajectory(mission, aircraft, terrain);
  const report = evaluateSafety(mission, aircraft, trajectory, terrain);
  return { trajectory, report };
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded}s`;
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function formatClock(seconds: number): string {
  const rounded = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  if (h > 0) return `${h.toString().padStart(2, "0")}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function formatSoc(soc: number): string {
  return `${Math.max(0, Math.min(100, soc * 100)).toFixed(0)}%`;
}
