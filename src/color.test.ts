import { describe, expect, it } from "vitest";
import {
  paints,
  byId,
  inputColor,
  nearest,
  directional,
  between,
  distance,
  type Paint,
  type Direction,
} from "./color";
import { defaults, encodeLocation, decodeLocation } from "./state";
import source from "../data/benjamin-moore/source.json";
import { readPreference, savePreference } from "./state";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

describe("catalog and color matching", () => {
  it("contains validated manufacturer values and unique stable codes", () => {
    expect(paints.length).toBe(source.recordCount);
    expect(paints.length).toBeGreaterThan(3000);
    expect(byId.size).toBe(paints.length);
    expect(
      paints.every((p) => [p.l, p.a, p.b, p.c, p.h].every(Number.isFinite)),
    ).toBe(true);
  });
  it("keeps the checked-in snapshot consistent with its provenance checksum", () => {
    const bytes = readFileSync(
      new URL("../data/benjamin-moore/colors.json", import.meta.url),
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      source.sha256,
    );
  });
  it("parses CSS colors, preserves wide gamut targets, and rejects transparency", () => {
    for (const s of [
      "#abc",
      "rgb(150 120 80)",
      "hsl(120 20% 50%)",
      "oklch(70% 0.05 140)",
    ])
      expect(inputColor(s)).toBeDefined();
    expect(inputColor("nonsense")).toBeUndefined();
    expect(inputColor("rgb(0 0 0 / .5)")).toBeUndefined();
    expect(inputColor("oklch(70% .4 140)")?.outOfGamut).toBe(true);
  });
  it("finds an exact match to every sampled manufacturer hex", () => {
    for (const p of paints.filter((_, i) => i % 137 === 0))
      expect(
        distance(nearest(inputColor(p.hex)!, paints, 1)[0], p),
      ).toBeLessThan(1e-7);
  });
  it("direction steps preserve the requested direction across the catalog", () => {
    for (const p of paints.filter((_, i) => i % 23 === 0))
      for (const d of [
        "lighter",
        "darker",
        "muted",
        "colorful",
        "clockwise",
        "counterclockwise",
      ] as Direction[]) {
        for (const n of directional(p, d)) {
          expect(n.id).not.toBe(p.id);
          if (d === "lighter") expect(n.l).toBeGreaterThan(p.l + 0.008);
          if (d === "darker") expect(n.l).toBeLessThan(p.l - 0.008);
          if (d === "muted") expect(n.c).toBeLessThan(p.c - 0.004);
          if (d === "colorful") expect(n.c).toBeGreaterThan(p.c + 0.004);
          const dh = ((n.h - p.h + 540) % 360) - 180;
          if (d === "clockwise") expect(dh).toBeGreaterThan(3);
          if (d === "counterclockwise") expect(dh).toBeLessThan(-3);
        }
      }
  });
  it("does not force a step beyond an extreme or attach hue to gray", () => {
    const brightest = [...paints].sort((a, b) => b.l - a.l)[0];
    expect(directional(brightest, "lighter")).toHaveLength(0);
    expect(directional({ ...brightest, c: 0 }, "clockwise")).toHaveLength(0);
  });
  it("wraps hue navigation through zero degrees", () => {
    const base = paints[0];
    const a = { ...base, ...inputColor("oklch(.7 .05 359)")!, id: "a" };
    const b = { ...base, ...inputColor("oklch(.7 .05 11)")!, id: "b" };
    expect(directional(a, "clockwise", [a, b]).map((p) => p.id)).toEqual(["b"]);
    expect(directional(b, "counterclockwise", [a, b]).map((p) => p.id)).toEqual(
      ["a"],
    );
  });
  it("finds only interior paints within a path tolerance, in order", () => {
    const a = byId.get("HC-114")!,
      b = byId.get("OC-17")!;
    const path = between(a, b, 0.015);
    expect(path.length).toBeGreaterThan(0);
    expect(
      path.every(
        (p) =>
          p.t > 0.02 &&
          p.t < 0.98 &&
          p.offset <= 0.015 &&
          p.paint.id !== a.id &&
          p.paint.id !== b.id,
      ),
    ).toBe(true);
    expect(path.every((p, i) => !i || p.t >= path[i - 1].t)).toBe(true);
    expect(between(a, a, 0.06)).toEqual([]);
    const same = { ...a, id: "same" } as Paint;
    expect(between(a, same, 0.06)).toEqual([]);
  });
});
describe("shareable view state", () => {
  it("round trips colors, filters, pins and CSS color input", () => {
    const state = {
      ...defaults,
      paint: "OC-17",
      query: "oklch(70% 0.05 140)",
      pins: ["OC-17", "HC-114"],
      view: "3d" as const,
      mode: "between" as const,
      tolerance: 0.023,
    };
    expect(decodeLocation(encodeLocation(state))).toEqual(state);
  });
  it("recovers from malformed or unsupported state", () => {
    expect(decodeLocation("#view=bogus&tolerance=NaN")).toEqual(defaults);
    expect(decodeLocation("")).toEqual(defaults);
  });
  it("handles unavailable browser storage without interrupting exploration", () => {
    expect(readPreference("missing")).toBeNull();
    expect(() => savePreference("test", "value")).not.toThrow();
  });
});
