import { aircraftById } from "../data/aircraft";
import { formatClock } from "../engine/validate";
import { useAppStore } from "../store/appStore";

export function InfoPanel() {
  const mission = useAppStore((s) => s.mission);
  const result = useAppStore((s) => s.result);
  const aircraft = aircraftById(mission.aircraftId);
  const cruiseAlt =
    mission.waypoints.reduce((s, w) => s + w.relativeAlt, 0) / Math.max(1, mission.waypoints.length);
  const cruiseSpeed =
    mission.waypoints.reduce((s, w) => s + w.speed, 0) / Math.max(1, mission.waypoints.length);
  const lengthKm = ((result?.trajectory.pathLength ?? 0) / 1000).toFixed(1);
  const eta = formatClock(result?.trajectory.duration ?? 0);

  return (
    <aside className="panel left">
      <div className="panel-hd">基本信息</div>
      <div className="block">
        <div className="block-title">任务</div>
        <div className="kv">
          <span>任务区域</span>
          <b>{mission.area ?? mission.name}</b>
          <span>任务内容</span>
          <b>{mission.content ?? "航线巡检"}</b>
        </div>
      </div>
      <div className="block">
        <div className="block-title">设备</div>
        <div className="device-card">
          <img src="/assets/drone-evo.png" alt={aircraft.name} />
          <div>
            <div className="device-name">{aircraft.name}</div>
            <div className="device-tag">巡检机型</div>
          </div>
        </div>
        <div className="params">
          <div className="param">
            <div className="lab">飞行高度</div>
            <div className="val">
              {cruiseAlt.toFixed(0)}
              <em>m</em>
            </div>
          </div>
          <div className="param">
            <div className="lab">飞行速度</div>
            <div className="val">
              {cruiseSpeed.toFixed(0)}
              <em>m/s</em>
            </div>
          </div>
        </div>
      </div>
      <div className="block">
        <div className="block-title">航线信息</div>
        <div className="stats">
          <div className="stat">
            <div className="n">{mission.waypoints.length}</div>
            <div className="l">航点数量</div>
          </div>
          <div className="stat">
            <div className="n">{lengthKm}</div>
            <div className="l">航线长度 km</div>
          </div>
          <div className="stat">
            <div className="n">{eta}</div>
            <div className="l">预计时长</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
