import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Grid2X2,
  Move,
  RotateCcw,
  Scan,
  ZoomIn,
  ZoomOut,
  ArrowUpRight,
} from "lucide-react";
import { distance, explain, ink, type Paint } from "./color";
import {
  neighborhoodRadius,
  relativePosition,
  projectNeighbor,
  type Vector,
  type Plane,
} from "./neighborhood";
import type { ViewState } from "./state";

type Props = {
  selected: Paint;
  neighbors: Paint[];
  view: ViewState["nearView"];
  count: ViewState["nearCount"];
  plane: Plane;
  onChange: (patch: Partial<ViewState>) => void;
  onSelect: (paint: Paint) => void;
  swatches: React.ReactNode;
};
const initialCamera = { yaw: -0.65, pitch: 0.3, zoom: 1 };
const planeLabels: Record<Plane, string> = {
  la: "Lightness × red/green",
  lb: "Lightness × yellow/blue",
  ab: "Hue plane · a × b",
};
export function NeighborExplorer({
  selected,
  neighbors,
  view,
  count,
  plane,
  onChange,
  onSelect,
  swatches,
}: Props) {
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [camera, setCamera] = useState(initialCamera);
  const [activeId, setActiveId] = useState<string | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  useEffect(() => {
    setCamera(initialCamera);
    setActiveId(null);
  }, [selected.id]);
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [view]);
  const height = width < 500 ? 360 : 440;
  const radius = useMemo(
    () => neighborhoodRadius(selected, neighbors),
    [selected, neighbors],
  );
  const scale = Math.min(width * 0.32, height * 0.34) * camera.zoom;
  const cx = width / 2,
    cy = height / 2;
  const spatialView = view === "swatches" ? "3d" : view;
  const project = (v: Vector) => {
    const p = projectNeighbor(v, spatialView, plane, camera.yaw, camera.pitch);
    return { x: cx + p.x * scale, y: cy - p.y * scale, z: p.z };
  };
  const points = neighbors
    .map((paint, i) => ({
      paint,
      rank: i + 1,
      ...project(relativePosition(paint, selected, radius)),
    }))
    .sort((a, b) => a.z - b.z);
  const active = neighbors.find((p) => p.id === activeId);
  const activePoint = points.find((p) => p.paint.id === activeId);
  const identical = neighbors.filter(
    (p) => distance(p, selected) < 0.000001,
  ).length;
  const axisDefinitions: {
    vector: Vector;
    positive: string;
    negative: string;
    key: string;
  }[] = [
    {
      vector: { x: 1, y: 0, z: 0 },
      positive: "Redder · +a",
      negative: "Greener · −a",
      key: "a",
    },
    {
      vector: { x: 0, y: 1, z: 0 },
      positive: "Lighter · +L",
      negative: "Darker · −L",
      key: "l",
    },
    {
      vector: { x: 0, y: 0, z: 1 },
      positive: "Yellower · +b",
      negative: "Bluer · −b",
      key: "b",
    },
  ];
  const axes = axisDefinitions.filter(
    (a) =>
      view === "3d" ||
      (plane === "la"
        ? a.key !== "b"
        : plane === "lb"
          ? a.key !== "a"
          : a.key !== "l"),
  );
  function orbit(key: string) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-0.13, 0],
      ArrowRight: [0.13, 0],
      ArrowUp: [0, 0.1],
      ArrowDown: [0, -0.1],
    };
    if (moves[key])
      setCamera((c) => ({
        ...c,
        yaw: c.yaw + moves[key][0],
        pitch: Math.max(-1.2, Math.min(1.2, c.pitch + moves[key][1])),
      }));
  }
  function zoom(delta: number) {
    setCamera((c) => ({
      ...c,
      zoom: Math.max(0.7, Math.min(2.5, c.zoom + delta)),
    }));
  }
  return (
    <section className="neighbors" aria-labelledby="neighbors-title">
      <div className="list-title neighbor-heading">
        <div>
          <span className="tiny-label">STAY IN THE NEIGHBORHOOD</span>
          <h2 id="neighbors-title">Close to {selected.name}</h2>
          <p>
            Explore the space around your color. Pick a neighbor to make it your
            new center.
          </p>
        </div>
        <div className="view-toggle" aria-label="Similar colors view">
          {(
            [
              ["2d", Scan, "2D"],
              ["3d", Box, "3D"],
              ["swatches", Grid2X2, "Swatches"],
            ] as const
          ).map(([v, Icon, label]) => (
            <button
              key={v}
              aria-label={`Similar colors ${label}`}
              aria-pressed={view === v}
              className={view === v ? "active" : ""}
              onClick={() => onChange({ nearView: v })}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="neighborhood-shell">
        <div className="neighborhood-toolbar">
          <label>
            Neighborhood{" "}
            <select
              aria-label="Number of similar colors"
              value={count}
              onChange={(e) =>
                onChange({ nearCount: e.target.value as Props["count"] })
              }
            >
              {["12", "24", "48"].map((n) => (
                <option value={n} key={n}>
                  {n} nearest paints
                </option>
              ))}
            </select>
          </label>
          {view === "2d" && (
            <select
              aria-label="Similar colors projection"
              value={plane}
              onChange={(e) => onChange({ nearPlane: e.target.value as Plane })}
            >
              {Object.entries(planeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
          <span className="neighborhood-space-label">
            {view === "swatches"
              ? "Ranked by OKLab distance"
              : view === "3d"
                ? "OKLab · three dimensions"
                : `OKLab · ${planeLabels[plane]}`}
          </span>
        </div>
        {view === "swatches" ? (
          <div className="neighbor-swatches">{swatches}</div>
        ) : (
          <div className="neighborhood-layout">
            <div className="neighborhood-plot" ref={plot}>
              <div className="neighborhood-center-chip">
                <i style={{ background: selected.hex }} />
                <span>
                  {selected.name}
                  <small>YOUR CENTER · {selected.id}</small>
                </span>
              </div>
              <svg
                className={
                  "neighborhood-svg " + (view === "3d" ? "orbitable" : "")
                }
                viewBox={`0 0 ${width} ${height}`}
                height={height}
                role="group"
                aria-label={`${view === "3d" ? "Rotatable 3D" : "2D"} local color neighborhood around ${selected.name}`}
                tabIndex={view === "3d" ? 0 : undefined}
                onKeyDown={(e) => {
                  if (
                    view === "3d" &&
                    e.target === e.currentTarget &&
                    e.key.startsWith("Arrow")
                  ) {
                    e.preventDefault();
                    orbit(e.key);
                  }
                }}
                onPointerDown={(e) => {
                  if (view === "3d" && e.button === 0) {
                    drag.current = {
                      x: e.clientX,
                      y: e.clientY,
                      startX: e.clientX,
                      startY: e.clientY,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }
                }}
                onPointerMove={(e) => {
                  if (!drag.current) return;
                  const d = drag.current;
                  const dx = e.clientX - d.x,
                    dy = e.clientY - d.y;
                  if (
                    Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 3
                  ) {
                    setActiveId(null);
                    setCamera((c) => ({
                      ...c,
                      yaw: c.yaw + dx * 0.008,
                      pitch: Math.max(
                        -1.2,
                        Math.min(1.2, c.pitch + dy * 0.006),
                      ),
                    }));
                  }
                  d.x = e.clientX;
                  d.y = e.clientY;
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              >
                <g className="neighborhood-guides" aria-hidden="true">
                  {view === "2d"
                    ? [0.5, 1].map((r) => (
                        <circle key={r} cx={cx} cy={cy} r={scale * r} />
                      ))
                    : (["xy", "xz", "yz"] as const).map((plane) => (
                        <path
                          key={plane}
                          d={
                            Array.from({ length: 65 }, (_, i) => {
                              const t = (i / 64) * Math.PI * 2;
                              const v =
                                plane === "xy"
                                  ? { x: Math.cos(t), y: Math.sin(t), z: 0 }
                                  : plane === "xz"
                                    ? { x: Math.cos(t), y: 0, z: Math.sin(t) }
                                    : { x: 0, y: Math.cos(t), z: Math.sin(t) };
                              const p = project(v);
                              return `${i ? "L" : "M"}${p.x},${p.y}`;
                            }).join(" ") + "Z"
                          }
                        />
                      ))}
                  {axes.map((a) => {
                    const plus = project({
                        x: a.vector.x * 1.15,
                        y: a.vector.y * 1.15,
                        z: a.vector.z * 1.15,
                      }),
                      minus = project({
                        x: -a.vector.x * 1.15,
                        y: -a.vector.y * 1.15,
                        z: -a.vector.z * 1.15,
                      });
                    return (
                      <g key={a.key}>
                        <line
                          x1={minus.x}
                          y1={minus.y}
                          x2={plus.x}
                          y2={plus.y}
                        />
                        <text
                          x={Math.max(65, Math.min(width - 65, plus.x))}
                          y={Math.max(75, Math.min(height - 25, plus.y - 9))}
                        >
                          {a.positive}
                        </text>
                        <text
                          x={Math.max(65, Math.min(width - 65, minus.x))}
                          y={Math.max(75, Math.min(height - 25, minus.y + 17))}
                        >
                          {a.negative}
                        </text>
                      </g>
                    );
                  })}
                </g>
                {points.map((point) => (
                  <line
                    key={"link-" + point.paint.id}
                    className={
                      "neighbor-link " +
                      (activeId === point.paint.id ? "highlighted" : "")
                    }
                    x1={cx}
                    y1={cy}
                    x2={point.x}
                    y2={point.y}
                    aria-hidden="true"
                  />
                ))}
                {points.map((point) => (
                  <g
                    key={point.paint.id}
                    role="button"
                    tabIndex={0}
                    className="neighbor-point"
                    aria-label={`Explore ${point.paint.name}, ${point.paint.id}. ${explain(selected, point.paint)}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseEnter={() => setActiveId(point.paint.id)}
                    onMouseLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(point.paint.id)}
                    onBlur={() => setActiveId(null)}
                    onClick={() => onSelect(point.paint)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(point.paint);
                      }
                    }}
                  >
                    <title>
                      {point.paint.name} · {point.paint.id} —{" "}
                      {explain(selected, point.paint)}
                    </title>
                    <circle
                      className="point-hit-area"
                      cx={point.x}
                      cy={point.y}
                      r={18}
                    />
                    <circle
                      className={
                        "neighbor-dot " +
                        (activeId === point.paint.id ? "highlighted" : "")
                      }
                      cx={point.x}
                      cy={point.y}
                      r={activeId === point.paint.id ? 16 : 12}
                      fill={point.paint.hex}
                    />
                    <text
                      className="point-rank"
                      x={point.x}
                      y={point.y + 3}
                      fill={ink(point.paint)}
                    >
                      {point.rank}
                    </text>
                  </g>
                ))}
                <g className="neighborhood-origin" aria-hidden="true">
                  <circle cx={cx} cy={cy} r={22} />
                  <circle cx={cx} cy={cy} r={17} fill={selected.hex} />
                  <circle cx={cx} cy={cy} r={3} fill={ink(selected)} />
                </g>
              </svg>
              {active && activePoint && (
                <div
                  className="neighbor-tooltip"
                  style={{
                    left: Math.max(
                      10,
                      Math.min(width - 220, activePoint.x - 100),
                    ),
                    top: Math.max(
                      74,
                      Math.min(height - 95, activePoint.y - 92),
                    ),
                  }}
                >
                  <strong>
                    {active.name} <small>{active.id}</small>
                  </strong>
                  <span>{explain(selected, active)}</span>
                  <small>Click to explore this paint</small>
                </div>
              )}
              <div className="neighborhood-plot-footer">
                <span>
                  {view === "3d" ? (
                    <>
                      <Move size={12} /> Drag or use arrow keys to orbit
                    </>
                  ) : (
                    "Two-axis projection; switch planes to see the third axis."
                  )}
                </span>
                <div className="neighborhood-camera">
                  <button
                    className="icon-button"
                    aria-label="Zoom out of similar colors"
                    onClick={() => zoom(-0.2)}
                    disabled={camera.zoom <= 0.7}
                  >
                    <ZoomOut size={15} />
                  </button>
                  <span>{Math.round(camera.zoom * 100)}%</span>
                  <button
                    className="icon-button"
                    aria-label="Zoom in on similar colors"
                    onClick={() => zoom(0.2)}
                    disabled={camera.zoom >= 2.5}
                  >
                    <ZoomIn size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Reset similar colors view"
                    onClick={() => setCamera(initialCamera)}
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div
              className="neighborhood-list"
              aria-label="Similar paint neighbors"
            >
              <div className="neighborhood-list-heading">
                <span>{neighbors.length} nearby paints</span>
                <small>ΔOK</small>
              </div>
              <div className="neighborhood-entries">
                {neighbors.map((p, i) => (
                  <button
                    key={p.id}
                    className={
                      "neighborhood-entry " +
                      (activeId === p.id ? "active" : "")
                    }
                    onMouseEnter={() => setActiveId(p.id)}
                    onMouseLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(p.id)}
                    onBlur={() => setActiveId(null)}
                    onClick={() => onSelect(p)}
                    aria-label={`Explore neighbor ${p.name}, ${p.id}. ${explain(selected, p)}`}
                  >
                    <span className="neighbor-rank">{i + 1}</span>
                    <i style={{ background: p.hex }} />
                    <span className="neighbor-entry-name">
                      {p.name}
                      <small>{p.id}</small>
                    </span>
                    <span className="neighbor-distance">
                      {distance(selected, p).toFixed(3)}
                    </span>
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="neighborhood-note">
          <span>
            Distances use equal units in OKLab. Closer points have more similar
            digital colors.
            {view === "2d"
              ? " A projection can hide differences on the third axis."
              : ""}
          </span>
          <span>
            {identical
              ? `${identical} paint${identical === 1 ? " shares" : "s share"} the center swatch; use the list to explore overlapping points.`
              : `Outer ${view === "3d" ? "sphere" : "ring"}: ΔOK ${radius.toFixed(3)}`}
          </span>
        </div>
      </div>
    </section>
  );
}
