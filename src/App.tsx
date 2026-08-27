import { useEffect } from "react";
import { EditorPage } from "./pages/EditorPage";
import { SimPage } from "./pages/SimPage";
import { useAppStore } from "./store/appStore";

export function App() {
  const page = useAppStore((s) => s.page);
  const playing = useAppStore((s) => s.playing);
  const speed = useAppStore((s) => s.speed);
  const setTime = useAppStore((s) => s.setTime);
  const togglePlay = useAppStore((s) => s.togglePlay);

  useEffect(() => {
    if (!playing || page !== "sim") return;
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
  }, [playing, speed, setTime, page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  return page === "editor" ? <EditorPage /> : <SimPage />;
}
