import { distance, type Coordinates, type Paint } from "./color";

type Vec = [number, number, number];
const xyz = (p: Coordinates): Vec => [p.a, p.l, p.b];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const squared = (v: Vec) => dot(v, v);
const addScaled = (a: Vec, b: Vec, t: number): Vec => [
  a[0] + b[0] * t,
  a[1] + b[1] * t,
  a[2] + b[2] * t,
];
const segmentSquared = (p: Vec, a: Vec, b: Vec) => {
  const ab = sub(b, a);
  const length = squared(ab);
  return squared(
    sub(
      p,
      addScaled(
        a,
        ab,
        length ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / length)) : 0,
      ),
    ),
  );
};

/** Closest point on a triangle, including its edges and vertices. */
function triangleSquared(p: Vec, a: Vec, b: Vec, c: Vec): number {
  const ab = sub(b, a),
    ac = sub(c, a),
    ap = sub(p, a),
    d1 = dot(ab, ap),
    d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return squared(ap);
  const bp = sub(p, b),
    d3 = dot(ab, bp),
    d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return squared(bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return segmentSquared(p, a, b);
  const cp = sub(p, c),
    d5 = dot(ab, cp),
    d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return squared(cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return segmentSquared(p, a, c);
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return segmentSquared(p, b, c);
  const denom = 1 / (va + vb + vc),
    v = vb * denom,
    w = vc * denom;
  return squared(sub(p, addScaled(addScaled(a, ab, v), ac, w)));
}
export type SelectionHull = {
  vertices: Coordinates[];
  faces: { indices: [number, number, number]; normal: Vec; offset: number }[];
  edges: [number, number][];
  distance: (p: Coordinates) => number;
};

/** Exact supporting-face hull in three-dimensional OKLab, including flat/linear sets. */
export function selectionHull(selection: Coordinates[]): SelectionHull {
  const vertices = selection.filter(
    (p, i) => !selection.slice(0, i).some((q) => distance(p, q) < 1e-9),
  );
  const vectors = vertices.map(xyz);
  const faces: SelectionHull["faces"] = [];
  let volumetric = false;
  for (let i = 0; i < vectors.length; i++)
    for (let j = i + 1; j < vectors.length; j++)
      for (let k = j + 1; k < vectors.length; k++) {
        let normal = cross(
          sub(vectors[j], vectors[i]),
          sub(vectors[k], vectors[i]),
        );
        const length = Math.sqrt(squared(normal));
        if (length < 1e-12) continue;
        normal = normal.map((x) => x / length) as Vec;
        let offset = dot(normal, vectors[i]);
        const sides = vectors.map((p) => dot(normal, p) - offset);
        const min = Math.min(...sides),
          max = Math.max(...sides);
        if (min < -1e-9 && max > 1e-9) continue;
        if (Math.max(Math.abs(min), Math.abs(max)) > 1e-9) volumetric = true;
        if (max > 1e-9) {
          normal = normal.map((x) => -x) as Vec;
          offset = -offset;
        }
        faces.push({ indices: [i, j, k], normal, offset });
      }
  const edgeSet = new Set<string>();
  for (const face of faces)
    for (const [i, j] of [
      [face.indices[0], face.indices[1]],
      [face.indices[1], face.indices[2]],
      [face.indices[2], face.indices[0]],
    ])
      edgeSet.add([Math.min(i, j), Math.max(i, j)].join(","));
  if (!faces.length)
    for (let i = 0; i < vertices.length; i++)
      for (let j = i + 1; j < vertices.length; j++) edgeSet.add(`${i},${j}`);
  return {
    vertices,
    faces,
    edges: [...edgeSet].map(
      (e) => e.split(",").map(Number) as [number, number],
    ),
    distance(p) {
      if (!vectors.length) return Infinity;
      const point = xyz(p);
      if (
        volumetric &&
        faces.every((f) => dot(f.normal, point) - f.offset <= 1e-9)
      )
        return 0;
      if (faces.length)
        return Math.sqrt(
          Math.max(
            0,
            Math.min(
              ...faces.map((f) =>
                triangleSquared(
                  point,
                  ...(f.indices.map((i) => vectors[i]) as [Vec, Vec, Vec]),
                ),
              ),
            ),
          ),
        );
      let best = squared(sub(point, vectors[0]));
      for (let i = 0; i < vectors.length; i++)
        for (let j = i + 1; j < vectors.length; j++)
          best = Math.min(best, segmentSquared(point, vectors[i], vectors[j]));
      return Math.sqrt(best);
    },
  };
}
export function selectionCenter(selection: Paint[]): Coordinates {
  if (!selection.length) return { l: 0.5, a: 0, b: 0, c: 0, h: 0 };
  const mean = (key: "l" | "a" | "b") =>
    selection.reduce((sum, p) => sum + p[key], 0) / selection.length;
  const l = mean("l"),
    a = mean("a"),
    b = mean("b");
  return {
    l,
    a,
    b,
    c: Math.hypot(a, b),
    h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
  };
}
export function paintsInSelectionRegion(
  selection: Paint[],
  catalog: Paint[],
  tolerance: number,
) {
  if (!selection.length) return [];
  const hull = selectionHull(selection),
    selectedHex = new Set(selection.map((p) => p.hex));
  const seen = new Set<string>();
  return catalog
    .flatMap((p) => {
      if (selectedHex.has(p.hex) || seen.has(p.hex)) return [];
      seen.add(p.hex);
      const offset = hull.distance(p);
      return offset <= tolerance + 1e-9
        ? [
            {
              paint: p,
              offset,
              nearest: Math.min(...selection.map((s) => distance(p, s))),
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        a.offset - b.offset ||
        a.nearest - b.nearest ||
        a.paint.id.localeCompare(b.paint.id),
    );
}
