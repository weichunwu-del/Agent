import { formatClock } from "../engine/validate";
import { useAppStore } from "../store/appStore";

export function PlaybackBar() {
  const playing = useAppStore((s) => s.playing);
  const speed = useAppStore((s) => s.speed);
  const time = useAppStore((s) => s.time);
  const result = useAppStore((s) => s.result);
  const events = useAppStore((s) => s.evaluation?.events ?? []);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const replay = useAppStore((s) => s.replay);
  const setSpeed = useAppStore((s) => s.setSpeed);
  const setTime = useAppStore((s) => s.setTime);
  const selectEvent = useAppStore((s) => s.selectEvent);

  const duration = result?.trajectory.duration ?? 0;
  const pathLength = result?.trajectory.pathLength ?? 0;
  const sample = useAppStore((s) => s.currentSample());
  const flownKm = ((sample?.pathDistance ?? 0) / 1000).toFixed(1);
  const totalKm = (pathLength / 1000).toFixed(1);
  const remain = formatClock(Math.max(0, duration - time));
  const pct = duration > 0 ? (time / duration) * 100 : 0;

  return (
    <div className="playbar">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="btn primary" type="button" onClick={togglePlay}>
          {playing ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12">
                <rect x="2" y="2" width="3" height="8" fill="currentColor" />
                <rect x="7" y="2" width="3" height="8" fill="currentColor" />
              </svg>
              暂停
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12">
                <polygon points="2,1 11,6 2,11" fill="currentColor" />
              </svg>
              继续
            </>
          )}
        </button>
        <button className="btn" type="button" onClick={replay}>
          重新飞行
        </button>
        <div className="speeds">
          {[1, 2, 4].map((v) => (
            <button
              key={v}
              className={`btn ${speed === v ? "on" : ""}`}
              type="button"
              onClick={() => setSpeed(v)}
            >
              {v}x
            </button>
          ))}
        </div>
      </div>
      <div>
        <div
          className="progress"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const u = (e.clientX - rect.left) / rect.width;
            setTime(u * duration);
          }}
        >
          <div className="fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="marks">
          {events
            .filter((ev) => ev.level === "high" || ev.level === "mid")
            .map((ev) => (
              <button
                key={ev.id}
                className={`mark ${ev.level === "mid" ? "mid" : ""}`}
                style={{ left: `${duration > 0 ? ((ev.t ?? 0) / duration) * 100 : 0}%` }}
                type="button"
                onClick={() => selectEvent(ev.id)}
              >
                {ev.code}
              </button>
            ))}
        </div>
      </div>
      <div className="play-meta">
        已飞 <b>{flownKm}</b> / {totalKm} km
        <br />
        剩余 <b>{remain}</b>
      </div>
    </div>
  );
}
