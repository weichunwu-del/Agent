import { useEffect, useRef } from "react";
import { sampleDemoTerrain } from "../engine/terrain";
import type { GeoZone, SafetyFinding, Sample, Waypoint } from "../engine/types";
import { useAppStore } from "../store/appStore";

const COLORS = {
  bg: "#0b1118",
  grid: "rgba(255,255,255,0.05)",
  route: "#37e46f",
  select: "#4aa3ff",
  nfz: "rgba(255,90,79,0.28)",
  nfzStroke: "#ff8c85",
  crit: "#ff5a4f",
  warn: "#f5b942",
  drone: "#d9e6ff",
};

export function FallbackMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waypoints = useAppStore((s) => s.waypoints);
  const zones = useAppStore((s) => s.zones);
  const selectedId = useAppStore((s) => s.selectedId);
  const findings = useAppStore((s) => s.result?.report.findings ?? []);
  const home = useAppStore((s) => s.home);
  const sample = useAppStore((s) => s.currentSample());
  const addWaypointAt = useAppStore((s) => s.addWaypointAt);
  const select = useAppStore((s) => s.select);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(ctx, width, height, { waypoints, zones, selectedId, findings, home, sample });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [waypoints, zones, selectedId, findings, home, sample]);

  return (
    <canvas
      ref={canvasRef}
      className="fallback-map"
      onClick={(e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const proj = projector(canvas.clientWidth, canvas.clientHeight, home, waypoints);
        const geo = proj.toGeo(e.clientX - rect.left, e.clientY - rect.top);
        const hit = waypoints.find((w) => {
          const p = proj.toPx(w.lat, w.lng);
          return Math.hypot(p.x - (e.clientX - rect.left), p.y - (e.clientY - rect.top)) < 14;
        });
        if (hit) select(hit.id);
        else addWaypointAt(geo.lat, geo.lng);
      }}
    />
  );
}

function projector(
  width: number,
  height: number,
  home: { lat: number; lng: number },
  waypoints: Waypoint[],
) {
  const pts = [...waypoints, home];
  const xs = pts.map((p) => east(home, p));
  const ys = pts.map((p) => north(home, p));
  const minX = Math.min(-180, ...xs) - 80;
  const maxX = Math.max(180, ...xs) + 220;
  const minY = Math.min(-180, ...ys) - 80;
  const maxY = Math.max(180, ...ys) + 180;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min(width / spanX, height / spanY) * 0.86;
  const ox = width / 2 - ((minX + maxX) / 2) * scale;
  const oy = height / 2 + ((minY + maxY) / 2) * scale;
  return {
    toPx(lat: number, lng: number) {
      const x = ox + east(home, { lat, lng }) * scale;
      const y = oy - north(home, { lat, lng }) * scale;
      return { x, y };
    },
    toGeo(px: number, py: number) {
      const e = (px - ox) / scale;
      const n = (oy - py) / scale;
      return {
        lat: home.lat + n / 111_320,
        lng: home.lng + e / (111_320 * Math.cos((home.lat * Math.PI) / 180)),
      };
    },
    scale,
  };
}

function east(origin: { lat: number; lng: number }, p: { lat: number; lng: number }) {
  return (p.lng - origin.lng) * 111_320 * Math.cos((origin.lat * Math.PI) / 180);
}

function north(origin: { lat: number; lng: number }, p: { lat: number; lng: number }) {
  return (p.lat - origin.lat) * 111_320;
}

function paint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: {
    waypoints: Waypoint[];
    zones: GeoZone[];
    selectedId: string | null;
    findings: SafetyFinding[];
    home: { lat: number; lng: number };
    sample: Sample | null;
  },
) {
  const { waypoints, zones, selectedId, findings, home, sample } = state;
  const proj = projector(width, height, home, waypoints);

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  const step = 18;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const g = proj.toGeo(x + step / 2, y + step / 2);
      const elev = sampleDemoTerrain(g.lat, g.lng);
      const t = Math.min(1, Math.max(0, (elev - 50) / 140));
      ctx.fillStyle = `rgba(${20 + t * 90}, ${40 + t * 70}, ${28 + t * 20}, 0.55)`;
      ctx.fillRect(x, y, step, step);
    }
  }

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let x = 40; x < width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (const zone of zones) {
    if (zone.polygon.length < 3) continue;
    ctx.beginPath();
    zone.polygon.forEach((p, i) => {
      const { x, y } = proj.toPx(p.lat, p.lng);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = COLORS.nfz;
    ctx.fill();
    ctx.strokeStyle = COLORS.nfzStroke;
    ctx.stroke();
    const label = proj.toPx(zone.polygon[0].lat, zone.polygon[0].lng);
    ctx.fillStyle = "#ffd0cc";
    ctx.font = "11px sans-serif";
    ctx.fillText(zone.name, label.x + 4, label.y - 6);
  }

  const visible = waypoints.filter((w) => w.visible);
  if (visible.length > 1) {
    ctx.beginPath();
    visible.forEach((w, i) => {
      const p = proj.toPx(w.lat, w.lng);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = COLORS.route;
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(55,228,111,0.45)";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  for (const wp of visible) {
    const p = proj.toPx(wp.lat, wp.lng);
    const selected = wp.id === selectedId;
    ctx.beginPath();
    ctx.arc(p.x, p.y, selected ? 8 : 6, 0, Math.PI * 2);
    ctx.fillStyle = selected ? COLORS.select : COLORS.route;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    ctx.fillText(String(wp.index), p.x + 9, p.y - 8);
  }

  const homePx = proj.toPx(home.lat, home.lng);
  ctx.strokeStyle = "#67e8f9";
  ctx.beginPath();
  ctx.arc(homePx.x, homePx.y, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#67e8f9";
  ctx.font = "11px sans-serif";
  ctx.fillText("H", homePx.x - 4, homePx.y - 12);

  for (const f of findings) {
    if (f.lat == null || f.lng == null) continue;
    const p = proj.toPx(f.lat, f.lng);
    ctx.fillStyle = f.severity === "critical" ? COLORS.crit : f.severity === "warning" ? COLORS.warn : COLORS.select;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 8);
    ctx.lineTo(p.x + 7, p.y + 6);
    ctx.lineTo(p.x - 7, p.y + 6);
    ctx.closePath();
    ctx.fill();
  }

  if (sample) {
    const p = proj.toPx(sample.lat, sample.lng);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((sample.heading * Math.PI) / 180);
    ctx.fillStyle = COLORS.drone;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, 7);
    ctx.lineTo(-8, -7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(12, 12, 168, 36);
  ctx.fillStyle = "#c9d4e0";
  ctx.font = "11px sans-serif";
  ctx.fillText("二维航迹回退 · 地形热力", 20, 26);
  ctx.fillStyle = "#8b97a8";
  ctx.fillText("绿线为规划航线，红三角为风险点", 20, 40);
}
