import { formatEta } from "../engine/validate";
import { useAppStore } from "../store/appStore";

const SPEEDS = [1, 2, 5, 10];

export function SimPanel() {
  const playing = useAppStore((s) => s.playing);
  const speed = useAppStore((s) => s.speed);
  const time = useAppStore((s) => s.time);
  const duration = useAppStore((s) => s.result?.trajectory.duration ?? 0);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const setSpeed = useAppStore((s) => s.setSpeed);
  const setTime = useAppStore((s) => s.setTime);
  const step = useAppStore((s) => s.step);
  const revalidate = useAppStore((s) => s.revalidate);

  return (
    <section className="dock-section">
      <h3>
        模拟飞行
        <span style={{ color: "var(--muted)", fontWeight: 500 }}>{formatEta(time)} / {formatEta(duration)}</span>
      </h3>
      <div className="sim-row">
        <input
          type="range"
          min={0}
          max={Math.max(0.1, duration)}
          step={0.05}
          value={Math.min(time, duration)}
          onChange={(e) => setTime(Number(e.target.value))}
        />
        <select className="speed-sel" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </div>
      <div className="sim-btns">
        <button className="btn" type="button" onClick={() => step(-1)}>
          ‹ 步进
        </button>
        <button className="btn primary" type="button" onClick={togglePlay}>
          {playing ? "暂停" : "播放"}
        </button>
        <button className="btn" type="button" onClick={() => step(1)}>
          步进 ›
        </button>
      </div>
      <div className="sim-btns">
        <button className="btn block" type="button" onClick={revalidate}>
          重新仿真校验
        </button>
      </div>
    </section>
  );
}
