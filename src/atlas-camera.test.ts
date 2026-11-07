import { describe, expect, it } from "vitest";
import {
  DEFAULT_ATLAS_CAMERA,
  MAX_ATLAS_ZOOM,
  MIN_ATLAS_ZOOM,
  atlasZoomFromSlider,
  atlasZoomToSlider,
  focusAtlasColor,
  projectAtlasColor,
  zoomAtlas,
} from "./atlas-camera";
import { byId } from "./color";

describe("Explore camera", () => {
  const size = { w: 800, h: 470 },
    paint = byId.get("1496")!;
  it("offers continuous logarithmic zoom from the overview to 32×", () => {
    expect(atlasZoomFromSlider(0)).toBeCloseTo(MIN_ATLAS_ZOOM, 10);
    expect(atlasZoomFromSlider(1000)).toBeCloseTo(MAX_ATLAS_ZOOM, 10);
    expect(atlasZoomToSlider(MAX_ATLAS_ZOOM)).toBe(1000);
    expect(atlasZoomFromSlider(501) / atlasZoomFromSlider(500)).toBeCloseTo(
      atlasZoomFromSlider(901) / atlasZoomFromSlider(900),
      10,
    );
  });
  it("focuses any paint and keeps it centered through deep zoom and zooming out", () => {
    const focused = focusAtlasColor(DEFAULT_ATLAS_CAMERA, paint, size);
    for (const zoom of [0.65, 1, 8, 32]) {
      const camera = zoomAtlas(focused, zoom),
        point = projectAtlasColor(paint, camera, size);
      expect(point.x).toBeCloseTo(size.w / 2, 8);
      expect(point.y).toBeCloseTo(size.h / 2, 8);
    }
  });
  it("clamps zoom and preserves orientation", () => {
    expect(zoomAtlas(DEFAULT_ATLAS_CAMERA, 100).zoom).toBe(MAX_ATLAS_ZOOM);
    expect(zoomAtlas(DEFAULT_ATLAS_CAMERA, 0.001).zoom).toBe(MIN_ATLAS_ZOOM);
    const changed = zoomAtlas(
      { ...DEFAULT_ATLAS_CAMERA, yaw: 1, pitch: 0.4, panX: 10, panY: -20 },
      8,
    );
    expect(changed).toMatchObject({ yaw: 1, pitch: 0.4, panX: 80, panY: -160 });
  });
});
