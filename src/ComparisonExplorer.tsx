import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Box,
  Download,
  Grid2X2,
  Move,
  Plus,
  RotateCcw,
  Scan,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { paints, distance, explain, ink, type Paint } from "./color";
import { projectNeighbor, relativePosition, type Vector } from "./neighborhood";
import {
  paintsInSelectionRegion,
  selectionCenter,
  selectionHull,
} from "./selection-region";
import { MAX_PALETTE_SIZE, type ViewState } from "./state";

type Props = {
  pins: Paint[];
  inspected: Paint;
  state: ViewState;
  onChange: (patch: Partial<ViewState>, replace?: boolean) => void;
  onInspect: (p: Paint) => void;
  onPin: (p: Paint) => void;
  onExport: () => void;
  surround: ReactNode;
};
const initialCamera = { yaw: -0.6, pitch: 0.3, zoom: 1 };
export function ComparisonExplorer({
  pins,
  inspected,
  state,
  onChange,
  onInspect,
  onPin,
  onExport,
  surround,
}: Props) {
  const [query, setQuery] = useState("");
  const [camera, setCamera] = useState(initialCamera);
  const [hover, setHover] = useState<string | null>(null);
  const [limit, setLimit] = useState(24);
  const plot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const frameKey = pins
    .map((p) => p.id)
    .sort()
    .join(",");
  useEffect(() => {
    setCamera((c) => ({ ...c, zoom: 1 }));
    setHover(null);
    setLimit(24);
  }, [frameKey]);
  useEffect(() => {
    setLimit(24);
  }, [state.tolerance]);
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [state.compareView, pins.length === 0]);
  const hull = useMemo(() => selectionHull(pins), [frameKey]);
  const center = useMemo(() => selectionCenter(pins), [frameKey]);
  const radius =
    Math.max(0.012, ...pins.map((p) => distance(center, p))) + state.tolerance;
  const nearby = state.compareNearby === "on";
  const candidates = useMemo(
    () =>
      nearby ? paintsInSelectionRegion(pins, paints, state.tolerance) : [],
    [frameKey, nearby, state.tolerance],
  );
  const selectedIds = new Set(pins.map((p) => p.id));
  const suggestions = query.trim()
    ? paints
        .filter(
          (p) =>
            !selectedIds.has(p.id) &&
            `${p.name} ${p.id}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        )
        .slice(0, 8)
    : [];
  const height = width < 500 ? 390 : 490;
  const scale = Math.min(width * 0.32, height * 0.34) * camera.zoom;
  const project = (v: Vector) => {
    const p = projectNeighbor(
      v,
      state.compareView === "2d" ? "2d" : "3d",
      state.comparePlane,
      camera.yaw,
      camera.pitch,
    );
    return { x: width / 2 + p.x * scale, y: height / 2 - p.y * scale, z: p.z };
  };
  const point = (p: Paint) => project(relativePosition(p, center, radius));
  const displayed = candidates.slice(0, 400);
  const points = [
    ...displayed.map(({ paint }) => ({ paint, saved: false, rank: 0 })),
    ...pins.map((paint, i) => ({ paint, saved: true, rank: i + 1 })),
  ]
    .map((p) => ({ ...p, ...point(p.paint) }))
    .sort((a, b) => a.z - b.z);
  const focused = hover ?? inspected.id;
  const tooltip = points.find((p) => p.paint.id === hover);
  const fit = () => setCamera(initialCamera);
  const zoom = (delta: number) =>
    setCamera((c) => ({
      ...c,
      zoom: Math.max(0.6, Math.min(3, c.zoom + delta)),
    }));
  function orbit(key: string) {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-0.13, 0],
      ArrowRight: [0.13, 0],
      ArrowUp: [0, 0.1],
      ArrowDown: [0, -0.1],
    };
    if (delta[key])
      setCamera((c) => ({
        ...c,
        yaw: c.yaw + delta[key][0],
        pitch: Math.max(-1.2, Math.min(1.2, c.pitch + delta[key][1])),
      }));
  }
  const labels = [
    {
      key: "a",
      v: { x: 1, y: 0, z: 0 },
      positive: "Redder",
      negative: "Greener",
    },
    {
      key: "l",
      v: { x: 0, y: 1, z: 0 },
      positive: "Lighter",
      negative: "Darker",
    },
    {
      key: "b",
      v: { x: 0, y: 0, z: 1 },
      positive: "Yellower",
      negative: "Bluer",
    },
  ].filter(
    (a) =>
      state.compareView === "3d" ||
      (state.comparePlane === "la"
        ? a.key !== "b"
        : state.comparePlane === "lb"
          ? a.key !== "a"
          : a.key !== "l"),
  );
  return (
    <div className="comparison comparison-explorer">
      <div className="list-title">
        <div>
          <h3>
            {state.compareView === "swatches"
              ? "Color swatches"
              : "Selected colors"}
          </h3>
        </div>
        <button
          className="text-button"
          onClick={onExport}
          disabled={!pins.length}
        >
          <Download size={14} /> Export
        </button>
      </div>
      <div className="comparison-view-row">
        <div className="view-toggle" aria-label="Comparison view">
          {(
            [
              ["3d", Box, "3D"],
              ["2d", Scan, "2D"],
              ["swatches", Grid2X2, "Swatches"],
            ] as const
          ).map(([view, Icon, label]) => (
            <button
              key={view}
              aria-label={`Comparison ${label}`}
              aria-pressed={state.compareView === view}
              className={state.compareView === view ? "active" : ""}
              onClick={() => onChange({ compareView: view })}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
        <span className="muted small">
          {pins.length} / {MAX_PALETTE_SIZE} selected
        </span>
      </div>
      <div className="comparison-add">
        <label>
          <Search size={15} />
          <input
            aria-label="Add a paint to comparison"
            placeholder="Add a paint by name or code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Clear comparison search"
              onClick={() => setQuery("")}
            >
              <X size={13} />
            </button>
          )}
        </label>
        {query.trim() && (
          <div className="comparison-suggestions">
            {suggestions.length ? (
              suggestions.map((p) => (
                <button
                  key={p.id}
                  disabled={pins.length >= MAX_PALETTE_SIZE}
                  onClick={() => {
                    onPin(p);
                    setQuery("");
                  }}
                >
                  <i style={{ background: p.hex }} />
                  <span>
                    {p.name}
                    <small>{p.id}</small>
                  </span>
                  <Plus size={15} />
                </button>
              ))
            ) : (
              <p>No other paints match this search.</p>
            )}
          </div>
        )}
      </div>
      {!pins.length ? (
        <div className="empty-state">
          <Box size={30} />
          <h3>No colors selected</h3>
          <p>Add paint colors to compare them and find similar colors.</p>
          <button onClick={() => onPin(inspected)}>Add {inspected.name}</button>
        </div>
      ) : (
        <>
          {state.compareView === "swatches" ? (
            <>
              <div className="comparison-surround-control">{surround}</div>
              <div className={"comparison-surround surround-" + state.surround}>
                {pins.map((p, i) => (
                  <div className="comparison-color" key={p.id}>
                    <div style={{ background: p.hex, color: ink(p) }}>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${p.name}`}
                        onClick={() => onPin(p)}
                      >
                        <X size={15} />
                      </button>
                      <button
                        className="compare-select"
                        onClick={() => onInspect(p)}
                      >
                        {p.name}
                        <small>{p.id}</small>
                      </button>
                    </div>
                    <div className="comparison-meta">
                      <span>LRV {p.lrv.toFixed(1)}</span>
                      <button
                        disabled={!i}
                        className="icon-button"
                        aria-label={`Move ${p.name} left`}
                        onClick={() => {
                          const ids = pins.map((p) => p.id);
                          [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                          onChange({ pins: ids });
                        }}
                      >
                        <ArrowLeft size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="comparison-space-controls">
                <label className="nearby-switch">
                  <input
                    type="checkbox"
                    checked={nearby}
                    onChange={(e) =>
                      onChange({
                        compareNearby: e.target.checked ? "on" : "off",
                      })
                    }
                  />
                  <span>Show nearby catalog colors</span>
                </label>
                {state.compareView === "2d" && (
                  <select
                    aria-label="Comparison projection"
                    value={state.comparePlane}
                    onChange={(e) =>
                      onChange({
                        comparePlane: e.target
                          .value as ViewState["comparePlane"],
                      })
                    }
                  >
                    <option value="la">Lightness × red/green</option>
                    <option value="lb">Lightness × yellow/blue</option>
                    <option value="ab">Hue plane · a × b</option>
                  </select>
                )}
              </div>
              {nearby && (
                <div className="comparison-region-controls">
                  <label>
                    Search area{" "}
                    <input
                      type="range"
                      aria-label="Comparison search area"
                      min=".002"
                      max=".06"
                      step=".001"
                      value={state.tolerance}
                      onChange={(e) =>
                        onChange({ tolerance: Number(e.target.value) }, true)
                      }
                    />
                    <span>
                      {state.tolerance < 0.01
                        ? "Tight"
                        : state.tolerance < 0.025
                          ? "Nearby"
                          : "Wider"}
                    </span>
                  </label>
                  <p>
                    {candidates.length} other swatches inside and around your
                    selection
                    {displayed.length < candidates.length
                      ? ` · plotting the closest ${displayed.length}`
                      : ""}
                    .
                  </p>
                </div>
              )}
              <div className="comparison-space" ref={plot}>
                <div className="comparison-space-key">
                  <span>
                    <i className="saved-key" /> Selected paints
                  </span>
                  {nearby && (
                    <span>
                      <i /> Nearby paints
                    </span>
                  )}
                </div>
                <svg
                  className={
                    "comparison-svg " +
                    (state.compareView === "3d" ? "orbitable" : "")
                  }
                  height={height}
                  viewBox={`0 0 ${width} ${height}`}
                  role="group"
                  tabIndex={state.compareView === "3d" ? 0 : undefined}
                  aria-label={`${state.compareView === "3d" ? "Rotatable 3D" : "2D"} comparison of ${pins.length} selected paints`}
                  onKeyDown={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      state.compareView === "3d" &&
                      e.key.startsWith("Arrow")
                    ) {
                      e.preventDefault();
                      orbit(e.key);
                    }
                  }}
                  onPointerDown={(e) => {
                    if (state.compareView === "3d" && e.button === 0) {
                      drag.current = { x: e.clientX, y: e.clientY };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }
                  }}
                  onPointerMove={(e) => {
                    if (!drag.current) return;
                    const dx = e.clientX - drag.current.x,
                      dy = e.clientY - drag.current.y;
                    setCamera((c) => ({
                      ...c,
                      yaw: c.yaw + dx * 0.008,
                      pitch: Math.max(
                        -1.2,
                        Math.min(1.2, c.pitch + dy * 0.006),
                      ),
                    }));
                    drag.current = { x: e.clientX, y: e.clientY };
                    setHover(null);
                  }}
                  onPointerUp={() => {
                    drag.current = null;
                  }}
                  onPointerCancel={() => {
                    drag.current = null;
                  }}
                >
                  <g className="neighborhood-guides" aria-hidden="true">
                    {(["xy", "xz", "yz"] as const)
                      .filter((p) => state.compareView === "3d" || p === "xy")
                      .map((plane) => (
                        <path
                          key={plane}
                          d={
                            Array.from({ length: 65 }, (_, i) => {
                              const t = (i / 64) * Math.PI * 2;
                              const drawPlane =
                                state.compareView === "2d"
                                  ? state.comparePlane === "la"
                                    ? "xy"
                                    : state.comparePlane === "lb"
                                      ? "yz"
                                      : "xz"
                                  : plane;
                              const v =
                                drawPlane === "xy"
                                  ? { x: Math.cos(t), y: Math.sin(t), z: 0 }
                                  : drawPlane === "xz"
                                    ? { x: Math.cos(t), y: 0, z: Math.sin(t) }
                                    : { x: 0, y: Math.cos(t), z: Math.sin(t) };
                              const p = project(v);
                              return `${i ? "L" : "M"}${p.x},${p.y}`;
                            }).join(" ") + "Z"
                          }
                        />
                      ))}
                    {labels.map((a) => {
                      const positive = project({
                          x: a.v.x * 1.1,
                          y: a.v.y * 1.1,
                          z: a.v.z * 1.1,
                        }),
                        negative = project({
                          x: -a.v.x * 1.1,
                          y: -a.v.y * 1.1,
                          z: -a.v.z * 1.1,
                        });
                      return (
                        <g key={a.key}>
                          <line
                            x1={positive.x}
                            y1={positive.y}
                            x2={negative.x}
                            y2={negative.y}
                          />
                          <text
                            x={Math.max(50, Math.min(width - 50, positive.x))}
                            y={Math.max(
                              60,
                              Math.min(height - 15, positive.y - 8),
                            )}
                          >
                            {a.positive}
                          </text>
                          <text
                            x={Math.max(50, Math.min(width - 50, negative.x))}
                            y={Math.max(
                              60,
                              Math.min(height - 15, negative.y + 15),
                            )}
                          >
                            {a.negative}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                  {nearby &&
                    hull.faces.map((face, i) => (
                      <polygon
                        key={i}
                        className="selection-face"
                        points={face.indices
                          .map((index) => {
                            const p = project(
                              relativePosition(
                                hull.vertices[index],
                                center,
                                radius,
                              ),
                            );
                            return `${p.x},${p.y}`;
                          })
                          .join(" ")}
                        aria-hidden="true"
                      />
                    ))}
                  {hull.edges.map(([a, b]) => {
                    const p = project(
                        relativePosition(hull.vertices[a], center, radius),
                      ),
                      q = project(
                        relativePosition(hull.vertices[b], center, radius),
                      );
                    return (
                      <line
                        key={`${a}-${b}`}
                        className="selection-edge"
                        x1={p.x}
                        y1={p.y}
                        x2={q.x}
                        y2={q.y}
                        aria-hidden="true"
                      />
                    );
                  })}
                  {points.map((p) => (
                    <g
                      key={p.paint.id}
                      role="button"
                      tabIndex={p.saved ? 0 : -1}
                      className="comparison-point"
                      aria-label={`Inspect ${p.saved ? "selected" : "nearby"} ${p.paint.name}, ${p.paint.id}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseEnter={() => setHover(p.paint.id)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(p.paint.id)}
                      onBlur={() => setHover(null)}
                      onClick={() => onInspect(p.paint)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onInspect(p.paint);
                        }
                      }}
                    >
                      <title>
                        {p.paint.name} · {p.paint.id}
                      </title>
                      <circle
                        className="point-hit-area"
                        cx={p.x}
                        cy={p.y}
                        r={p.saved ? 20 : 7}
                      />
                      <circle
                        className={
                          (p.saved
                            ? "comparison-selected-dot"
                            : "comparison-catalog-dot") +
                          (focused === p.paint.id ? " focused" : "")
                        }
                        cx={p.x}
                        cy={p.y}
                        r={
                          p.saved
                            ? focused === p.paint.id
                              ? 19
                              : 16
                            : focused === p.paint.id
                              ? 9
                              : 4.5
                        }
                        fill={p.paint.hex}
                      />
                      {p.saved && (
                        <text
                          className="point-rank"
                          x={p.x}
                          y={p.y + 3}
                          fill={ink(p.paint)}
                        >
                          {p.rank}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
                {tooltip && (
                  <div
                    className="neighbor-tooltip"
                    style={{
                      left: Math.max(
                        10,
                        Math.min(width - 220, tooltip.x - 100),
                      ),
                      top: Math.max(45, Math.min(height - 90, tooltip.y - 90)),
                    }}
                  >
                    <strong>{tooltip.paint.name}</strong>
                    <span>
                      {tooltip.paint.id} ·{" "}
                      {tooltip.saved
                        ? "Selected paint"
                        : "Nearby catalog paint"}
                    </span>
                    <small>Click to inspect</small>
                  </div>
                )}
                <div className="neighborhood-plot-footer">
                  <span>
                    {state.compareView === "3d" ? (
                      <>
                        <Move size={12} /> Drag or use arrow keys to orbit
                      </>
                    ) : (
                      "A 2D projection can hide differences on the third axis."
                    )}
                  </span>
                  <div className="neighborhood-camera">
                    <button
                      className="icon-button"
                      aria-label="Zoom out of comparison"
                      onClick={() => zoom(-0.2)}
                      disabled={camera.zoom <= 0.6}
                    >
                      <ZoomOut size={15} />
                    </button>
                    <span>{Math.round(camera.zoom * 100)}%</span>
                    <button
                      className="icon-button"
                      aria-label="Zoom in on comparison"
                      onClick={() => zoom(0.2)}
                      disabled={camera.zoom >= 3}
                    >
                      <ZoomIn size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Fit comparison to selection"
                      onClick={fit}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="comparison-inspector">
                <i style={{ background: inspected.hex }} />
                <div>
                  <strong>{inspected.name}</strong>
                  <small>
                    {inspected.id} ·{" "}
                    {selectedIds.has(inspected.id)
                      ? "In your comparison"
                      : "Not in your comparison"}
                  </small>
                </div>
                {!selectedIds.has(inspected.id) && (
                  <button
                    className="comparison-add-button"
                    disabled={pins.length >= MAX_PALETTE_SIZE}
                    onClick={() => onPin(inspected)}
                  >
                    <Plus size={14} /> Add
                  </button>
                )}
              </div>
              <p className="muted small comparison-space-note">
                Selected paints keep their positions when you inspect another
                color.{" "}
                {nearby
                  ? "The shaded region connects your selection; nearby paints can lie inside or just outside it."
                  : "Turn on nearby colors to find alternatives between and around your selection."}
              </p>
              <div
                className="comparison-pinned-list"
                aria-label="Selected comparison paints"
              >
                {pins.map((p, i) => (
                  <div
                    className={inspected.id === p.id ? "active" : ""}
                    key={p.id}
                  >
                    <button
                      className="comparison-pin-inspect"
                      onClick={() => onInspect(p)}
                    >
                      <span>{i + 1}</span>
                      <i style={{ background: p.hex }} />
                      <span>
                        {p.name}
                        <small>{p.id}</small>
                      </span>
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${p.name} from comparison`}
                      onClick={() => onPin(p)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              {nearby && (
                <div className="comparison-discover">
                  <div className="list-title">
                    <h3>
                      {pins.length === 2
                        ? "Colors between and nearby"
                        : "Nearby catalog colors"}
                    </h3>
                    <span className="muted small">
                      {candidates.length} swatches
                    </span>
                  </div>
                  {candidates.length ? (
                    <>
                      <div className="comparison-candidates">
                        {candidates
                          .slice(0, limit)
                          .map(({ paint: p, offset }) => (
                            <div
                              key={p.id}
                              className={focused === p.id ? "active" : ""}
                              onMouseEnter={() => setHover(p.id)}
                              onMouseLeave={() => setHover(null)}
                            >
                              <button
                                onClick={() => onInspect(p)}
                                aria-label={`Inspect candidate ${p.name}, ${p.id}`}
                              >
                                <i style={{ background: p.hex }} />
                                <span>
                                  {p.name}
                                  <small>
                                    {p.id} ·{" "}
                                    {offset < 1e-8
                                      ? "Within your selection"
                                      : `Near ${pins.reduce((a, b) => (distance(a, p) < distance(b, p) ? a : b)).name}`}
                                  </small>
                                </span>
                                <ArrowUpRight size={13} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Add ${p.name} to comparison`}
                                disabled={pins.length >= MAX_PALETTE_SIZE}
                                onClick={() => onPin(p)}
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          ))}
                      </div>
                      {limit < candidates.length && (
                        <button
                          className="load-more"
                          onClick={() => setLimit((n) => n + 24)}
                        >
                          Show 24 more paints
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="muted small">
                      No other swatches in this area. Try broadening the search
                      area.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
