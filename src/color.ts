import { converter, formatHex, inGamut, parse } from "culori";
import { Schema } from "effect";
import records from "../data/benjamin-moore/colors.json";
import { CatalogSchema } from "./catalog-schema";

const toLab = converter("oklab");
const toLch = converter("oklch");
export type Coordinates = {
  l: number;
  a: number;
  b: number;
  c: number;
  h: number;
};
export type Paint = Coordinates & {
  id: string;
  name: string;
  hex: string;
  lrv: number;
  previousName: string | null;
  best: boolean;
};
export const paints: Paint[] = Schema.decodeUnknownSync(CatalogSchema)(
  records,
).map((p) => {
  const hex = "#" + p.hex;
  const lab = toLab(hex)!;
  const lch = toLch(hex)!;
  return {
    id: p.number,
    name: p.name,
    hex,
    lrv: p.lrv,
    previousName: p.previous_name,
    best: p.is_best_selling,
    l: lab.l,
    a: lab.a,
    b: lab.b,
    c: lch.c,
    h: lch.h ?? 0,
  };
});
export const byId = new Map(paints.map((p) => [p.id, p]));
export const distance = (a: Coordinates, b: Coordinates) =>
  Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
export const nearest = (target: Coordinates, catalog = paints, count = 12) =>
  [...catalog]
    .sort(
      (a, b) =>
        distance(a, target) - distance(b, target) || a.id.localeCompare(b.id),
    )
    .slice(0, count);
export function inputColor(
  input: string,
): (Coordinates & { hex: string; outOfGamut: boolean }) | undefined {
  const parsed = parse(input.trim());
  if (!parsed || (parsed.alpha !== undefined && parsed.alpha < 1))
    return undefined;
  const lab = toLab(parsed),
    lch = toLch(parsed);
  if (!lab || !lch || ![lab.l, lab.a, lab.b].every(Number.isFinite))
    return undefined;
  return {
    l: lab.l,
    a: lab.a,
    b: lab.b,
    c: lch.c,
    h: lch.h ?? 0,
    hex: formatHex(parsed)!,
    outOfGamut: !inGamut("rgb")(parsed),
  };
}
export type Direction =
  | "lighter"
  | "darker"
  | "muted"
  | "colorful"
  | "clockwise"
  | "counterclockwise";
export const directionLabels: Record<Direction, string> = {
  lighter: "Lighter",
  darker: "Darker",
  muted: "More muted",
  colorful: "More colorful",
  clockwise: "Hue clockwise",
  counterclockwise: "Hue counterclockwise",
};
const hueDelta = (a: number, b: number) => ((b - a + 540) % 360) - 180;
export function directional(
  from: Paint,
  direction: Direction,
  catalog = paints,
): Paint[] {
  const hue = direction === "clockwise" || direction === "counterclockwise";
  if (hue && from.c < 0.008) return [];
  const target = { l: from.l, c: from.c, h: from.h };
  if (direction === "lighter") target.l += 0.035;
  if (direction === "darker") target.l -= 0.035;
  if (direction === "muted") target.c = Math.max(0, target.c - 0.018);
  if (direction === "colorful") target.c += 0.018;
  if (hue) target.h += direction === "clockwise" ? 12 : -12;
  const lab = toLab({ mode: "oklch", ...target })!;
  const candidates = catalog.filter((p) => {
    if (p.id === from.id || distance(from, p) < 0.001) return false;
    const dl = p.l - from.l,
      dc = p.c - from.c,
      dh = hueDelta(from.h, p.h);
    if (direction === "lighter" || direction === "darker")
      return (
        (direction === "lighter" ? dl > 0.008 : dl < -0.008) &&
        Math.abs(dl) < 0.13 &&
        Math.hypot(p.a - from.a, p.b - from.b) < 0.035
      );
    if (direction === "muted" || direction === "colorful")
      return (
        (direction === "muted" ? dc < -0.004 : dc > 0.004) &&
        Math.abs(dc) < 0.07 &&
        Math.abs(dl) < 0.045 &&
        (Math.min(from.c, p.c) < 0.012 || Math.abs(dh) < 25)
      );
    return (
      (direction === "clockwise" ? dh > 3 : dh < -3) &&
      Math.abs(dh) < 40 &&
      p.c > 0.008 &&
      Math.abs(dl) < 0.04 &&
      Math.abs(dc) < 0.025
    );
  });
  return nearest({ ...target, a: lab.a, b: lab.b }, candidates, 6);
}
// OKLCH hue angles differ from HSL: red ≈ 29°, yellow ≈ 100°, blue ≈ 264°.
const hueNames = [
  "rose",
  "red",
  "orange",
  "yellow",
  "yellow-green",
  "green",
  "teal",
  "cyan",
  "blue",
  "blue-violet",
  "purple",
  "magenta",
];
export function explain(from: Coordinates, to: Coordinates): string {
  const parts: string[] = [];
  const dl = to.l - from.l,
    dc = to.c - from.c;
  if (Math.abs(dl) > 0.008)
    parts.push(
      `${Math.abs(dl) < 0.04 ? "Slightly" : "Noticeably"} ${dl > 0 ? "lighter" : "darker"}`,
    );
  if (Math.abs(dc) > 0.004)
    parts.push(
      `${Math.abs(dc) < 0.02 ? "slightly" : "noticeably"} ${dc > 0 ? "more colorful" : "more muted"}`,
    );
  const dh = hueDelta(from.h, to.h);
  if (Math.min(from.c, to.c) > 0.008 && Math.abs(dh) > 3) {
    // Name the next hue in the direction of travel, so opposing steps are distinct.
    const sector = dh > 0 ? Math.ceil(to.h / 30) : Math.floor(to.h / 30);
    parts.push(`shifted toward ${hueNames[(sector + 12) % 12]}`);
  }
  if (!parts.length) return "Very close in digital color";
  const text = parts.join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
export function between(
  a: Paint,
  b: Paint,
  tolerance: number,
  catalog = paints,
): { paint: Paint; t: number; offset: number }[] {
  const v = [b.l - a.l, b.a - a.a, b.b - a.b];
  const len = v.reduce((s, x) => s + x * x, 0);
  if (len < 1e-8) return [];
  return catalog
    .flatMap((p) => {
      if (p.id === a.id || p.id === b.id) return [];
      const w = [p.l - a.l, p.a - a.a, p.b - a.b];
      const t = w.reduce((s, x, i) => s + x * v[i], 0) / len;
      const offset = Math.hypot(...w.map((x, i) => x - t * v[i]));
      return t > 0.02 && t < 0.98 && offset <= tolerance
        ? [{ paint: p, t, offset }]
        : [];
    })
    .sort((x, y) => x.t - y.t || x.offset - y.offset);
}
export const families = [
  "All colors",
  "Neutrals",
  "Red & pink",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Violet",
] as const;
export function inFamily(p: Paint, family: string) {
  if (family === "All colors") return true;
  if (family === "Neutrals") return p.c < 0.035;
  if (p.c < 0.02) return false;
  if (family === "Red & pink") return p.h < 40 || p.h >= 345;
  if (family === "Orange") return p.h >= 40 && p.h < 75;
  if (family === "Yellow") return p.h >= 75 && p.h < 115;
  if (family === "Green") return p.h >= 115 && p.h < 195;
  if (family === "Blue") return p.h >= 195 && p.h < 285;
  return p.h >= 285 && p.h < 345;
}
export const ink = (p: Coordinates) => (p.l > 0.67 ? "#252724" : "#fff");
