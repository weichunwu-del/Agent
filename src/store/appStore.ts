import { create } from "zustand";
import { aircraftById } from "../data/aircraft";
import { createHighwayMission } from "../data/highwayMission";
import {
  optimizeMission,
  runAnalysis,
  type AnalysisEvent,
  type Evaluation,
} from "../engine/analysis";
import { sampleAt } from "../engine/trajectory";
import type { Mission, Sample, Waypoint } from "../engine/types";
import { validateMission } from "../engine/validate";

export type Page = "editor" | "sim";
export type SimPhase = "running" | "playback" | "complete";

interface AppState {
  page: Page;
  mission: Mission;
  rthAltitudeAgl: number;
  selectedId: string | null;
  result: ReturnType<typeof validateMission> | null;
  evaluation: Evaluation | null;
  playing: boolean;
  speed: number;
  time: number;
  selectedEventId: string | null;
  optimizing: boolean;
  optimizeNote: string | null;
  mapFollow: boolean;

  selectedWaypoint: () => Waypoint | null;
  currentSample: () => Sample | null;
  visibleEvents: () => AnalysisEvent[];
  phase: () => SimPhase;

  openEditor: () => void;
  startSim: () => void;
  select: (id: string | null) => void;
  addWaypointAt: (lat: number, lng: number) => void;
  updateWaypoint: (id: string, patch: Partial<Waypoint>) => void;
  removeWaypoint: (id: string) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  setTime: (time: number) => void;
  replay: () => void;
  selectEvent: (id: string | null) => void;
  returnToEditor: () => void;
  runAiOptimize: () => void;
  resetDemo: () => void;
}

function analyze(mission: Mission, rthAltitudeAgl: number) {
  const aircraft = aircraftById(mission.aircraftId);
  return runAnalysis(mission, { ...aircraft, rthAltitudeAgl });
}

function seed() {
  const mission = createHighwayMission();
  const rthAltitudeAgl = aircraftById(mission.aircraftId).rthAltitudeAgl;
  const { result, evaluation } = analyze(mission, rthAltitudeAgl);
  return {
    page: "sim" as Page,
    mission,
    rthAltitudeAgl,
    selectedId: mission.waypoints[0]?.id ?? null,
    result,
    evaluation,
    playing: true,
    speed: 4,
    time: 0,
    selectedEventId: null,
    optimizing: false,
    optimizeNote: null,
    mapFollow: true,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  ...seed(),

  selectedWaypoint: () => {
    const { mission, selectedId } = get();
    return mission.waypoints.find((w) => w.id === selectedId) ?? null;
  },

  currentSample: () => {
    const { result, time } = get();
    if (!result) return null;
    return sampleAt(result.trajectory, time);
  },

  visibleEvents: () => {
    const { evaluation, time, playing, result } = get();
    if (!evaluation) return [];
    const duration = result?.trajectory.duration ?? 0;
    const done = !playing && time >= duration - 1e-3;
    if (done) return evaluation.events;
    return evaluation.events.filter((e) => (e.t ?? 0) <= time + 0.05);
  },

  phase: () => {
    const { playing, time, result } = get();
    const duration = result?.trajectory.duration ?? 0;
    if (playing) return "running";
    if (duration > 0 && time >= duration - 1e-3) return "complete";
    return "playback";
  },

  openEditor: () => set({ page: "editor", playing: false }),

  startSim: () => {
    const { mission, rthAltitudeAgl } = get();
    const { result, evaluation } = analyze(mission, rthAltitudeAgl);
    set({
      page: "sim",
      result,
      evaluation,
      playing: true,
      time: 0,
      selectedEventId: null,
      optimizeNote: null,
    });
  },

  select: (id) => set({ selectedId: id }),

  addWaypointAt: (lat, lng) => {
    const { mission } = get();
    const last = mission.waypoints[mission.waypoints.length - 1];
    const nextWp: Waypoint = {
      id: `wp-${Date.now()}`,
      index: mission.waypoints.length + 1,
      lat,
      lng,
      relativeAlt: last?.relativeAlt ?? 80,
      heading: "auto",
      speed: last?.speed ?? 12,
      gimbalPitch: last?.gimbalPitch ?? -28,
      gimbalYaw: 0,
      hoverSeconds: 0,
      actions: [],
      visible: true,
    };
    const waypoints = [...mission.waypoints, nextWp].map((w, i) => ({ ...w, index: i + 1 }));
    set({ mission: { ...mission, waypoints }, selectedId: nextWp.id });
  },

  updateWaypoint: (id, patch) => {
    const { mission } = get();
    const waypoints = mission.waypoints.map((w) => (w.id === id ? { ...w, ...patch } : w));
    set({ mission: { ...mission, waypoints } });
  },

  removeWaypoint: (id) => {
    const { mission, selectedId } = get();
    const waypoints = mission.waypoints
      .filter((w) => w.id !== id)
      .map((w, i) => ({ ...w, index: i + 1 }));
    set({
      mission: { ...mission, waypoints },
      selectedId: selectedId === id ? waypoints[waypoints.length - 1]?.id ?? null : selectedId,
    });
  },

  play: () => {
    const { result, time } = get();
    if (!result?.trajectory.samples.length) return;
    const atEnd = time >= result.trajectory.duration - 1e-3;
    set({ playing: true, time: atEnd ? 0 : time });
  },
  pause: () => set({ playing: false }),
  togglePlay: () => {
    if (get().playing) get().pause();
    else get().play();
  },
  setSpeed: (speed) => set({ speed }),
  setTime: (time) => {
    const duration = get().result?.trajectory.duration ?? 0;
    const next = Math.min(duration, Math.max(0, time));
    set({ time: next, playing: next < duration - 1e-3 ? get().playing : false });
  },
  replay: () => set({ playing: true, time: 0, selectedEventId: null }),
  selectEvent: (id) => {
    const event = get().evaluation?.events.find((e) => e.id === id);
    const wp = event?.waypointIndex
      ? get().mission.waypoints.find((w) => w.index === event.waypointIndex)
      : null;
    set({
      selectedEventId: id,
      playing: false,
      time: event?.t ?? get().time,
      selectedId: wp?.id ?? get().selectedId,
      mapFollow: true,
    });
  },
  returnToEditor: () => {
    const event = get().evaluation?.events.find((e) => e.id === get().selectedEventId) ??
      get().evaluation?.events.find((e) => e.level === "high" || e.level === "mid");
    const wp = event?.waypointIndex
      ? get().mission.waypoints.find((w) => w.index === event.waypointIndex)
      : null;
    set({
      page: "editor",
      playing: false,
      selectedId: wp?.id ?? get().selectedId,
      selectedEventId: event?.id ?? get().selectedEventId,
    });
  },
  runAiOptimize: () => {
    const { mission, evaluation, optimizing } = get();
    if (optimizing) return;
    if (!evaluation || evaluation.verdict === "pass") return;
    set({ optimizing: true, optimizeNote: "正在按已识别风险改线…" });
    const aircraft = aircraftById(mission.aircraftId);
    const { mission: next, rthAltitudeAgl } = optimizeMission(mission, {
      ...aircraft,
      rthAltitudeAgl: get().rthAltitudeAgl,
    });
    const { result, evaluation: nextEval } = analyze(next, rthAltitudeAgl);
    set({
      mission: next,
      rthAltitudeAgl,
      result,
      evaluation: nextEval,
      optimizing: false,
      playing: true,
      time: 0,
      selectedEventId: null,
      optimizeNote: "已应用 AI 优化并重新仿真。需三维通过后才能进入实飞。",
    });
  },
  resetDemo: () => set(seed()),
}));
