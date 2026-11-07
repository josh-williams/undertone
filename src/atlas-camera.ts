import type { Coordinates } from "./color";

export const MIN_ATLAS_ZOOM = 0.65;
export const MAX_ATLAS_ZOOM = 32;
export const DEFAULT_ATLAS_CAMERA = {
  yaw: -0.55,
  pitch: 0.16,
  zoom: 1,
  panX: 0,
  panY: 0,
};
export type AtlasCamera = typeof DEFAULT_ATLAS_CAMERA;
export type AtlasSize = { w: number; h: number };
export const atlasZoomFromSlider = (value: number) =>
  MIN_ATLAS_ZOOM * (MAX_ATLAS_ZOOM / MIN_ATLAS_ZOOM) ** (value / 1000);
export const atlasZoomToSlider = (zoom: number) =>
  Math.round(
    (1000 * Math.log(zoom / MIN_ATLAS_ZOOM)) /
      Math.log(MAX_ATLAS_ZOOM / MIN_ATLAS_ZOOM),
  );

export function zoomAtlas(camera: AtlasCamera, zoom: number): AtlasCamera {
  const next = Math.max(MIN_ATLAS_ZOOM, Math.min(MAX_ATLAS_ZOOM, zoom));
  const ratio = next / camera.zoom;
  // Keep the currently centered part of the cloud centered when magnifying it.
  return {
    ...camera,
    zoom: next,
    panX: camera.panX * ratio,
    panY: camera.panY * ratio,
  };
}
export function projectAtlasColor(
  p: Coordinates,
  camera: AtlasCamera,
  { w, h }: AtlasSize,
) {
  const x = p.a * 2.8,
    y = (p.l - 0.57) * 1.8,
    z = p.b * 2.8;
  const rx = x * Math.cos(camera.yaw) + z * Math.sin(camera.yaw);
  const rz = -x * Math.sin(camera.yaw) + z * Math.cos(camera.yaw);
  const ry = y * Math.cos(camera.pitch) - rz * Math.sin(camera.pitch);
  const depth = y * Math.sin(camera.pitch) + rz * Math.cos(camera.pitch);
  const scale =
    (Math.min(w * 0.95, h * 0.93) * camera.zoom) / (1.8 - depth * 0.35);
  return {
    x: w / 2 + camera.panX + rx * scale,
    y: h / 2 + camera.panY - ry * scale,
    z: depth,
  };
}
export function focusAtlasColor(
  camera: AtlasCamera,
  p: Coordinates,
  size: AtlasSize,
): AtlasCamera {
  const point = projectAtlasColor(p, camera, size);
  return {
    ...camera,
    panX: camera.panX + size.w / 2 - point.x,
    panY: camera.panY + size.h / 2 - point.y,
  };
}
