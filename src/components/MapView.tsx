import * as Cesium from "cesium";
import { useEffect, useRef, useState } from "react";
import { cartesian, createViewer, installWasd, lookOrientation } from "../cesium/setup";
import { FallbackMap } from "./FallbackMap";
import { sampleDemoTerrain } from "../engine/terrain";
import type { GeoZone, SafetyFinding, Sample, Waypoint } from "../engine/types";
import { useAppStore } from "../store/appStore";

const ROUTE = Cesium.Color.fromCssColorString("#37e46f");
const SELECT = Cesium.Color.fromCssColorString("#3d8dff");
const CRIT = Cesium.Color.fromCssColorString("#ff5a4f");
const WARN = Cesium.Color.fromCssColorString("#f5b942");

export function MapView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapMode = useAppStore((s) => s.mapMode);
  const setMapMode = useAppStore((s) => s.setMapMode);
  const waypoints = useAppStore((s) => s.waypoints);
  const zones = useAppStore((s) => s.zones);
  const selectedId = useAppStore((s) => s.selectedId);
  const findings = useAppStore((s) => s.result?.report.findings);
  const home = useAppStore((s) => s.home);
  const homeElevation = useAppStore((s) => s.homeElevation);
  const selected = useAppStore((s) => s.selectedWaypoint());
  const sample = useAppStore((s) => s.currentSample());
  const selectedFindingId = useAppStore((s) => s.selectedFindingId);
  const liveHud = useAppStore((s) => s.playing || s.time > 0.05);

  useEffect(() => {
    if (!hostRef.current) return;
    let viewer: Cesium.Viewer;
    try {
      viewer = createViewer(hostRef.current);
    } catch (err) {
      hostRef.current.innerHTML = "";
      setMapError(err instanceof Error ? err.message : "三维地图初始化失败");
      return;
    }
    viewerRef.current = viewer;
    const removeWasd = installWasd(viewer);

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      const id = picked?.id?.id as string | undefined;
      if (id?.includes("wp:")) {
        useAppStore.getState().select(id.slice(id.indexOf("wp:") + 3));
        return;
      }
      if (id?.includes("find:")) {
        useAppStore.getState().selectFinding(id.slice(id.indexOf("find:") + 5));
        return;
      }
      const ray = viewer.camera.getPickRay(click.position);
      if (!ray) return;
      const pos = viewer.scene.globe.pick(ray, viewer.scene);
      if (!pos) return;
      const c = Cesium.Cartographic.fromCartesian(pos);
      useAppStore.getState().addWaypointAt(
        Cesium.Math.toDegrees(c.latitude),
        Cesium.Math.toDegrees(c.longitude),
      );
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    viewer.camera.lookAt(
      cartesian(home.lat, home.lng, 90),
      new Cesium.HeadingPitchRange(Cesium.Math.toRadians(35), Cesium.Math.toRadians(-32), 1700),
    );
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

    return () => {
      removeWasd();
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
    // home is demo-constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    syncStatic(viewer, waypoints, selectedId, findings ?? [], home, homeElevation, zones);
  }, [waypoints, selectedId, findings, home, homeElevation, zones]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    syncDrone(viewer, sample);
  }, [sample]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !selectedFindingId) return;
    const finding = (findings ?? []).find((f) => f.id === selectedFindingId);
    if (!finding?.lat || !finding.lng) return;
    const alt = finding.altAsl ?? sampleDemoTerrain(finding.lat, finding.lng) + 40;
    viewer.camera.flyTo({
      destination: cartesian(finding.lat, finding.lng, alt + 220),
      orientation: {
        heading: Cesium.Math.toRadians(30),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0,
      },
      duration: 0.8,
    });
  }, [selectedFindingId, findings]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (mapMode === "2d") viewer.scene.morphTo2D(0.5);
    else viewer.scene.morphTo3D(0.5);
  }, [mapMode]);

  const rel = liveHud && sample ? sample.altAgl : (selected?.relativeAlt ?? sample?.altAgl ?? 0);
  const asl =
    liveHud && sample ? sample.altAsl : homeElevation + (selected?.relativeAlt ?? sample?.altAgl ?? 0);

  return (
    <div className="map-root">
      {mapError ? <FallbackMap /> : <div className="cesium-host" ref={hostRef} />}
      {mapError && <div className="map-fallback">三维地球不可用，已切换二维航迹回退</div>}
      <div className="map-tools">
        <button className="tool" type="button" title="放大" onClick={() => viewerRef.current?.camera.zoomIn(180)}>
          +
        </button>
        <button className="tool" type="button" title="缩小" onClick={() => viewerRef.current?.camera.zoomOut(180)}>
          −
        </button>
        <button
          className={`tool${mapMode === "3d" ? " active" : ""}`}
          type="button"
          title="三维"
          onClick={() => setMapMode("3d")}
        >
          3D
        </button>
        <button
          className={`tool${mapMode === "2d" ? " active" : ""}`}
          type="button"
          title="二维"
          onClick={() => setMapMode("2d")}
        >
          2D
        </button>
      </div>
      <div className="alt-tag">
        <div>
          相对: <b>{rel.toFixed(1)} m</b>
        </div>
        <div>
          海拔: <b>{asl.toFixed(1)} m</b>
        </div>
      </div>
    </div>
  );
}

function removeByPrefix(viewer: Cesium.Viewer, prefix: string) {
  const doomed: Cesium.Entity[] = [];
  for (const entity of viewer.entities.values) {
    if (typeof entity.id === "string" && entity.id.startsWith(prefix)) doomed.push(entity);
  }
  for (const entity of doomed) viewer.entities.remove(entity);
}

function syncStatic(
  viewer: Cesium.Viewer,
  waypoints: Waypoint[],
  selectedId: string | null,
  findings: SafetyFinding[],
  home: { lat: number; lng: number },
  homeElevation: number,
  zones: GeoZone[],
) {
  removeByPrefix(viewer, "static:");

  viewer.entities.add({
    id: "static:home",
    position: cartesian(home.lat, home.lng, homeElevation + 1),
    ellipse: {
      semiMajorAxis: 14,
      semiMinorAxis: 14,
      material: Cesium.Color.CYAN.withAlpha(0.25),
      outline: true,
      outlineColor: Cesium.Color.CYAN,
      height: homeElevation,
    },
    label: {
      text: "H",
      font: "12px sans-serif",
      fillColor: Cesium.Color.WHITE,
      pixelOffset: new Cesium.Cartesian2(0, -16),
    },
  });

  zones.forEach((zone) => {
    viewer.entities.add({
      id: `static:zone:${zone.id}`,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(zone.polygon.map((p) => cartesian(p.lat, p.lng, 0))),
        material: Cesium.Color.fromCssColorString("#ff5a4f").withAlpha(0.2),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#ff8c85"),
        height: 2,
        extrudedHeight: 26,
      },
      position: cartesian(zone.polygon[0].lat, zone.polygon[0].lng, 36),
      label: {
        text: zone.name,
        font: "12px sans-serif",
        fillColor: Cesium.Color.WHITE,
        pixelOffset: new Cesium.Cartesian2(0, -8),
      },
    });
  });

  const visible = waypoints.filter((w) => w.visible);
  if (visible.length >= 2) {
    const positions = visible.flatMap((w) => [w.lng, w.lat, homeElevation + w.relativeAlt]);
    viewer.entities.add({
      id: "static:route",
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
        width: 4,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: ROUTE,
        }),
      },
    });
  }

  for (const wp of visible) {
    const alt = homeElevation + wp.relativeAlt;
    const ground = sampleDemoTerrain(wp.lat, wp.lng);
    const selected = wp.id === selectedId;
    viewer.entities.add({
      id: `static:wp:${wp.id}`,
      position: cartesian(wp.lat, wp.lng, alt),
      point: {
        pixelSize: selected ? 14 : 10,
        color: selected ? SELECT : ROUTE,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        disableDepthTestDistance: 800,
      },
      label: {
        text: String(wp.index),
        font: "13px sans-serif",
        fillColor: Cesium.Color.WHITE,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        disableDepthTestDistance: 2000,
      },
      polyline: {
        positions: [cartesian(wp.lat, wp.lng, ground), cartesian(wp.lat, wp.lng, alt)],
        width: selected ? 2 : 1,
        material: selected ? Cesium.Color.YELLOW : Cesium.Color.WHITE.withAlpha(0.35),
      },
    });
  }

  for (const f of findings) {
    if (f.lat == null || f.lng == null) continue;
    const alt = f.altAsl ?? sampleDemoTerrain(f.lat, f.lng) + 8;
    viewer.entities.add({
      id: `static:find:${f.id}`,
      position: cartesian(f.lat, f.lng, alt),
      point: {
        pixelSize: 11,
        color: f.severity === "critical" ? CRIT : f.severity === "warning" ? WARN : SELECT,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
      },
    });
  }
}

function dronePose(sample: Sample) {
  const pose = lookOrientation(sample.lat, sample.lng, sample.altAsl, sample.heading, 0);
  const hpr = Cesium.HeadingPitchRoll.fromDegrees(sample.heading, sample.gimbalPitch, 0);
  const frame = Cesium.Transforms.headingPitchRollToFixedFrame(pose.position, hpr);
  const forward = Cesium.Matrix4.multiplyByPointAsVector(frame, new Cesium.Cartesian3(1, 0, 0), new Cesium.Cartesian3());
  Cesium.Cartesian3.normalize(forward, forward);
  const conePos = Cesium.Cartesian3.add(
    pose.position,
    Cesium.Cartesian3.multiplyByScalar(forward, 45, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  );
  return { pose, hpr, conePos };
}

function syncDrone(viewer: Cesium.Viewer, sample: Sample | null) {
  if (!sample) {
    removeByPrefix(viewer, "drone:");
    return;
  }
  const { pose, hpr, conePos } = dronePose(sample);
  const body = viewer.entities.getById("drone:body");
  const fov = viewer.entities.getById("drone:fov");
  if (body && fov) {
    body.position = new Cesium.ConstantPositionProperty(pose.position);
    body.orientation = new Cesium.ConstantProperty(pose.orientation);
    fov.position = new Cesium.ConstantPositionProperty(conePos);
    fov.orientation = new Cesium.ConstantProperty(Cesium.Transforms.headingPitchRollQuaternion(conePos, hpr));
    return;
  }
  viewer.entities.add({
    id: "drone:body",
    position: pose.position,
    orientation: pose.orientation,
    box: {
      dimensions: new Cesium.Cartesian3(3.4, 3.4, 0.7),
      material: Cesium.Color.fromCssColorString("#d9e6ff"),
    },
  });
  viewer.entities.add({
    id: "drone:fov",
    position: conePos,
    orientation: Cesium.Transforms.headingPitchRollQuaternion(conePos, hpr),
    cylinder: {
      length: 90,
      topRadius: 0.4,
      bottomRadius: 38,
      material: ROUTE.withAlpha(0.2),
      outline: true,
      outlineColor: ROUTE.withAlpha(0.55),
    },
  });
}
