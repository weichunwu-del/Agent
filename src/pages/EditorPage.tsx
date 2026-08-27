import { useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";

export function EditorPage() {
  const mission = useAppStore((s) => s.mission);
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);
  const addWaypointAt = useAppStore((s) => s.addWaypointAt);
  const removeWaypoint = useAppStore((s) => s.removeWaypoint);
  const startSim = useAppStore((s) => s.startSim);
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const events = useAppStore((s) => s.evaluation?.events ?? []);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const problem = events.find((e) => e.id === selectedEventId) ?? events.find((e) => e.level === "high");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.fillStyle = "#071018";
      ctx.fillRect(0, 0, width, height);

      const wps = mission.waypoints;
      if (!wps.length) return;
      const lats = wps.map((w) => w.lat);
      const lngs = wps.map((w) => w.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const pad = 0.15;
      const dLat = Math.max(0.002, maxLat - minLat);
      const dLng = Math.max(0.002, maxLng - minLng);
      const project = (lat: number, lng: number) => ({
        x: ((lng - (minLng - dLng * pad)) / (dLng * (1 + pad * 2))) * width,
        y: (1 - (lat - (minLat - dLat * pad)) / (dLat * (1 + pad * 2))) * height,
      });

      ctx.strokeStyle = "rgba(62,200,240,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      wps.forEach((w, i) => {
        const p = project(w.lat, w.lng);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      wps.forEach((w) => {
        const p = project(w.lat, w.lng);
        const sel = w.id === selectedId;
        const hit = problem?.waypointIndex === w.index;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sel ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = hit ? "#ff5d6c" : sel ? "#3ec8f0" : "#e8eef8";
        ctx.fill();
        ctx.fillStyle = "#d7e2f3";
        ctx.font = "11px sans-serif";
        ctx.fillText(`P${String(w.index).padStart(2, "0")}`, p.x + 8, p.y - 6);
      });
    };

    draw();
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mission, selectedId, problem]);

  return (
    <div className="editor">
      <header>
        <div className="brand">
          <div className="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3l2.2 4.6L19 9l-4 3.2L16.2 17 12 14.6 7.8 17 9 12.2 5 9l4.8-1.4L12 3z" fill="#061018" />
            </svg>
          </div>
          <div className="title">
            航线编辑器<span>·</span>
            {mission.name}
          </div>
        </div>
        <button className="start-sim" type="button" onClick={startSim}>
          开始仿真
        </button>
      </header>
      <div className="editor-body">
        <aside className="panel">
          <div className="panel-hd">
            航点
            <span className="sub">{mission.waypoints.length} 个</span>
          </div>
          {problem && (
            <div className="note" style={{ margin: 10 }}>
              定位到问题航段：{problem.name} · {problem.locationLabel}
            </div>
          )}
          <div className="wp-list">
            {mission.waypoints.map((w) => (
              <div
                key={w.id}
                className={`wp-item ${w.id === selectedId ? "sel" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => select(w.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(w.id);
                  }
                }}
              >
                <div className="idx">P{String(w.index).padStart(2, "0")}</div>
                <div>
                  <div>
                    {w.relativeAlt.toFixed(0)} m · {w.speed.toFixed(0)} m/s
                  </div>
                  <div className="meta">
                    {w.lat.toFixed(5)}, {w.lng.toFixed(5)}
                  </div>
                </div>
                <button
                  type="button"
                  className="link-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeWaypoint(w.id);
                  }}
                >
                  删
                </button>
              </div>
            ))}
          </div>
        </aside>
        <div className="editor-map">
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%" }}
            onClick={(e) => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width;
              const y = (e.clientY - rect.top) / rect.height;
              const wps = mission.waypoints;
              if (!wps.length) return;
              const lats = wps.map((w) => w.lat);
              const lngs = wps.map((w) => w.lng);
              const minLat = Math.min(...lats);
              const maxLat = Math.max(...lats);
              const minLng = Math.min(...lngs);
              const maxLng = Math.max(...lngs);
              const pad = 0.15;
              const dLat = Math.max(0.002, maxLat - minLat);
              const dLng = Math.max(0.002, maxLng - minLng);
              const lng = minLng - dLng * pad + x * dLng * (1 + pad * 2);
              const lat = minLat - dLat * pad + (1 - y) * dLat * (1 + pad * 2);
              addWaypointAt(lat, lng);
            }}
          />
          <div className="editor-hint">单击地图补点 · 选中航点后可删除 · 改完点「开始仿真」</div>
        </div>
      </div>
    </div>
  );
}
