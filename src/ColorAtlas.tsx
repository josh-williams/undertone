import { useEffect, useRef, useState } from "react";
import { RotateCcw, Move, MousePointer2 } from "lucide-react";
import { type Paint } from "./color";

type Point = { paint: Paint; x: number; y: number; z: number; r: number };
export function ColorAtlas({
  paints,
  selected,
  end,
  focus,
  is3d,
  onSelect,
}: {
  paints: Paint[];
  selected: Paint;
  end?: Paint;
  focus?: Paint;
  is3d: boolean;
  onSelect: (p: Paint) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 470 });
  const [rotation, setRotation] = useState({
    yaw: -0.55,
    pitch: 0.16,
    zoom: 1,
  });
  const [hover, setHover] = useState<Point | null>(null);
  const points = useRef<Point[]>([]);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  useEffect(() => {
    const el = canvas.current!;
    const observer = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const { w, h } = size,
      dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = w * dpr;
    el.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const dark = document.documentElement.dataset.theme === "dark";
    const line = dark ? "#41433f" : "#dcded6",
      text = dark ? "#a0a59a" : "#858a80";
    function project(p: Paint): Point {
      if (!is3d)
        return {
          paint: p,
          x: 54 + (p.c < 0.018 ? 0 : 0.06 + (0.94 * p.h) / 360) * (w - 87),
          y: 35 + (1 - p.l) * (h - 77),
          z: 0,
          r: p.c < 0.018 ? 4.1 : 3.6,
        };
      const x = p.a * 2.8,
        y = (p.l - 0.57) * 1.8,
        z = p.b * 2.8;
      const rx = x * Math.cos(rotation.yaw) + z * Math.sin(rotation.yaw),
        rz = -x * Math.sin(rotation.yaw) + z * Math.cos(rotation.yaw);
      const ry = y * Math.cos(rotation.pitch) - rz * Math.sin(rotation.pitch),
        depth = y * Math.sin(rotation.pitch) + rz * Math.cos(rotation.pitch);
      const scale =
        (Math.min(w * 0.95, h * 0.93) * rotation.zoom) / (1.8 - depth * 0.35);
      return {
        paint: p,
        x: w / 2 + rx * scale,
        y: h / 2 - ry * scale,
        z: depth,
        r: 3.2 + depth * 0.9,
      };
    }
    ctx.font = "10px system-ui";
    ctx.fillStyle = text;
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    if (!is3d) {
      for (const l of [0.2, 0.4, 0.6, 0.8]) {
        const y = 35 + (1 - l) * (h - 77);
        ctx.beginPath();
        ctx.moveTo(43, y);
        ctx.lineTo(w - 20, y);
        ctx.stroke();
        ctx.fillText(`${Math.round(l * 100)}`, 15, y + 3);
      }
      ctx.save();
      ctx.translate(13, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText("LIGHTNESS", 0, 0);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.ellipse(
        w / 2,
        h * 0.76,
        w * 0.27 * rotation.zoom,
        h * 0.065 * rotation.zoom,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.15);
      ctx.lineTo(w / 2, h * 0.8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText("LIGHTER", w / 2 + 10, h * 0.14);
      ctx.fillText("DARKER", w / 2 + 10, h * 0.85);
    }
    const all = paints.map(project).sort((a, b) => a.z - b.z);
    points.current = all;
    all.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.8, p.r), 0, Math.PI * 2);
      ctx.fillStyle = p.paint.hex;
      ctx.fill();
    });
    if (end) {
      const a = project(selected),
        b = project(end);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = dark ? "#fff" : "#30382d";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    [end, selected, focus].filter(Boolean).forEach((p) => {
      const pt = project(p!);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = p!.hex;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = dark ? "white" : "#263529";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = dark ? "#20251f" : "#fff";
      ctx.stroke();
    });
  }, [
    paints,
    selected,
    end,
    focus,
    is3d,
    size,
    rotation,
    document.documentElement.dataset.theme,
  ]);
  function hit(x: number, y: number) {
    return (
      [...points.current]
        .reverse()
        .filter((p) => Math.hypot(p.x - x, p.y - y) < Math.max(p.r + 3, 8))
        .sort(
          (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
        )[0] ?? null
    );
  }
  return (
    <div className={"atlas " + (is3d ? "space" : "")}>
      <div className="atlas-caption">
        <span className="live-dot" />
        {is3d
          ? "A new perspective on color"
          : "Every dot is a real paint color"}
      </div>
      <canvas
        ref={canvas}
        aria-label={
          is3d
            ? "Rotatable OKLab color cloud. Drag to rotate; arrow keys rotate. Use Swatches for a text-accessible catalog."
            : "Color map by hue and lightness. Select a dot, or use Swatches for a text-accessible catalog."
        }
        tabIndex={0}
        onKeyDown={(e) => {
          if (
            is3d &&
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
          ) {
            e.preventDefault();
            setRotation((r) => ({
              ...r,
              yaw:
                r.yaw +
                (e.key === "ArrowLeft"
                  ? -0.15
                  : e.key === "ArrowRight"
                    ? 0.15
                    : 0),
              pitch: Math.max(
                -1,
                Math.min(
                  1,
                  r.pitch +
                    (e.key === "ArrowUp"
                      ? 0.1
                      : e.key === "ArrowDown"
                        ? -0.1
                        : 0),
                ),
              ),
            }));
          }
        }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (drag.current && is3d) {
            const dx = e.clientX - drag.current.x,
              dy = e.clientY - drag.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) {
              drag.current.moved = true;
              setRotation((r) => ({
                ...r,
                yaw: r.yaw + dx * 0.008,
                pitch: Math.max(-1, Math.min(1, r.pitch + dy * 0.006)),
              }));
              drag.current.x = e.clientX;
              drag.current.y = e.clientY;
              setHover(null);
            }
          } else setHover(hit(e.clientX - rect.left, e.clientY - rect.top));
        }}
        onPointerUp={(e) => {
          if (!drag.current?.moved) {
            const rect = e.currentTarget.getBoundingClientRect(),
              p = hit(e.clientX - rect.left, e.clientY - rect.top);
            if (p) onSelect(p.paint);
          }
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onPointerLeave={() => setHover(null)}
      />
      {hover && (
        <div
          className="atlas-tooltip"
          style={{
            left: Math.max(8, Math.min(hover.x, size.w - 190)),
            top: Math.max(30, hover.y - 65),
          }}
        >
          <i style={{ background: hover.paint.hex }} />
          <span>
            {hover.paint.name}
            <small>{hover.paint.id}</small>
          </span>
        </div>
      )}
      <div className="atlas-help">
        {is3d ? (
          <>
            <Move size={13} /> Drag to orbit{" "}
            <label>
              Zoom{" "}
              <input
                aria-label="3D zoom"
                type="range"
                min=".65"
                max="1.8"
                step=".05"
                value={rotation.zoom}
                onChange={(e) =>
                  setRotation((r) => ({ ...r, zoom: Number(e.target.value) }))
                }
              />
            </label>
            <button
              className="icon-button"
              aria-label="Reset 3D view"
              onClick={() => setRotation({ yaw: -0.55, pitch: 0.16, zoom: 1 })}
            >
              <RotateCcw size={14} />
            </button>
          </>
        ) : (
          <>
            <MousePointer2 size={13} /> Hover to discover · click to explore
          </>
        )}
      </div>
    </div>
  );
}
