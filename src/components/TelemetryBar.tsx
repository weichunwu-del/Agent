import { aircraftById } from "../data/aircraft";
import { useAppStore } from "../store/appStore";

export function TelemetryBar() {
  const sample = useAppStore((s) => s.currentSample());
  const selected = useAppStore((s) => s.selectedWaypoint());
  const updateWaypoint = useAppStore((s) => s.updateWaypoint);
  const aircraft = useAppStore((s) => aircraftById(s.aircraftId));
  const homeElevation = useAppStore((s) => s.homeElevation);

  const lat = sample?.lat ?? selected?.lat ?? 0;
  const lng = sample?.lng ?? selected?.lng ?? 0;
  const heading = sample?.heading ?? (selected?.heading === "auto" ? 0 : selected?.heading ?? 0);
  const speed = sample?.speed ?? selected?.speed ?? 0;
  const altAsl = sample?.altAsl ?? homeElevation + (selected?.relativeAlt ?? 0);
  const soc = sample?.batterySoc ?? 1;
  const signal = Math.max(0.18, 1 - (sample?.distanceFromHome ?? 0) / aircraft.rcRange);

  return (
    <div className="hud">
      <div className="coord-card">
        <div className="field">
          <label>纬度 Latitude</label>
          <input
            value={lat.toFixed(6)}
            onChange={(e) => {
              if (!selected) return;
              const next = Number(e.target.value);
              if (Number.isFinite(next)) updateWaypoint(selected.id, { lat: next });
            }}
          />
        </div>
        <div className="field">
          <label>经度 Longitude</label>
          <input
            value={lng.toFixed(6)}
            onChange={(e) => {
              if (!selected) return;
              const next = Number(e.target.value);
              if (Number.isFinite(next)) updateWaypoint(selected.id, { lng: next });
            }}
          />
        </div>
        <div className="field">
          <label>相对高度 m</label>
          <input
            value={selected ? selected.relativeAlt.toFixed(1) : (sample?.altAgl ?? 0).toFixed(1)}
            onChange={(e) => {
              if (!selected) return;
              const next = Number(e.target.value);
              if (Number.isFinite(next)) updateWaypoint(selected.id, { relativeAlt: next });
            }}
          />
        </div>
      </div>

      <div className="adi-wrap">
        <div className="adi" aria-label="姿态与航向">
          <div className="adi-rose" style={{ transform: `rotate(${-heading}deg)` }} />
          <div className="adi-hdg">
            {heading.toFixed(1)}°
            <small>真航向</small>
          </div>
          <div className="adi-readout">
            <div>
              <b>{speed.toFixed(1)}</b> m/s
            </div>
            <div>{altAsl.toFixed(1)} m ASL</div>
          </div>
          <div className="keycaps">
            <span className="k-q">Q</span>
            <span className="k-w">W</span>
            <span className="k-e">E</span>
            <span className="k-a">A</span>
            <span className="k-s">S</span>
            <span className="k-d">D</span>
          </div>
        </div>
      </div>

      <div className="gauge-card">
        <div className="meter">
          <label>
            <span>链路</span>
            <span>{(signal * 100).toFixed(0)}%</span>
          </label>
          <div className="bar sig">
            <i style={{ width: `${signal * 100}%` }} />
          </div>
        </div>
        <div className="meter">
          <label>
            <span>电池</span>
            <span>{(soc * 100).toFixed(0)}%</span>
          </label>
          <div className="bar bat">
            <i style={{ width: `${soc * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
