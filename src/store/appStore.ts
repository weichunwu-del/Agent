import { create } from "zustand";
import { aircraftById } from "../data/aircraft";
import { createSafeMission, createSampleMission } from "../data/sampleMission";
import { sampleAt } from "../engine/trajectory";
import type { GeoZone, SafetyFinding, Sample, SimValidationResult, Waypoint, WaypointAction } from "../engine/types";
import { validateMission } from "../engine/validate";

export type MapMode = "3d" | "2d";

interface AppState {
  missionName: string;
  aircraftId: string;
  home: { lat: number; lng: number };
  homeElevation: number;
  rthAltitudeAgl: number;
  waypoints: Waypoint[];
  zones: GeoZone[];
  selectedId: string | null;
  mapMode: MapMode;
  result: SimValidationResult | null;
  playing: boolean;
  speed: number;
  time: number;
  selectedFindingId: string | null;
  stale: boolean;

  selectedWaypoint: () => Waypoint | null;
  currentSample: () => Sample | null;
  findings: () => SafetyFinding[];

  select: (id: string | null) => void;
  setMapMode: (mode: MapMode) => void;
  setAircraft: (id: string) => void;
  addWaypointAt: (lat: number, lng: number, relativeAlt?: number) => void;
  updateWaypoint: (id: string, patch: Partial<Waypoint>) => void;
  removeWaypoint: (id: string) => void;
  toggleVisible: (id: string) => void;
  toggleAction: (id: string, action: WaypointAction) => void;
  revalidate: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  setTime: (time: number) => void;
  step: (dir: -1 | 1) => void;
  selectFinding: (id: string | null) => void;
  applySafeRevision: () => void;
  resetDemo: () => void;
}

function reindex(waypoints: Waypoint[]): Waypoint[] {
  return waypoints.map((w, i) => ({ ...w, index: i + 1, id: w.id || `wp-${i + 1}` }));
}

function runValidation(
  waypoints: Waypoint[],
  aircraftId: string,
  home: { lat: number; lng: number },
  homeElevation: number,
  rthAltitudeAgl?: number,
  zones?: GeoZone[],
) {
  const base = createSampleMission();
  const aircraft = aircraftById(aircraftId);
  return validateMission(
    {
      ...base,
      aircraftId,
      home,
      homeElevation,
      waypoints,
      zones: zones ?? base.zones,
    },
    rthAltitudeAgl != null ? { ...aircraft, rthAltitudeAgl } : aircraft,
  );
}

function seed() {
  const mission = createSampleMission();
  const result = runValidation(mission.waypoints, mission.aircraftId, mission.home, mission.homeElevation);
  return {
    missionName: mission.name,
    aircraftId: mission.aircraftId,
    home: mission.home,
    homeElevation: mission.homeElevation,
    rthAltitudeAgl: aircraftById(mission.aircraftId).rthAltitudeAgl,
    waypoints: mission.waypoints,
    zones: mission.zones,
    selectedId: mission.waypoints[2]?.id ?? mission.waypoints[0]?.id ?? null,
    mapMode: "3d" as MapMode,
    result,
    playing: false,
    speed: 5,
    time: 0,
    selectedFindingId: result.report.findings[0]?.id ?? null,
    stale: false,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  ...seed(),

  selectedWaypoint: () => {
    const { waypoints, selectedId } = get();
    return waypoints.find((w) => w.id === selectedId) ?? null;
  },

  currentSample: () => {
    const { result, time } = get();
    if (!result) return null;
    return sampleAt(result.trajectory, time);
  },

  findings: () => get().result?.report.findings ?? [],

  select: (id) => set({ selectedId: id }),
  setMapMode: (mapMode) => set({ mapMode }),

  setAircraft: (aircraftId) => {
    const { waypoints, home, homeElevation, rthAltitudeAgl, zones } = get();
    const result = runValidation(waypoints, aircraftId, home, homeElevation, rthAltitudeAgl, zones);
    set({
      aircraftId,
      result,
      stale: false,
      time: Math.min(get().time, result.trajectory.duration),
    });
  },

  addWaypointAt: (lat, lng, relativeAlt) => {
    const { waypoints, aircraftId, home, homeElevation, rthAltitudeAgl, zones } = get();
    const last = waypoints[waypoints.length - 1];
    const next: Waypoint = {
      id: `wp-${Date.now()}`,
      index: waypoints.length + 1,
      lat,
      lng,
      relativeAlt: relativeAlt ?? last?.relativeAlt ?? 50,
      heading: "auto",
      speed: last?.speed ?? 10,
      gimbalPitch: last?.gimbalPitch ?? -30,
      gimbalYaw: 0,
      hoverSeconds: 0,
      actions: [],
      visible: true,
    };
    const nextWps = reindex([...waypoints, next]);
    const result = runValidation(nextWps, aircraftId, home, homeElevation, rthAltitudeAgl, zones);
    set({
      waypoints: nextWps,
      selectedId: next.id,
      result,
      stale: false,
      playing: false,
      time: 0,
    });
  },

  updateWaypoint: (id, patch) => {
    const { waypoints, aircraftId, home, homeElevation, rthAltitudeAgl, zones } = get();
    const nextWps = waypoints.map((w) => (w.id === id ? { ...w, ...patch } : w));
    const result = runValidation(nextWps, aircraftId, home, homeElevation, rthAltitudeAgl, zones);
    set({
      waypoints: nextWps,
      result,
      stale: false,
      time: Math.min(get().time, result.trajectory.duration),
    });
  },

  removeWaypoint: (id) => {
    const { waypoints, aircraftId, home, homeElevation, selectedId, rthAltitudeAgl, zones } = get();
    const nextWps = reindex(waypoints.filter((w) => w.id !== id));
    const result = runValidation(nextWps, aircraftId, home, homeElevation, rthAltitudeAgl, zones);
    set({
      waypoints: nextWps,
      selectedId: selectedId === id ? nextWps[nextWps.length - 1]?.id ?? null : selectedId,
      result,
      stale: false,
      playing: false,
      time: 0,
    });
  },

  toggleVisible: (id) => {
    const wp = get().waypoints.find((w) => w.id === id);
    if (!wp) return;
    get().updateWaypoint(id, { visible: !wp.visible });
  },

  toggleAction: (id, action) => {
    const wp = get().waypoints.find((w) => w.id === id);
    if (!wp) return;
    const has = wp.actions.includes(action);
    const actions = has ? wp.actions.filter((a) => a !== action) : [...wp.actions, action];
    get().updateWaypoint(id, { actions });
  },

  revalidate: () => {
    const { waypoints, aircraftId, home, homeElevation, rthAltitudeAgl, zones } = get();
    const result = runValidation(waypoints, aircraftId, home, homeElevation, rthAltitudeAgl, zones);
    set({ result, stale: false, selectedFindingId: result.report.findings[0]?.id ?? null });
  },

  play: () => {
    const { result, time } = get();
    if (!result?.trajectory.samples.length) return;
    const atEnd = time >= result.trajectory.duration - 1e-3;
    set({ playing: true, time: atEnd ? 0 : time });
  },
  pause: () => set({ playing: false }),
  togglePlay: () => {
    const { playing } = get();
    if (playing) get().pause();
    else get().play();
  },
  setSpeed: (speed) => set({ speed }),
  setTime: (time) => {
    const duration = get().result?.trajectory.duration ?? 0;
    const next = Math.min(duration, Math.max(0, time));
    set({ time: next, playing: next < duration ? get().playing : false });
  },
  step: (dir) => {
    const { time, result } = get();
    const duration = result?.trajectory.duration ?? 0;
    get().setTime(Math.min(duration, Math.max(0, time + dir * 0.5)));
    set({ playing: false });
  },
  selectFinding: (id) => {
    const finding = get().result?.report.findings.find((f) => f.id === id);
    set({
      selectedFindingId: id,
      playing: false,
      time: finding?.t ?? get().time,
      selectedId: finding?.waypointIndex
        ? get().waypoints.find((w) => w.index === finding.waypointIndex)?.id ?? get().selectedId
        : get().selectedId,
    });
  },
  applySafeRevision: () => {
    const safe = createSafeMission();
    const { aircraftId, home, homeElevation, zones } = get();
    const waypoints = safe.waypoints;
    const rthAltitudeAgl = 180;
    const result = runValidation(waypoints, aircraftId, home, homeElevation, rthAltitudeAgl, zones);
    set({
      missionName: safe.name,
      rthAltitudeAgl,
      waypoints,
      result,
      stale: false,
      playing: false,
      time: 0,
      selectedId: waypoints[2]?.id ?? waypoints[0]?.id ?? null,
      selectedFindingId: result.report.findings[0]?.id ?? null,
    });
  },
  resetDemo: () => set(seed()),
}));

