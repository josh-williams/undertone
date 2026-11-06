# Undertone

A static paint exploration workbench built with TypeScript, React, Effect, and Culori. Explore 4,068 Benjamin Moore colors and move between actual paints with “Lighter,” “More muted,” and hue-step buttons.

## Run

```sh
npm install
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Deploy the generated `dist/` directory to any static host. Hash-based URLs support direct links without server rewrites. Vite uses relative asset paths, so subdirectory hosting works too. No runtime API keys, backend, or manufacturer requests are required. Optional Google Fonts have local system-font fallbacks.

## Features

- Search names, paint codes, previous names, or opaque CSS colors (hex, RGB, HSL, OKLCH, and other formats supported by Culori).
- Hue/lightness map, searchable swatch catalog, and a draggable, zoomable 3D OKLab cloud. The swatch view provides a keyboard-accessible alternative to the canvas.
- Directional steps to real catalog paints, previews of each next step, explanations, exploration undo, and browser history.
- Unified Compare with 3D, 2D, and side-by-side swatch views. Selected paints have prominent numbered markers. Optional nearby catalog colors cover the volume inside the selection and an adjustable surrounding margin; two selected paints recover the between-two workflow. Inspecting candidates preserves the palette and camera frame. Add alternatives directly or search by name/code. Legacy between URLs migrate to Compare with their endpoints preserved.
- A zoomed similar-color neighborhood centered on the selected paint, with orbitable 3D, three 2D projections, linked point/list highlighting, zoom, and 12/24/48 nearest-paint choices. Click a point or list entry to recenter. Neighborhood view, count, and projection are shareable in the URL.
- Up to 24 saved colors, comparisons, independent viewing surround, palette JSON export, and shareable URLs.
- System, light, and dark themes. Favorites and preferences are saved locally; shared URLs include the current palette, viewing surround, and view state.

## Color model

Manufacturer sRGB values are preserved in `data/benjamin-moore/colors.json`. Effect Schema validates the records before Culori derives OKLab and OKLCH coordinates. Closest matches use Euclidean distance in OKLab. Explanations compare lightness, chroma, and meaningful hue shifts; they do not claim a percentage match or physical paint equivalence.

Directional searches target a small lightness/chroma/hue change, restrict unrelated drift, and rank remaining paints by OKLab distance. These are heuristic navigation rules, not manufacturer shade ladders. No valid nearby candidate means a disabled direction. Hue navigation is disabled at very low chroma.

The map puts near-achromatic paints on a neutral rail and plots other colors by OKLCH hue and lightness. The 3D cloud uses Cartesian OKLab coordinates with a vertical lightness axis; rotation and perspective preserve the underlying positions. All points use unlit sRGB paint colors. Dense/identical points may overlap; the swatch catalog exposes each record individually. Color-family filters are approximate computed hue/chroma groups, not manufacturer classifications.

LRV comes directly from the manufacturer and is distinct from OKLCH lightness. Entered out-of-sRGB colors are matched in their original coordinates; their screen preview is clipped to sRGB. Transparent colors are rejected because paint matching needs an opaque target.

## Update the catalog

The legacy `www.benjaminmoore.com/api/colors` endpoint redirects to itself. The current website uses `https://api.benjaminmoore.io/colors/colors`. Its public browser client uses an `Ocp-Apim-Subscription-Key` header. Supply the current public catalog key through an environment variable; do not commit it or embed it in the deployed app.

```sh
BM_CATALOG_API_KEY='<current public catalog client key>' npm run sync:colors
npm test
npm run build
```

The Effect sync pipeline fetches 100-record pages with bounded concurrency and retries, validates schema, pagination, stable totals, unique codes, RGB/hex agreement, and unexpected catalog shrinkage before replacing the snapshot. Source metadata includes a timestamp and SHA-256 checksum. Review both JSON diffs before committing updates. The catalog is sorted by paint code for reviewable changes. Updating is an explicit maintenance action, never part of the build or a browser visit.

Source: [Benjamin Moore color catalog](https://www.benjaminmoore.com/en-us/paint-colors). Snapshot provenance is recorded in `data/benjamin-moore/source.json`. Catalog coverage reflects that API response, not a guarantee of every regional or historic color. A few source metadata fields may contain unexpected manufacturer content; raw values remain preserved for traceability.

## Architecture

- `src/color.ts`: catalog preparation and pure matching/navigation functions.
- `src/catalog-schema.ts`: shared Effect Schema validation.
- `src/state.ts`: validated URL state and an Effect service/layer for browser storage with graceful failure handling.
- `src/ColorAtlas.tsx`: high-DPI 2D canvas map and projected 3D cloud; no WebGL requirement.
- `src/ComparisonExplorer.tsx` and `src/selection-region.ts`: palette comparison and exact point-to-convex-hull distances. Degenerate single-point, linear, and coplanar selections are supported. Selected swatch aliases are excluded from discovery, and other duplicate digital swatches are grouped. The spatial view plots up to 400 closest matches; the paginated results expose all matches.
- `src/NeighborExplorer.tsx` and `src/neighborhood.ts`: local OKLab neighborhood UI and geometry. Coordinates are centered on the selected paint and uniformly scaled. Orthographic rotation preserves 3D distances; 2D projections can hide differences on the omitted axis. Identical colors may overlap and remain selectable in the ranked list.
- `src/App.tsx`: responsive exploration interface.
- `scripts/sync-colors.ts`: explicit build-independent catalog refresh.

Future brands can normalize to the `Paint` model; add a brand namespace to IDs before combining catalogs. Future persistence, alternate match metrics, or catalog adapters can be introduced behind the existing domain functions and Effect boundaries.

## Limitations and attribution

Independent project; not affiliated with Benjamin Moore. Color names and trademarks belong to their respective owners. No manufacturer imagery, room photography, or descriptions are bundled. Manufacturer data availability is not an explicit redistribution license; verify applicable source terms before a public release. An application-code license has intentionally not been chosen on the owner's behalf.

Digital swatches cannot predict physical paint under changing light, sheen, and substrate conditions. Always test physical samples in your space. This app does not simulate pigment mixing or derive measured spectral reflectance from RGB.
