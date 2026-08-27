import { useMemo } from "react";
import { useAppStore } from "../store/appStore";

const W = 1200;
const H = 360;

export function TwinViewport() {
  const mission = useAppStore((s) => s.mission);
  const sample = useAppStore((s) => s.currentSample());
  const events = useAppStore((s) => s.evaluation?.events ?? []);
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const duration = useAppStore((s) => s.result?.trajectory.duration ?? 1);
  const pathLength = useAppStore((s) => s.result?.trajectory.pathLength ?? 1);

  const projected = useMemo(() => {
    const wps = mission.waypoints.filter((w) => w.visible);
    if (!wps.length) return [];
    return wps.map((wp, i) => {
      const u = wps.length === 1 ? 0 : i / (wps.length - 1);
      const x = 80 + u * (W - 160);
      const airY = 70 + (1 - wp.relativeAlt / 200) * 80 + u * 40;
      const groundY = airY + 88;
      return { wp, x, airY, groundY, u };
    });
  }, [mission.waypoints]);

  const droneU = Math.min(1, Math.max(0, (sample?.pathDistance ?? 0) / Math.max(1, pathLength)));
  const drone = interpolateProjected(projected, droneU);
  const heading = sample?.heading ?? 52;

  const airPassed = projected
    .filter((p) => p.u <= droneU + 0.001)
    .map((p) => `${p.x},${p.airY}`)
    .join(" ");
  const airFuture = projected
    .filter((p) => p.u >= droneU - 0.001)
    .map((p) => `${p.x},${p.airY}`)
    .join(" ");

  return (
    <div className="viewport" id="map3d">
      <img className="bg" src="/assets/map-terrain.png" alt="第三视角" />
      <div className="view-label">
        <div className="chip">
          <strong>第三视角</strong> · 数字孪生
        </div>
        <div className="chip">相对高度 {(sample?.altAgl ?? 80).toFixed(0)} m</div>
      </div>
      <div className="toolbar">
        <button className="tool active" type="button" title="3D">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 3v18M4 7.5l8 4.5 8-4.5" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        <button className="tool" type="button" title="回中">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        <button className="tool" type="button" title="图层">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      </div>

      <svg className="route-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="passed" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3dce8a" />
            <stop offset="100%" stopColor="#3ec8f0" />
          </linearGradient>
          <linearGradient id="future" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4c8dff" />
            <stop offset="100%" stopColor="#7aa4ff" />
          </linearGradient>
        </defs>
        {projected.map((p) => (
          <g key={p.wp.id}>
            <circle cx={p.x} cy={p.groundY} r="2.5" fill="#9fb4d0" opacity="0.45" />
            <line
              x1={p.x}
              y1={p.airY}
              x2={p.x}
              y2={p.groundY}
              stroke="#d7e8ff"
              strokeDasharray="3 4"
              strokeWidth="1.15"
              opacity="0.72"
            />
          </g>
        ))}
        {airPassed && (
          <polyline
            points={airPassed}
            fill="none"
            stroke="url(#passed)"
            strokeWidth="4.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {airFuture && (
          <polyline
            points={airFuture}
            fill="none"
            stroke="url(#future)"
            strokeWidth="3.4"
            strokeDasharray="7 6"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.9"
          />
        )}
        {projected
          .filter((_, i) => i % 4 === 3 || i === 0 || i === projected.length - 1)
          .map((p) => (
            <g key={`lab-${p.wp.id}`}>
              <circle
                cx={p.x}
                cy={p.airY}
                r={Math.abs((p.wp.index ?? 0) - (sample?.toWaypoint ?? 0)) < 1 ? 5.5 : 5}
                fill={Math.abs((p.wp.index ?? 0) - (sample?.toWaypoint ?? 0)) < 1 ? "#3ec8f0" : "#fff"}
                stroke="#fff"
                strokeWidth="1.2"
              />
              <text x={p.x} y={p.airY - 10} textAnchor="middle" fill="#e8eef8" fontSize="12" fontWeight="700">
                P{String(p.wp.index).padStart(2, "0")}
              </text>
            </g>
          ))}
        {events.map((ev) => {
          const u = (ev.t ?? 0) / Math.max(1, duration);
          const p = interpolateProjected(projected, Math.min(1, Math.max(0, u)));
          if (!p) return null;
          const color = ev.level === "high" ? "#ff5d6c" : ev.level === "mid" ? "#f5b942" : "#3ec8f0";
          const sel = ev.id === selectedEventId;
          return (
            <g key={ev.id}>
              <circle cx={p.x} cy={p.airY} r={sel ? 10 : 8} fill="none" stroke={color} strokeWidth="2" />
              <circle cx={p.x} cy={p.airY} r="3.2" fill={color} />
            </g>
          );
        })}
        {drone && (
          <g transform={`translate(${drone.x},${drone.airY}) rotate(${heading - 90})`}>
            <rect x="-15" y="-5" width="30" height="10" rx="3" fill="#d7dee8" />
            <circle cx="-18" cy="-8" r="3.2" fill="#6b7583" />
            <circle cx="18" cy="-8" r="3.2" fill="#6b7583" />
            <circle cx="-18" cy="8" r="3.2" fill="#6b7583" />
            <circle cx="18" cy="8" r="3.2" fill="#6b7583" />
            <polygon points="16,0 26,-3 26,3" fill="#3ec8f0" />
          </g>
        )}
      </svg>

      <div className="legend">
        <div>
          <i style={{ background: "linear-gradient(90deg,#3dce8a,#3ec8f0)" }} />
          已飞航段
        </div>
        <div>
          <i style={{ background: "#3ec8f0", height: 4 }} />
          当前航段
        </div>
        <div>
          <i style={{ background: "#4c8dff" }} />
          未飞航段
        </div>
        <div>
          <i style={{ background: "#ff5d6c", width: 8, height: 8, borderRadius: "50%" }} />
          风险点
        </div>
        <div>
          <i style={{ background: "transparent", borderLeft: "1px dashed #d7e8ff", width: 2, height: 10 }} />
          航点对地线
        </div>
      </div>
    </div>
  );
}

function interpolateProjected(
  pts: { x: number; airY: number; groundY: number; u: number }[],
  u: number,
) {
  if (!pts.length) return null;
  if (u <= pts[0].u) return pts[0];
  if (u >= pts[pts.length - 1].u) return pts[pts.length - 1];
  for (let i = 1; i < pts.length; i++) {
    if (u <= pts[i].u) {
      const a = pts[i - 1];
      const b = pts[i];
      const t = (u - a.u) / Math.max(1e-6, b.u - a.u);
      return {
        x: a.x + (b.x - a.x) * t,
        airY: a.airY + (b.airY - a.airY) * t,
        groundY: a.groundY + (b.groundY - a.groundY) * t,
        u,
      };
    }
  }
  return pts[pts.length - 1];
}
