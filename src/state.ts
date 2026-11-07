import { Context, Effect, Layer, Schema } from "effect";
import { collectionIds, decodeCollections } from "./collections";

const CollectionsSchema = Schema.Array(Schema.Literal(...collectionIds));

export const ViewSchema = Schema.Struct({
  paint: Schema.String,
  view: Schema.Literal("map", "grid", "3d"),
  nearView: Schema.Literal("2d", "3d", "swatches"),
  nearCount: Schema.Literal("12", "24", "48"),
  nearPlane: Schema.Literal("la", "lb", "ab"),
  family: Schema.String,
  collections: CollectionsSchema,
  nearCollections: CollectionsSchema,
  compareCollections: CollectionsSchema,
  query: Schema.String,
  mode: Schema.Literal("explore", "compare"),
  compareView: Schema.Literal("3d", "2d", "swatches"),
  compareNearby: Schema.Literal("on", "off"),
  comparePlane: Schema.Literal("la", "lb", "ab"),
  pins: Schema.Array(Schema.String),
  surround: Schema.Literal("white", "gray", "black"),
  lightness: Schema.Literal("all", "light", "mid", "dark"),
  tolerance: Schema.Number.pipe(Schema.between(0.002, 0.06)),
});
export type ViewState = typeof ViewSchema.Type;
export const defaults: ViewState = {
  paint: "HC-114",
  view: "map",
  nearView: "3d",
  nearCount: "24",
  nearPlane: "la",
  family: "All colors",
  collections: [...collectionIds],
  nearCollections: [...collectionIds],
  compareCollections: [...collectionIds],
  query: "",
  mode: "explore",
  compareView: "3d",
  compareNearby: "off",
  comparePlane: "la",
  surround: "gray",
  pins: [],
  lightness: "all",
  tolerance: 0.015,
};
export function decodeLocation(hash: string): ViewState {
  try {
    const q = new URLSearchParams(hash.replace(/^#\??/, ""));
    // Keep previously shared Between links useful in the unified comparison view.
    if (q.get("mode") === "between") {
      q.set("mode", "compare");
      q.set("compareNearby", "on");
      const start = q.get("start") ?? q.get("paint") ?? "HC-114";
      const end = q.get("end") ?? "OC-17";
      if (!q.has("paint")) q.set("paint", start);
      q.set("pins", [...new Set([start, end])].join(","));
    }
    const value = {
      ...defaults,
      ...Object.fromEntries(q),
      pins: q.get("pins")?.split(",").filter(Boolean) ?? [],
      collections: decodeCollections(q.get("collections")),
      nearCollections: decodeCollections(q.get("nearCollections")),
      compareCollections: decodeCollections(q.get("compareCollections")),
      tolerance: q.has("tolerance")
        ? Number(q.get("tolerance"))
        : defaults.tolerance,
    };
    return Schema.decodeUnknownSync(ViewSchema)(value);
  } catch {
    return defaults;
  }
}
export const MAX_PALETTE_SIZE = 24;
export function encodeLocation(state: ViewState) {
  const params = new URLSearchParams();
  Object.entries(state).forEach(([k, v]) => {
    if (
      k === "collections" ||
      k === "nearCollections" ||
      k === "compareCollections"
    ) {
      const included = v as string[];
      if (!collectionIds.every((id) => included.includes(id)))
        params.set(k, included.join(","));
    } else if (k === "pins") {
      if ((v as string[]).length) params.set(k, (v as string[]).join(","));
    } else if (v !== defaults[k as keyof ViewState]) params.set(k, String(v));
  });
  return "#" + params.toString();
}
export class BrowserStore extends Context.Tag("BrowserStore")<
  BrowserStore,
  {
    read: (key: string) => Effect.Effect<string | null, Error>;
    write: (key: string, value: string) => Effect.Effect<void, Error>;
  }
>() {}
export const BrowserStoreLive = Layer.succeed(BrowserStore, {
  read: (key) =>
    Effect.try({
      try: () => localStorage.getItem(key),
      catch: (e) => new Error(String(e)),
    }),
  write: (key, value) =>
    Effect.try({
      try: () => localStorage.setItem(key, value),
      catch: (e) => new Error(String(e)),
    }),
});
export const readPreference = (key: string) =>
  Effect.runSync(
    Effect.gen(function* () {
      const store = yield* BrowserStore;
      return yield* store.read(key);
    }).pipe(
      Effect.provide(BrowserStoreLive),
      Effect.orElseSucceed(() => null),
    ),
  );
export const savePreference = (key: string, value: string) =>
  Effect.runSync(
    Effect.gen(function* () {
      const store = yield* BrowserStore;
      yield* store.write(key, value);
    }).pipe(
      Effect.provide(BrowserStoreLive),
      Effect.orElseSucceed(() => undefined),
    ),
  );
