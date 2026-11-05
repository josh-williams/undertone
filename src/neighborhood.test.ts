import { describe, expect, it } from "vitest";
import { byId, distance, nearest, paints } from "./color";
import {
  neighborhoodRadius,
  projectNeighbor,
  relativePosition,
} from "./neighborhood";
import { defaults, encodeLocation, decodeLocation } from "./state";

describe("local color geometry", () => {
  const center = byId.get("HC-114")!;
  const neighbors = nearest(
    center,
    paints.filter((p) => p.id !== center.id),
    48,
  );
  const radius = neighborhoodRadius(center, neighbors);
  it("centers the selected paint and fits the neighborhood without distorting distances", () => {
    expect(relativePosition(center, center, radius)).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
    for (const p of neighbors) {
      const v = relativePosition(p, center, radius);
      expect(Math.hypot(v.x, v.y, v.z)).toBeLessThanOrEqual(1.000001);
      expect(Math.hypot(v.x, v.y, v.z) * radius).toBeCloseTo(
        distance(p, center),
        10,
      );
    }
  });
  it("preserves 3D distances through rotation and uses the intended 2D planes", () => {
    const v = { x: 0.3, y: -0.7, z: 0.2 };
    const rotated = projectNeighbor(v, "3d", "la", 0.8, -0.4);
    expect(Math.hypot(rotated.x, rotated.y, rotated.z)).toBeCloseTo(
      Math.hypot(v.x, v.y, v.z),
      10,
    );
    expect(projectNeighbor(v, "2d", "la", 0, 0)).toEqual(v);
    expect(projectNeighbor(v, "2d", "lb", 0, 0)).toEqual({
      x: 0.2,
      y: -0.7,
      z: 0.3,
    });
    expect(projectNeighbor(v, "2d", "ab", 0, 0)).toEqual({
      x: 0.3,
      y: 0.2,
      z: -0.7,
    });
  });
  it("keeps identical-color neighborhoods finite", () => {
    const tiny = neighborhoodRadius(center, [{ ...center, id: "alias" }]);
    expect(tiny).toBeGreaterThan(0);
    expect(relativePosition(center, center, tiny)).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
  });
  it("shares neighborhood settings and accepts old links without them", () => {
    const state = {
      ...defaults,
      nearView: "2d" as const,
      nearCount: "48" as const,
      nearPlane: "ab" as const,
    };
    expect(decodeLocation(encodeLocation(state))).toEqual(state);
    expect(decodeLocation("#paint=CSP-760&family=Green").nearView).toBe("3d");
    expect(decodeLocation("#paint=CSP-760&family=Green").paint).toBe("CSP-760");
  });
});
