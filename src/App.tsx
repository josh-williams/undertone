import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  Grid2X2,
  Heart,
  Map,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  X,
  Box,
  Undo2,
} from "lucide-react";
import {
  paints,
  byId,
  nearest,
  inputColor,
  directional,
  directionLabels,
  explain,
  families,
  inFamily,
  ink,
  type Paint,
  type Direction,
} from "./color";
import {
  decodeLocation,
  encodeLocation,
  defaults,
  readPreference,
  savePreference,
  type ViewState,
  MAX_PALETTE_SIZE,
} from "./state";
import { ColorAtlas } from "./ColorAtlas";
import { NeighborExplorer } from "./NeighborExplorer";
import { ComparisonExplorer } from "./ComparisonExplorer";
import { CollectionFilter } from "./CollectionFilter";
import { filterCollections } from "./collections";

function storedPins(): string[] {
  try {
    const p = JSON.parse(readPreference("undertone-pins") ?? "[]");
    return Array.isArray(p)
      ? p
          .filter((x): x is string => typeof x === "string" && byId.has(x))
          .slice(0, MAX_PALETTE_SIZE)
      : [];
  } catch {
    return [];
  }
}
function initialState() {
  const state = decodeLocation(location.hash);
  const params = new URLSearchParams(location.hash.slice(1));
  const savedSurround = readPreference("undertone-surround");
  return {
    ...state,
    surround: params.has("surround")
      ? state.surround
      : ["white", "gray", "black"].includes(savedSurround ?? "")
        ? (savedSurround as ViewState["surround"])
        : "gray",
    paint: byId.has(state.paint) ? state.paint : defaults.paint,
    pins: (params.has("pins") || params.get("mode") === "between"
      ? state.pins
      : storedPins()
    )
      .filter((id) => byId.has(id))
      .slice(0, MAX_PALETTE_SIZE),
  };
}
const icons = {
  lighter: ArrowUp,
  darker: ArrowDown,
  muted: Moon,
  colorful: Sun,
  clockwise: ArrowRight,
  counterclockwise: ArrowLeft,
};
const featured = ["HC-114", "HC-172", "OC-17", "HC-154", "AF-15", "HC-173"];
export function App() {
  const [state, setState] = useState<ViewState>(initialState);
  const [theme, setTheme] = useState(
    () => readPreference("undertone-theme") ?? "system",
  );
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const surround = state.surround;
  const setSurround = (surround: string) =>
    update({ surround: surround as ViewState["surround"] });
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [step, setStep] = useState<{
    from: Paint;
    direction: Direction;
  } | null>(null);
  const [visibleCount, setVisibleCount] = useState(80);
  const [queryDraft, setQueryDraft] = useState(state.query);
  const selected = byId.get(state.paint) ?? byId.get(defaults.paint)!;
  const dark = theme === "dark" || (theme === "system" && systemDark);
  // Apply synchronously so canvas and browser UI use the same theme on this render.
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const pins = state.pins
    .map((id) => byId.get(id))
    .filter((p): p is Paint => !!p);
  function update(patch: Partial<ViewState>, replace = false) {
    setState((s) => {
      const next = { ...s, ...patch };
      window.history[replace ? "replaceState" : "pushState"](
        null,
        "",
        encodeLocation(next),
      );
      return next;
    });
  }
  useEffect(() => {
    window.history.replaceState(null, "", encodeLocation(state));
    const pop = () => {
      const next = decodeLocation(location.hash);
      setState(next);
      setQueryDraft(next.query);
      setStep(null);
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("hashchange", pop);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("hashchange", pop);
    };
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const changed = () => setSystemDark(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    savePreference("undertone-pins", JSON.stringify(state.pins));
  }, [state.pins]);
  useEffect(() => {
    savePreference("undertone-theme", theme);
  }, [theme]);
  useEffect(() => {
    savePreference("undertone-surround", surround);
  }, [surround]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 3500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(() => {
    setVisibleCount(80);
  }, [
    state.query,
    state.family,
    state.lightness,
    state.mode,
    state.tolerance,
    state.collections,
  ]);
  function select(p: Paint) {
    if (p.id === selected.id) return;
    setHistory((h) => [...h.slice(-19), selected.id]);
    setStep(null);
    update({ paint: p.id });
  }
  function pin(p: Paint) {
    if (state.pins.includes(p.id))
      update({ pins: state.pins.filter((id) => id !== p.id) });
    else if (pins.length < MAX_PALETTE_SIZE)
      update({ pins: [...state.pins, p.id] });
    else
      setNotice(`Your comparison tray holds up to ${MAX_PALETTE_SIZE} colors.`);
  }
  async function copy(text: string, label = "Copied to clipboard") {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(label);
    } catch {
      setNotice("Clipboard unavailable.");
    }
  }
  const target = useMemo(() => inputColor(state.query), [state.query]);
  const catalog = useMemo(
    () => filterCollections(paints, state.collections),
    [state.collections],
  );
  const similarCatalog = useMemo(
    () => filterCollections(paints, state.nearCollections),
    [state.nearCollections],
  );
  const invalidColor =
    !!state.query &&
    !target &&
    /^(#|(?:oklch|oklab|rgb|hsl|color|lab|lch)\()/i.test(state.query.trim());
  const filtered = useMemo(
    () =>
      catalog.filter(
        (p) =>
          inFamily(p, state.family) &&
          (state.lightness === "all" ||
            (state.lightness === "light"
              ? p.l >= 0.8
              : state.lightness === "dark"
                ? p.l < 0.5
                : p.l >= 0.5 && p.l < 0.8)) &&
          (target ||
            !state.query ||
            `${p.name} ${p.id} ${p.previousName ?? ""}`
              .toLowerCase()
              .includes(state.query.toLowerCase())),
      ),
    [catalog, state.family, state.lightness, state.query, target],
  );
  const results = useMemo(
    () =>
      target
        ? nearest(target, filtered, 24)
        : [...filtered].sort((a, b) => a.h - b.h || b.l - a.l),
    [filtered, target],
  );
  const neighbors = useMemo(
    () =>
      nearest(
        selected,
        similarCatalog.filter((p) => p.id !== selected.id),
        Number(state.nearCount),
      ),
    [selected, state.nearCount, similarCatalog],
  );
  const steps = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(directionLabels) as Direction[]).map((d) => [
          d,
          directional(selected, d, similarCatalog),
        ]),
      ) as Record<Direction, Paint[]>,
    [selected, similarCatalog],
  );
  function takeStep(direction: Direction) {
    const p = steps[direction][0];
    if (!p) return;
    setHistory((h) => [...h.slice(-19), selected.id]);
    setStep({ from: selected, direction });
    update({ paint: p.id });
  }
  function undo() {
    const id = history.at(-1);
    if (id) {
      setHistory((h) => h.slice(0, -1));
      setStep(null);
      update({ paint: id });
    }
  }
  function exportPalette() {
    const data = {
      title: "My Undertone palette",
      brand: "Benjamin Moore",
      colors: pins.map((p) => ({
        name: p.name,
        code: p.id,
        hex: p.hex,
        oklch: { l: p.l, c: p.c, h: p.h },
        lrv: p.lrv,
      })),
      url: location.href,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "undertone-palette.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const cards = (list: Paint[], reference?: Paint | typeof target) =>
    list.map((p) => (
      <button
        key={p.id}
        className={"paint-card " + (p.id === selected.id ? "selected" : "")}
        onClick={() => select(p)}
        aria-label={`${p.name}, ${p.id}. ${reference ? explain(reference, p) : "Explore color"}`}
      >
        <span
          className="card-color"
          style={{ background: p.hex, color: ink(p) }}
        >
          {p.id === selected.id && <Check size={17} />}
          <span>{p.id}</span>
        </span>
        <span className="card-name">{p.name}</span>
        {reference && (
          <span className="card-explanation">{explain(reference, p)}</span>
        )}
      </button>
    ));
  return (
    <>
      <a
        className="skip-link"
        href="#workspace"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("workspace")?.focus();
          document.getElementById("workspace")?.scrollIntoView();
        }}
      >
        Skip to colors
      </a>
      <header className="site-header">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            update({ ...defaults, pins: state.pins });
            setQueryDraft("");
          }}
        >
          <span className="brand-symbol">
            <i />
            <i />
            <i />
          </span>
          undertone<span className="brand-period">.</span>
        </a>
        <p className="header-description">
          Search, compare, and find similar Benjamin Moore paint colors.
        </p>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label={`Theme: ${theme}. Switch to ${theme === "light" ? "dark" : theme === "dark" ? "system" : "light"}`}
            title={`Theme: ${theme}`}
            onClick={() =>
              setTheme(
                theme === "light"
                  ? "dark"
                  : theme === "dark"
                    ? "system"
                    : "light",
              )
            }
          >
            {dark ? <Moon size={19} /> : <Sun size={19} />}
          </button>
        </div>
      </header>
      <main>
        <div className="workspace" id="workspace" tabIndex={-1}>
          <section className="explorer" aria-label="Color catalog">
            <div className="explorer-top">
              <div className="section-heading">
                <h1>
                  {state.mode === "compare"
                    ? "Compare colors"
                    : "Color catalog"}
                </h1>
              </div>
              <span className="brand-badge">
                Benjamin Moore <span>↗</span>
              </span>
            </div>
            {state.mode === "explore" && (
              <form
                className="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  update({ query: queryDraft });
                }}
              >
                <Search size={19} />
                <input
                  aria-label="Search paint names, codes, or CSS colors"
                  placeholder="Search a name, paint code, hex, or oklch…"
                  value={queryDraft}
                  onChange={(e) => {
                    setQueryDraft(e.target.value);
                    update({ query: e.target.value, mode: "explore" }, true);
                  }}
                />
                {queryDraft && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Clear search"
                    onClick={() => {
                      setQueryDraft("");
                      update({ query: "" });
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
                <kbd>↵</kbd>
              </form>
            )}
            <div className="workspace-toolbar">
              <div className="modes">
                {(["explore", "compare"] as const).map((m) => (
                  <button
                    key={m}
                    className={state.mode === m ? "active" : ""}
                    onClick={() => update({ mode: m })}
                  >
                    {m === "explore" ? "Explore" : "Compare"}
                    {m === "compare" && pins.length > 0 && (
                      <span>{pins.length}</span>
                    )}
                  </button>
                ))}
              </div>
              {state.mode !== "compare" && (
                <div className="view-toggle" aria-label="Catalog view">
                  {(
                    [
                      ["map", Map, "Map"],
                      ["grid", Grid2X2, "Swatches"],
                      ["3d", Box, "3D"],
                    ] as const
                  ).map(([view, Icon, label]) => (
                    <button
                      key={view}
                      aria-pressed={state.view === view}
                      className={state.view === view ? "active" : ""}
                      onClick={() => update({ view })}
                    >
                      <Icon size={15} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {state.mode === "explore" && (
              <>
                <div className="filters">
                  <SlidersHorizontal size={14} />
                  <select
                    aria-label="Color family"
                    value={state.family}
                    onChange={(e) => update({ family: e.target.value })}
                  >
                    {families.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                  <span className="filter-divider" />
                  <select
                    aria-label="Lightness filter"
                    value={state.lightness}
                    onChange={(e) =>
                      update({
                        lightness: e.target.value as ViewState["lightness"],
                      })
                    }
                  >
                    <option value="all">Any lightness</option>
                    <option value="light">Light</option>
                    <option value="mid">Mid-tone</option>
                    <option value="dark">Dark</option>
                  </select>
                  <span className="result-count">
                    {results.length.toLocaleString()}{" "}
                    {target ? "closest matches" : "colors"}
                  </span>
                  <CollectionFilter
                    label="Catalog collections"
                    value={state.collections}
                    onChange={(collections) => update({ collections })}
                  />
                </div>
                {target && (
                  <div className="match-banner">
                    <i style={{ background: target.hex }} />
                    <div>
                      Matching <strong>{state.query}</strong>
                      <small>
                        {target.outOfGamut
                          ? "Target is outside sRGB; preview is clipped. Matching uses the original color."
                          : "Closest digital colors, ranked by OKLab distance."}
                      </small>
                    </div>
                  </div>
                )}
                {invalidColor && (
                  <div className="empty-state compact">
                    That color could not be read. Try #a8b49c or oklch(70% 0.05
                    140). Use an opaque color.
                  </div>
                )}
                {!invalidColor &&
                  (results.length ? (
                    state.view === "grid" ? (
                      <div className="catalog-grid">
                        {cards(results.slice(0, visibleCount), target)}
                      </div>
                    ) : (
                      <ColorAtlas
                        paints={results}
                        selected={selected}
                        is3d={state.view === "3d"}
                        onSelect={select}
                      />
                    )
                  ) : (
                    <div className="empty-state">
                      <Search size={28} />
                      <h3>No colors found</h3>
                      <p>Try a different name or clear your filters.</p>
                      <button
                        onClick={() => {
                          setQueryDraft("");
                          update({
                            query: "",
                            family: "All colors",
                            lightness: "all",
                            collections: defaults.collections,
                          });
                        }}
                      >
                        Reset search
                      </button>
                    </div>
                  ))}
                {state.view === "grid" && visibleCount < results.length && (
                  <button
                    className="load-more"
                    onClick={() => setVisibleCount((n) => n + 80)}
                  >
                    Show 80 more colors <ChevronRight size={14} />
                  </button>
                )}
                {state.view !== "grid" && results.length > 0 && (
                  <div className="map-footer">
                    <div className="mini-picks">
                      {(target ||
                      state.collections.length !== defaults.collections.length
                        ? results.slice(0, 6)
                        : featured.map((id) => byId.get(id)!)
                      ).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => select(p)}
                          title={p.name}
                        >
                          <i style={{ background: p.hex }} />
                          <span>{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {state.mode === "compare" && (
              <ComparisonExplorer
                pins={pins}
                inspected={selected}
                state={state}
                onChange={update}
                onInspect={select}
                onPin={pin}
                onExport={exportPalette}
                surround={<Surround value={surround} onChange={setSurround} />}
              />
            )}
          </section>
          <aside className="detail-panel" aria-label="Selected paint">
            <div className={"hero-surround surround-" + surround}>
              <div
                className="hero-swatch"
                style={{ background: selected.hex, color: ink(selected) }}
              >
                <button
                  className="swatch-copy"
                  onClick={() => copy(selected.hex)}
                  aria-label="Copy hex color"
                >
                  <Copy size={15} />
                </button>
                <span className="swatch-code">{selected.id}</span>
              </div>
            </div>
            <div className="detail-content">
              <div className="detail-title">
                <div>
                  <h2>{selected.name}</h2>
                </div>
                <button
                  className={
                    "save-color " +
                    (state.pins.includes(selected.id) ? "saved" : "")
                  }
                  aria-label={`${state.pins.includes(selected.id) ? "Unsave" : "Save"} ${selected.name}`}
                  aria-pressed={state.pins.includes(selected.id)}
                  onClick={() => pin(selected)}
                >
                  <Heart
                    size={20}
                    fill={
                      state.pins.includes(selected.id) ? "currentColor" : "none"
                    }
                  />
                </button>
              </div>
              <div className="color-values">
                <button onClick={() => copy(selected.hex)}>
                  {selected.hex} <Copy size={12} />
                </button>
                <span>
                  LRV <strong>{selected.lrv.toFixed(1)}</strong>
                </span>
              </div>
              <button
                className="oklch-value"
                onClick={() =>
                  copy(
                    `oklch(${(selected.l * 100).toFixed(2)}% ${selected.c.toFixed(4)} ${selected.h.toFixed(2)})`,
                  )
                }
              >
                oklch({(selected.l * 100).toFixed(1)}% {selected.c.toFixed(3)}{" "}
                {selected.h.toFixed(1)}) <Copy size={11} />
              </button>
              <div className="section-rule" />
              <div className="direction-heading">
                <h3>Find similar colors</h3>
                {history.length > 0 && (
                  <button onClick={undo} className="text-button">
                    <Undo2 size={13} /> Back
                  </button>
                )}
              </div>
              <div className="direction-grid">
                {(Object.keys(directionLabels) as Direction[]).map((d) => {
                  const Icon = icons[d],
                    p = steps[d][0];
                  return (
                    <button
                      key={d}
                      onClick={() => takeStep(d)}
                      disabled={!p}
                      title={
                        p
                          ? `${p.name} · ${explain(selected, p)}`
                          : "No nearby paint in this direction"
                      }
                    >
                      <Icon size={16} />
                      <span>{directionLabels[d]}</span>
                      {p ? (
                        <i style={{ background: p.hex }} />
                      ) : (
                        <span className="no-step">—</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {step && (
                <div className="step-note" role="status">
                  <span>
                    {directionLabels[step.direction]} from{" "}
                    <button onClick={() => select(step.from)}>
                      {step.from.name}
                    </button>
                  </span>
                  <strong>{explain(step.from, selected)}</strong>
                </div>
              )}
              <div className="section-rule" />
              <Surround value={surround} onChange={setSurround} />
              <a
                className="manufacturer-link"
                href={`https://www.benjaminmoore.com/en-us/paint-colors/color/${selected.id.toLowerCase()}/${selected.name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/-$/, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                View at Benjamin Moore <span>↗</span>
              </a>
            </div>
          </aside>
        </div>
        <NeighborExplorer
          selected={selected}
          neighbors={neighbors}
          view={state.nearView}
          count={state.nearCount}
          plane={state.nearPlane}
          collections={state.nearCollections}
          onChange={update}
          onSelect={select}
          swatches={
            <div className="neighbor-grid">{cards(neighbors, selected)}</div>
          }
        />
        {pins.length > 0 && (
          <section className="saved-tray">
            <div>
              <Heart size={16} />
              <strong>Saved colors</strong>
              <span>
                {pins.length}/{MAX_PALETTE_SIZE}
              </span>
            </div>
            <div className="tray-colors">
              {pins.map((p) => (
                <button
                  key={p.id}
                  title={p.name}
                  aria-label={`Select saved ${p.name}`}
                  style={{ background: p.hex, color: ink(p) }}
                  onClick={() => select(p)}
                >
                  {p.id}
                </button>
              ))}
            </div>
            <button
              className="text-button"
              onClick={() => {
                update({ mode: "compare" });
                document
                  .getElementById("workspace")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Compare <ArrowRight size={15} />
            </button>
          </section>
        )}
        <footer>
          <span className="footer-brand">undertone.</span>
          <p>
            Screen colors may differ from paint. Check physical samples before
            choosing.
          </p>
        </footer>
      </main>
      <div className="toast" role="status" aria-live="polite">
        {notice && (
          <span>
            <Check size={16} />
            {notice}
          </span>
        )}
      </div>
    </>
  );
}
function Surround({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="surround-control">
      <span>Viewing surround</span>
      <div>
        {["white", "gray", "black"].map((s) => (
          <button
            key={s}
            aria-label={`${s} viewing surround`}
            aria-pressed={value === s}
            className={"surround-option " + s + (s === value ? " active" : "")}
            onClick={() => onChange(s)}
          >
            {s === value && <Check size={11} />}
          </button>
        ))}
      </div>
    </div>
  );
}
