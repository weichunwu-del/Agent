import * as Cesium from "cesium";
import { heightmapTile } from "../engine/terrain";

export function createImageryLayer(): Cesium.ImageryLayer {
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maximumLevel: 18,
    credit: "Esri",
  });
  return new Cesium.ImageryLayer(provider);
}

export function createTerrainProvider(): Cesium.TerrainProvider {
  return new Cesium.CustomHeightmapTerrainProvider({
    width: 32,
    height: 32,
    callback: (x, y, level) => heightmapTile(x, y, level, 32),
  });
}

export function hideCesiumChrome(viewer: Cesium.Viewer) {
  const credits = viewer.cesiumWidget.creditContainer as HTMLElement;
  credits.style.display = "none";
}

export function createViewer(container: HTMLElement, opts?: { requestRenderMode?: boolean }) {
  const viewer = new Cesium.Viewer(container, {
    baseLayer: createImageryLayer(),
    terrainProvider: createTerrainProvider(),
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    vrButton: false,
    infoBox: false,
    selectionIndicator: false,
    shouldAnimate: false,
    requestRenderMode: opts?.requestRenderMode ?? false,
    maximumRenderTimeChange: Number.POSITIVE_INFINITY,
  });
  viewer.scene.globe.enableLighting = true;
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.fog.enabled = true;
  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.brightnessShift = -0.15;
  }
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#07090d");
  viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.6;
  hideCesiumChrome(viewer);
  return viewer;
}

export function installWasd(viewer: Cesium.Viewer) {
  const flags = { w: false, a: false, s: false, d: false, q: false, e: false, shift: false, ctrl: false };
  const down = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const k = e.key.toLowerCase();
    if (k in flags) flags[k as keyof typeof flags] = true;
    if (e.key === "Shift") flags.shift = true;
    if (e.key === "Control") flags.ctrl = true;
  };
  const up = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k in flags) flags[k as keyof typeof flags] = false;
    if (e.key === "Shift") flags.shift = false;
    if (e.key === "Control") flags.ctrl = false;
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);

  viewer.clock.onTick.addEventListener(() => {
    const camera = viewer.camera;
    const move = flags.shift ? 18 : flags.ctrl ? 3 : 8;
    if (flags.w) camera.moveForward(move);
    if (flags.s) camera.moveBackward(move);
    if (flags.a) camera.moveLeft(move);
    if (flags.d) camera.moveRight(move);
    if (flags.q) camera.lookLeft(0.015);
    if (flags.e) camera.lookRight(0.015);
  });

  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
  };
}

export function cartesian(lat: number, lng: number, alt: number) {
  return Cesium.Cartesian3.fromDegrees(lng, lat, alt);
}

export function lookOrientation(lat: number, lng: number, alt: number, heading: number, pitch: number) {
  const position = cartesian(lat, lng, alt);
  const hpr = Cesium.HeadingPitchRoll.fromDegrees(heading, pitch, 0);
  return {
    position,
    orientation: Cesium.Transforms.headingPitchRollQuaternion(position, hpr),
  };
}
