import { distance, type Coordinates, type Paint } from "./color";

export type Plane = "la" | "lb" | "ab";
export type Vector = { x: number; y: number; z: number };
export const neighborhoodRadius = (center: Paint, neighbors: Paint[]) =>
  Math.max(0.005, ...neighbors.map((p) => distance(center, p)));

/** Equal units on every axis; never jitter or stretch axes to separate paints. */
export function relativePosition(
  p: Coordinates,
  center: Coordinates,
  radius: number,
): Vector {
  return {
    x: (p.a - center.a) / radius,
    y: (p.l - center.l) / radius,
    z: (p.b - center.b) / radius,
  };
}
export function projectNeighbor(
  point: Vector,
  view: "2d" | "3d",
  plane: Plane,
  yaw: number,
  pitch: number,
): Vector {
  if (view === "2d") {
    if (plane === "lb") return { x: point.z, y: point.y, z: point.x };
    if (plane === "ab") return { x: point.x, y: point.z, z: point.y };
    return point;
  }
  const x = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
  const z = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
  return {
    x,
    y: point.y * Math.cos(pitch) - z * Math.sin(pitch),
    z: point.y * Math.sin(pitch) + z * Math.cos(pitch),
  };
}
