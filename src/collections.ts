// Code groups follow Benjamin Moore's published collection numbering.
// PM and ES remain separately selectable without assigning unverified names.
export const collections = [
  { id: "classics", name: "Benjamin Moore Classics", codes: "001–1680" },
  { id: "color-preview", name: "Color Preview", codes: "2000-10–2175-70" },
  { id: "designer-classics", name: "Designer Classics", codes: "CC" },
  { id: "historical", name: "Historical", codes: "HC" },
  { id: "affinity", name: "Affinity", codes: "AF" },
  { id: "off-white", name: "Off White", codes: "OC" },
  { id: "color-stories", name: "Color Stories", codes: "CSP" },
  { id: "williamsburg", name: "Williamsburg", codes: "CW" },
  { id: "pm", name: "PM colors", codes: "PM" },
  { id: "es", name: "ES colors", codes: "ES" },
] as const;
export type CollectionId = (typeof collections)[number]["id"];
export const collectionIds = collections.map((c) => c.id);
const prefixes: Record<string, CollectionId> = {
  CC: "designer-classics",
  HC: "historical",
  AF: "affinity",
  OC: "off-white",
  CSP: "color-stories",
  CW: "williamsburg",
  PM: "pm",
  ES: "es",
};
export function collectionForCode(code: string): CollectionId | undefined {
  if (/^\d+$/.test(code) && Number(code) >= 1 && Number(code) <= 1680)
    return "classics";
  if (/^2\d{3}-(10|20|30|40|50|60|70)$/.test(code)) {
    const series = Number(code.split("-")[0]);
    if (series >= 2000 && series <= 2175) return "color-preview";
  }
  return prefixes[code.split("-")[0]];
}
export function filterCollections<T extends { id: string }>(
  catalog: readonly T[],
  included: readonly CollectionId[],
): T[] {
  const ids = new Set(included);
  return catalog.filter((p) => {
    const collection = collectionForCode(p.id);
    return collection !== undefined && ids.has(collection);
  });
}
export function decodeCollections(value: string | null): CollectionId[] {
  if (value === null) return [...collectionIds];
  const requested = new Set(value.split(","));
  return collectionIds.filter((id) => requested.has(id));
}
