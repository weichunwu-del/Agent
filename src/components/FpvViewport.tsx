import { PitchLadder, YawCompass } from "./Gauges";
import { useAppStore } from "../store/appStore";

export function FpvViewport() {
  const sample = useAppStore((s) => s.currentSample());
  const alt = sample?.altAgl ?? 80;
  const speed = sample?.speed ?? 12;
  const heading = sample?.heading ?? 0;
  const pitch = sample?.gimbalPitch ?? -10;
  const progress = useAppStore((s) => {
    const d = s.result?.trajectory.duration ?? 1;
    return d > 0 ? s.time / d : 0;
  });
  const shift = -progress * 8;

  return (
    <div className="viewport" id="fpv">
      <img
        className="bg"
        src="/assets/fpv-highway.png"
        alt="FPV 视角"
        style={{ transform: `scale(1.08) translate(${shift}%, ${shift * 0.3}%)` }}
      />
      <div className="tele-hud" title="实时高度 / 速度">
        <div className="tele-item">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 3.2h8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M7 3.2v8.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M4.2 11.4h5.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {alt.toFixed(0)} m
        </div>
        <div className="tele-split" />
        <div className="tele-item">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 11.2V3.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M4.1 6.1L7 3.2l2.9 2.9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M3 11.4h8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {speed.toFixed(1)} m/s
        </div>
      </div>
      <div className="hud-cluster">
        <YawCompass heading={heading} />
        <PitchLadder pitch={pitch} />
      </div>
    </div>
  );
}
