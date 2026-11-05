import { Effect, Schedule, Schema } from "effect";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { CatalogSchema } from "../src/catalog-schema";

const base = "https://api.benjaminmoore.io/colors/colors";
// Use the current website's public client key via env. Never embed credentials in the app.
const key = process.env.BM_CATALOG_API_KEY;
if (!key) {
  console.error(
    "Set BM_CATALOG_API_KEY to the public catalog client key used by benjaminmoore.com. See README.",
  );
  process.exit(1);
}
const Page = Schema.Struct({
  resp: Schema.Literal("OK"),
  total: Schema.Int,
  start_at: Schema.Int,
  is_last: Schema.Boolean,
  colors: CatalogSchema,
});
function page(offset: number) {
  return Effect.tryPromise({
    try: async () => {
      const url = new URL(base);
      url.search = new URLSearchParams({
        version: "v1.0",
        locale: "en-us",
        offset: String(offset),
        limit: "100",
        color_response_type: "simple",
      }).toString();
      const response = await fetch(url, {
        headers: { "Ocp-Apim-Subscription-Key": key! },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        throw new Error(`Catalog page ${offset}: HTTP ${response.status}`);
      const result = Schema.decodeUnknownSync(Page)(await response.json());
      if (
        result.start_at !== offset ||
        result.colors.length !== Math.min(100, result.total - offset)
      )
        throw new Error(`Incomplete catalog page at ${offset}`);
      return result;
    },
    catch: (e) => new Error(String(e)),
  }).pipe(Effect.retry(Schedule.recurs(2)));
}
const sync = Effect.gen(function* () {
  const first = yield* page(0);
  const offsets = Array.from(
    { length: Math.ceil(first.total / 100) - 1 },
    (_, i) => (i + 1) * 100,
  );
  const rest = yield* Effect.all(offsets.map(page), { concurrency: 3 });
  if (rest.some((p) => p.total !== first.total))
    return yield* Effect.fail(
      new Error("Catalog changed during sync. Try again."),
    );
  const colors = [...first.colors, ...rest.flatMap((p) => p.colors)].sort(
    (a, b) => a.number.localeCompare(b.number, "en"),
  );
  if (
    colors.length !== first.total ||
    new Set(colors.map((p) => p.number)).size !== first.total
  )
    return yield* Effect.fail(new Error("Missing or duplicated paint codes."));
  if (
    colors.some(
      (p) =>
        p.hex.toUpperCase() !==
        [p.r, p.g, p.b]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase(),
    )
  )
    return yield* Effect.fail(new Error("RGB/hex mismatch."));
  yield* Effect.tryPromise({
    try: async () => {
      const directory = new URL("../data/benjamin-moore/", import.meta.url);
      await mkdir(directory, { recursive: true });
      const blob = JSON.stringify(colors, null, 2) + "\n";
      let previousCount = 0;
      try {
        previousCount = JSON.parse(
          await readFile(new URL("colors.json", directory), "utf8"),
        ).length;
      } catch {}
      if (previousCount && colors.length < previousCount * 0.9)
        throw new Error(
          "Catalog shrank by more than 10%. Snapshot preserved; investigate source changes.",
        );
      const metadata = {
        source: base,
        referencePage: "https://www.benjaminmoore.com/en-us/paint-colors",
        locale: "en-us",
        apiVersion: "v1.0",
        responseType: "simple",
        retrievedAt: new Date().toISOString(),
        recordCount: colors.length,
        sha256: createHash("sha256").update(blob).digest("hex"),
        notes: [
          "Manufacturer data preserved without color-space conversion.",
          "Snapshot obtained from the API used by the manufacturer website; no runtime API dependency.",
          "Completeness is relative to this API response, not every historic or regional paint color.",
        ],
      };
      await writeFile(new URL("colors.json.tmp", directory), blob);
      await writeFile(
        new URL("source.json.tmp", directory),
        JSON.stringify(metadata, null, 2) + "\n",
      );
      await rename(
        new URL("colors.json.tmp", directory),
        new URL("colors.json", directory),
      );
      await rename(
        new URL("source.json.tmp", directory),
        new URL("source.json", directory),
      );
      console.log(
        `Saved ${colors.length} colors (${colors.length - previousCount >= 0 ? "+" : ""}${colors.length - previousCount} records). Review the data diff before committing.`,
      );
    },
    catch: (e) => new Error(String(e)),
  });
});
await Effect.runPromise(sync).catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
