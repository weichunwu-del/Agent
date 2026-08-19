import * as Cesium from "cesium";
import { useEffect, useRef } from "react";
import { createViewer } from "../cesium/setup";
import { useAppStore } from "../store/appStore";

export function FpvView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const sample = useAppStore((s) => s.currentSample());

  useEffect(() => {
    if (!hostRef.current) return;
    const viewer = createViewer(hostRef.current, { requestRenderMode: true });
    viewer.scene.screenSpaceCameraController.enableInputs = false;
    viewer.resolutionScale = 0.7;
    viewerRef.current = viewer;
    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

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

  return (
    <div className="fpv-box">
      <div className="fpv-host ir" ref={hostRef} />
      <div className="fpv-hud">
        <span>红外</span>
        <span>8X</span>
      </div>
      <div className="crosshair" />
      <div className="fpv-title">FPV · 仿真载荷视窗</div>
    </div>
  );
}
