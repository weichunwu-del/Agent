import * as Cesium from "cesium";
import { useEffect, useRef, useState } from "react";
import { createViewer } from "../cesium/setup";
import { useAppStore } from "../store/appStore";

export function FpvView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const sample = useAppStore((s) => s.currentSample());

  useEffect(() => {
    if (!hostRef.current || failed) return;
    try {
      const viewer = createViewer(hostRef.current, { requestRenderMode: true });
      viewer.scene.screenSpaceCameraController.enableInputs = false;
      viewer.resolutionScale = 0.7;
      viewerRef.current = viewer;
      return () => {
        viewer.destroy();
        viewerRef.current = null;
      };
    } catch {
      hostRef.current.innerHTML = "";
      setFailed(true);
      return undefined;
    }
  }, [failed]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !sample) return;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(sample.lng, sample.lat, sample.altAsl),
      orientation: {
        heading: Cesium.Math.toRadians(sample.heading),
        pitch: Cesium.Math.toRadians(sample.gimbalPitch),
        roll: 0,
      },
    });
    viewer.scene.requestRender();
  }, [sample]);

  useEffect(() => {
    if (!failed || !canvasRef.current || !sample) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const horizon = h * (0.45 - sample.gimbalPitch / 180);
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#04140c");
    grd.addColorStop(horizon / h, "#16381f");
    grd.addColorStop(1, "#2d6b3a");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(120,255,140,0.35)";
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 28, horizon);
      ctx.lineTo(w / 2 + i * 70, h);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(180,255,190,0.8)";
    ctx.font = "10px sans-serif";
    ctx.fillText(`${sample.heading.toFixed(0)}°  ${sample.altAgl.toFixed(0)}m AGL`, 8, h - 8);
  }, [failed, sample]);

  return (
    <div className="fpv-box">
      {!failed && <div className="fpv-host ir" ref={hostRef} />}
      {failed && <canvas ref={canvasRef} className="fpv-fallback" width={320} height={180} />}
      <div className="fpv-hud">
        <span>红外</span>
        <span>8X</span>
      </div>
      <div className="crosshair" />
      <div className="fpv-title">FPV · 仿真载荷视窗</div>
    </div>
  );
}
