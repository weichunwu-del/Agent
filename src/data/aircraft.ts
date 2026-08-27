import type { AircraftProfile } from "../engine/types";

export const AIRCRAFT: AircraftProfile[] = [
  {
    id: "evo-max-4t",
    name: "多旋翼-EVO",
    maxSpeed: 23,
    cruiseSpeed: 12,
    maxAscent: 6,
    maxDescent: 5,
    maxAltAgl: 500,
    minAltAgl: 15,
    minClearance: 20,
    maxDistance: 15000,
    rcRange: 15000,
    videoRange: 12000,
    batteryWh: 174,
    hoverPowerW: 280,
    cruisePowerW: 320,
    reservePercent: 20,
    rthAltitudeAgl: 50,
    massKg: 1.6,
  },
  {
    id: "m30t",
    name: "M30T",
    maxSpeed: 23,
    cruiseSpeed: 10,
    maxAscent: 6,
    maxDescent: 5,
    maxAltAgl: 500,
    minAltAgl: 15,
    minClearance: 20,
    maxDistance: 15000,
    rcRange: 15000,
    videoRange: 12000,
    batteryWh: 204,
    hoverPowerW: 300,
    cruisePowerW: 340,
    reservePercent: 25,
    rthAltitudeAgl: 50,
    massKg: 3.8,
  },
];

export function aircraftById(id: string): AircraftProfile {
  return AIRCRAFT.find((a) => a.id === id) ?? AIRCRAFT[0];
}
