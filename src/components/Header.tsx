import { useAppStore } from "../store/appStore";

const PHASE_LABEL = {
  running: "仿真进行中",
  playback: "仿真回放中",
  complete: "仿真已完成",
} as const;

export function Header() {
  const mission = useAppStore((s) => s.mission);
  const playing = useAppStore((s) => s.playing);
  const time = useAppStore((s) => s.time);
  const duration = useAppStore((s) => s.result?.trajectory.duration ?? 0);
  const openEditor = useAppStore((s) => s.openEditor);
  const phase: keyof typeof PHASE_LABEL = playing
    ? "running"
    : duration > 0 && time >= duration - 1e-3
      ? "complete"
      : "playback";

  return (
    <header>
      <div className="brand">
        <div className="logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3l2.2 4.6L19 9l-4 3.2L16.2 17 12 14.6 7.8 17 9 12.2 5 9l4.8-1.4L12 3z" fill="#061018" />
          </svg>
        </div>
        <div className="title">
          仿真飞行<span>·</span>
          {mission.name.replace(/ · AI 优化$/, "")}
        </div>
      </div>
      <div className="header-meta">
        <span className="pill">
          <span className={`dot ${phase === "complete" ? "warn" : "live"}`} />
          {PHASE_LABEL[phase]}
        </span>
        <span>任务编号 {mission.simTaskId ?? mission.id}</span>
        <button className="link-btn" type="button" onClick={openEditor}>
          返回航线编辑器
        </button>
      </div>
    </header>
  );
}
