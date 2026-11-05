import { Context, Effect, Layer, Schema } from "effect";

export const ViewSchema = Schema.Struct({
  paint: Schema.String,
  view: Schema.Literal("map", "grid", "3d"),
  family: Schema.String,
  query: Schema.String,
  mode: Schema.Literal("explore", "between", "compare"),
  start: Schema.String,
  end: Schema.String,
  pins: Schema.Array(Schema.String),
  surround: Schema.Literal("white", "gray", "black"),
  lightness: Schema.Literal("all", "light", "mid", "dark"),
  tolerance: Schema.Number.pipe(Schema.between(0.002, 0.06)),
});
export type ViewState = typeof ViewSchema.Type;
export const defaults: ViewState = {
  paint: "HC-114",
  view: "map",
  family: "All colors",
  query: "",
  mode: "explore",
  start: "HC-114",
  end: "OC-17",
  surround: "gray",
  pins: [],
  lightness: "all",
  tolerance: 0.015,
};
export function decodeLocation(hash: string): ViewState {
  try {
    const q = new URLSearchParams(hash.replace(/^#\??/, ""));
    const value = {
      ...defaults,
      ...Object.fromEntries(q),
      pins: q.get("pins")?.split(",").filter(Boolean) ?? [],
      tolerance: q.has("tolerance")
        ? Number(q.get("tolerance"))
        : defaults.tolerance,
    };
    return Schema.decodeUnknownSync(ViewSchema)(value);
  } catch {
    return defaults;
  }
}
export function encodeLocation(state: ViewState) {
  const params = new URLSearchParams();
  Object.entries(state).forEach(([k, v]) => {
    if (k === "pins") {
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
