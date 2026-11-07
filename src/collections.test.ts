import { describe, expect, it } from "vitest";
import {
  collections,
  collectionIds,
  collectionForCode,
  filterCollections,
} from "./collections";
import { paints, byId, nearest, directional } from "./color";
import { paintsInSelectionRegion } from "./selection-region";
import { defaults, decodeLocation, encodeLocation } from "./state";

describe("collection filtering", () => {
  it("classifies every snapshot record and distinguishes the two Classics collections", () => {
    expect(paints.every((p) => collectionForCode(p.id) !== undefined)).toBe(
      true,
    );
    expect(filterCollections(paints, collectionIds)).toHaveLength(
      paints.length,
    );
    expect(filterCollections(paints, ["classics"])).toHaveLength(1680);
    expect(filterCollections(paints, ["designer-classics"])).toHaveLength(231);
    expect(filterCollections(paints, ["historical"])).toHaveLength(191);
    expect(collectionForCode("1496")).toBe("classics");
    expect(collectionForCode("CC-560")).toBe("designer-classics");
    expect(collectionForCode("2139-40")).toBe("color-preview");
    expect(collectionForCode("1681")).toBeUndefined();
    expect(collectionForCode("2176-10")).toBeUndefined();
    expect(new Set(collections.map((c) => c.id)).size).toBe(collections.length);
  });
  it("includes the union of choices, supports no choices, and does not mutate the catalog", () => {
    const union = filterCollections(paints, [
      "designer-classics",
      "historical",
    ]);
    expect(union).toHaveLength(422);
    expect(union.every((p) => /^(CC|HC)-/.test(p.id))).toBe(true);
    expect(filterCollections(paints, [])).toEqual([]);
    expect(paints).toHaveLength(4068);
  });
  it("ranks similar colors within the chosen collections and restricts directional steps", () => {
    const selected = byId.get("1496")!;
    const catalog = filterCollections(paints, [
      "designer-classics",
      "historical",
    ]);
    const matches = nearest(selected, catalog, 24);
    expect(matches).toHaveLength(24);
    expect(matches[0].id).toBe("CC-560");
    expect(matches.every((p) => /^(CC|HC)-/.test(p.id))).toBe(true);
    expect(
      directional(selected, "lighter", catalog).every((p) =>
        /^(CC|HC)-/.test(p.id),
      ),
    ).toBe(true);
  });
  it("filters nearby candidates before grouping aliases, preserving the selected palette", () => {
    const pins = [byId.get("HC-123")!, byId.get("CSP-760")!];
    const catalog = filterCollections(paints, ["designer-classics"]);
    const candidates = paintsInSelectionRegion(pins, catalog, 0.06);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every(({ paint }) => paint.id.startsWith("CC-"))).toBe(
      true,
    );
    expect(candidates.some(({ paint }) => paint.id === "CC-560")).toBe(true);
    expect(paintsInSelectionRegion(pins, [], 0.06)).toEqual([]);
    expect(pins.map((p) => p.id)).toEqual(["HC-123", "CSP-760"]);
  });
  it("round trips independent filters, including an explicitly empty choice", () => {
    const state = {
      ...defaults,
      pins: ["1496", "HC-123"],
      collections: ["designer-classics", "historical"] as const,
      nearCollections: ["color-stories"] as const,
      compareCollections: [],
    };
    expect(decodeLocation(encodeLocation(state))).toEqual(state);
    expect(encodeLocation(defaults)).toBe("#");
    expect(
      decodeLocation(
        "#paint=1496&collections=designer-classics,unknown,designer-classics",
      ),
    ).toEqual({
      ...defaults,
      paint: "1496",
      collections: ["designer-classics"],
    });
    expect(decodeLocation("#collections=unknown").collections).toEqual([]);
    expect(decodeLocation("#paint=1496").nearCollections).toEqual(
      collectionIds,
    );
  });
});
