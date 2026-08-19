import { AIRCRAFT } from "../data/aircraft";
import { useAppStore } from "../store/appStore";

export function TopBar() {
  const missionName = useAppStore((s) => s.missionName);
  const aircraftId = useAppStore((s) => s.aircraftId);
  const setAircraft = useAppStore((s) => s.setAircraft);
  const report = useAppStore((s) => s.result?.report);
  const resetDemo = useAppStore((s) => s.resetDemo);

  const chip =
    !report ? "chip" : report.critical ? "chip crit" : report.warning ? "chip warn" : "chip ok";
  const chipText = !report
    ? "未校验"
    : report.critical
      ? `${report.critical} 致命`
      : report.warning
        ? `${report.warning} 警告`
        : "校验通过";

  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="white" strokeWidth="1.6" />
            <path d="M12 8v8M8.5 10.5h7" stroke="white" strokeWidth="1.6" />
          </svg>
        </div>
        <div className="brand-name">航线仿真校验</div>
      </div>
      <div className="mission-meta">
        <div className="mission-title">{missionName}</div>
        <select
          className="chip"
          value={aircraftId}
          onChange={(e) => setAircraft(e.target.value)}
          aria-label="机型"
        >
          {AIRCRAFT.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <span className={chip}>{chipText}</span>
      </div>
      <div className="top-actions">
        <button className="btn ghost" type="button" onClick={resetDemo}>
          重置演示
        </button>
      </div>
    </header>
  );
}
