import { formatEta } from "../engine/validate";
import { useAppStore } from "../store/appStore";

export function WaypointList() {
  const waypoints = useAppStore((s) => s.waypoints);
  const selectedId = useAppStore((s) => s.selectedId);
  const result = useAppStore((s) => s.result);
  const select = useAppStore((s) => s.select);
  const removeWaypoint = useAppStore((s) => s.removeWaypoint);
  const toggleVisible = useAppStore((s) => s.toggleVisible);
  const addWaypointAt = useAppStore((s) => s.addWaypointAt);
  const home = useAppStore((s) => s.home);

  const maxRel = waypoints.reduce((m, w) => Math.max(m, w.relativeAlt), 0);
  const eta = result?.trajectory.duration ?? 0;

  return (
    <aside className="sidebar">
      <div className="side-head">
        <h2>航点列表</h2>
        <div className="stats">
          <div className="stat">
            <b>{maxRel.toFixed(1)} m</b>
            <span>最大相对高</span>
          </div>
          <div className="stat">
            <b>{formatEta(eta)}</b>
            <span>预计时长</span>
          </div>
          <div className="stat">
            <b>{waypoints.length}</b>
            <span>航点数</span>
          </div>
        </div>
      </div>
      <div className="wp-list">
        {waypoints.map((wp) => (
          <div
            key={wp.id}
            className={`wp-item${wp.id === selectedId ? " active" : ""}`}
            onClick={() => select(wp.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") select(wp.id);
            }}
          >
            <div className="wp-idx">{wp.index}</div>
            <div className="wp-main">
              <strong>航点 {wp.index}</strong>
              <small>
                相对 {wp.relativeAlt.toFixed(1)} m · {wp.speed.toFixed(0)} m/s
                {wp.actions.length ? ` · ${wp.actions.length} 动作` : ""}
              </small>
            </div>
            <div className="wp-ops">
              <button
                className="tiny"
                type="button"
                title={wp.visible ? "隐藏" : "显示"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVisible(wp.id);
                }}
              >
                {wp.visible ? "◉" : "○"}
              </button>
              <button
                className="tiny danger"
                type="button"
                title="删除"
                onClick={(e) => {
                  e.stopPropagation();
                  removeWaypoint(wp.id);
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="side-foot">
        <button
          className="btn block"
          type="button"
          onClick={() => {
            const last = waypoints[waypoints.length - 1];
            addWaypointAt(last ? last.lat + 0.0008 : home.lat, last ? last.lng + 0.001 : home.lng);
          }}
        >
          追加航点
        </button>
        <div className="hint">在地图上单击空白处也可落点。仿真会立刻重跑安全规则，把碰撞、禁飞、电量与返航风险前置暴露。</div>
      </div>
    </aside>
  );
}
