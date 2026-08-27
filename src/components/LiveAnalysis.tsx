import { DIMENSION_META } from "../engine/analysis";
import { useAppStore } from "../store/appStore";
import { useMemo } from "react";

const LEVEL_LABEL = { high: "高风险", mid: "中风险", low: "低风险", pass: "通过" } as const;

export function LiveAnalysis() {
  const evaluation = useAppStore((s) => s.evaluation);
  const time = useAppStore((s) => s.time);
  const playing = useAppStore((s) => s.playing);
  const duration = useAppStore((s) => s.result?.trajectory.duration ?? 0);
  const events = useMemo(() => {
    if (!evaluation) return [];
    const done = !playing && time >= duration - 1e-3;
    if (done) return evaluation.events;
    return evaluation.events.filter((e) => (e.t ?? 0) <= time + 0.05);
  }, [evaluation, time, playing, duration]);
  const selected = useAppStore((s) => s.selectedEventId);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const riskCount = events.filter((e) => e.level !== "pass").length;

  return (
    <aside className="panel right">
      <div className="panel-hd">
        实时分析 <span className="sub">已识别 {riskCount} 项</span>
      </div>
      <div className="list">
        {events.length === 0 && <p style={{ color: "var(--muted)", padding: 8 }}>仿真推进后将滚动给出风险与通过项。</p>}
        {events.map((ev) => (
          <button
            key={ev.id}
            type="button"
            className={`event ${ev.level} ${selected === ev.id ? "sel" : ""}`}
            onClick={() => selectEvent(ev.id)}
          >
            <div className="event-hd">
              <div className="event-title">
                <em>{ev.code}</em>
                {ev.name}
              </div>
              <span className={`tag ${ev.level}`}>{LEVEL_LABEL[ev.level]}</span>
            </div>
            <p>{ev.detail}</p>
            <div className="dim-tag">{DIMENSION_META[ev.dimension].displayName}</div>
            <div className="loc">{ev.locationLabel}</div>
          </button>
        ))}
      </div>
    </aside>
  );
}
