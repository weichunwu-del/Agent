import { useEffect } from "react";
import { FpvView } from "./components/FpvView";
import { MapView } from "./components/MapView";
import { SafetyPanel } from "./components/SafetyPanel";
import { SimPanel } from "./components/SimPanel";
import { TelemetryBar } from "./components/TelemetryBar";
import { TopBar } from "./components/TopBar";
import { WaypointList } from "./components/WaypointList";
import { useAppStore } from "./store/appStore";

export function App() {
  const playing = useAppStore((s) => s.playing);
  const speed = useAppStore((s) => s.speed);
  const setTime = useAppStore((s) => s.setTime);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const step = useAppStore((s) => s.step);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.08, (now - last) / 1000);
      last = now;
      const { time, result, playing: still } = useAppStore.getState();
      if (!still || !result) return;
      const next = time + dt * speed;
      if (next >= result.trajectory.duration) {
        setTime(result.trajectory.duration);
        return;
      }
      setTime(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, setTime]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowRight") {
        step(1);
      } else if (e.code === "ArrowLeft") {
        step(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, step]);

  return (
    <div className="shell">
      <TopBar />
      <div className="workspace">
        <WaypointList />
        <main className="stage">
          <MapView />
          <TelemetryBar />
        </main>
        <aside className="dock">
          <SimPanel />
          <SafetyPanel />
          <FpvView />
        </aside>
      </div>
    </div>
  );
}
