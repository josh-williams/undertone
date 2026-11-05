import { describe, expect, it } from "vitest";
import { selectionHull, paintsInSelectionRegion } from "./selection-region";
import { byId, type Coordinates, type Paint } from "./color";
import { decodeLocation, encodeLocation, defaults } from "./state";

const p = (l: number, a: number, b: number): Coordinates => ({
  l,
  a,
  b,
  c: Math.hypot(a, b),
  h: 0,
});
describe("comparison selection region", () => {
  it("reduces to a point or a segment for one or two colors", () => {
    const a = p(0.5, 0, 0),
      b = p(0.7, 0, 0);
    expect(selectionHull([a]).distance(p(0.5, 0.03, 0.04))).toBeCloseTo(
      0.05,
      10,
    );
    const hull = selectionHull([a, b]);
    expect(hull.distance(p(0.6, 0, 0))).toBeCloseTo(0, 10);
    expect(hull.distance(p(0.6, 0.02, 0))).toBeCloseTo(0.02, 10);
    expect(hull.distance(p(0.8, 0, 0))).toBeCloseTo(0.1, 10);
  });
  it("finds the interior and boundary of a flat triangle", () => {
    const hull = selectionHull([p(0.5, 0, 0), p(0.7, 0, 0), p(0.5, 0.2, 0)]);
    expect(hull.distance(p(0.55, 0.05, 0))).toBeCloseTo(0, 10);
    expect(hull.distance(p(0.55, 0.05, 0.03))).toBeCloseTo(0.03, 10);
    expect(hull.distance(p(0.7, 0.2, 0))).toBeCloseTo(Math.sqrt(0.02), 10);
  });
  it("covers the volume between four colors rather than only their pairwise paths", () => {
    const hull = selectionHull([
      p(0.5, 0, 0),
      p(0.7, 0, 0),
      p(0.5, 0.2, 0),
      p(0.5, 0, 0.2),
    ]);
    expect(hull.distance(p(0.55, 0.05, 0.05))).toBeCloseTo(0, 10);
    expect(hull.distance(p(0.5, -0.03, 0))).toBeCloseTo(0.03, 10);
    expect(hull.distance(p(0.7, 0.2, 0.2))).toBeCloseTo(0.4 / Math.sqrt(3), 10);
  });
  it("handles repeated colors and collinear or coplanar palettes", () => {
    const a = p(0.5, 0, 0),
      b = p(0.7, 0, 0);
    expect(
      selectionHull([a, a, b, p(0.6, 0, 0)]).distance(p(0.6, 0.02, 0)),
    ).toBeCloseTo(0.02, 10);
    const square = selectionHull([
      p(0.5, 0, 0),
      p(0.7, 0, 0),
      p(0.7, 0.2, 0),
      p(0.5, 0.2, 0),
    ]);
    expect(square.distance(p(0.6, 0.1, 0))).toBeCloseTo(0, 10);
    expect(square.distance(p(0.8, 0.1, 0))).toBeCloseTo(0.1, 10);
    expect(selectionHull([]).distance(a)).toBe(Infinity);
  });
  it("excludes selected swatches and aliases and broadens monotonically", () => {
    const selected = [byId.get("CSP-760")!, byId.get("2139-40")!];
    const near = {
      ...selected[0],
      ...p(
        (selected[0].l + selected[1].l) / 2,
        (selected[0].a + selected[1].a) / 2,
        (selected[0].b + selected[1].b) / 2,
      ),
      id: "near",
      hex: "#123456",
    } as Paint;
    const far = { ...near, l: near.l + 0.1, id: "far", hex: "#abcdef" };
    const catalog = [
      ...selected,
      { ...selected[0], id: "alias" },
      near,
      { ...near, id: "near-alias" },
      far,
    ];
    const tight = paintsInSelectionRegion(selected, catalog, 0.002);
    expect(tight.map((x) => x.paint.id)).toEqual(["near"]);
    expect(paintsInSelectionRegion(selected, catalog, 0.2).length).toBe(2);
    expect(paintsInSelectionRegion([], catalog, 0.2)).toEqual([]);
  });
  it("migrates old between links and round trips the new controls", () => {
    const legacy = decodeLocation(
      "#mode=between&start=445&end=2139-40&tolerance=0.021&pins=OC-17",
    );
    expect(legacy.mode).toBe("compare");
    expect(legacy.paint).toBe("445");
    expect(legacy.pins).toEqual(["445", "2139-40"]);
    expect(legacy.compareNearby).toBe("on");
    expect(legacy.tolerance).toBe(0.021);
    const state = {
      ...defaults,
      mode: "compare" as const,
      compareNearby: "on" as const,
      compareView: "2d" as const,
      comparePlane: "ab" as const,
      pins: ["445", "2139-40"],
    };
    expect(decodeLocation(encodeLocation(state))).toEqual(state);
  });
});
