import { Schema } from "effect";

export const PaintRecord = Schema.Struct({
  name: Schema.NonEmptyString,
  number: Schema.NonEmptyString,
  hex: Schema.String.pipe(Schema.pattern(/^[0-9A-Fa-f]{6}$/)),
  r: Schema.Int.pipe(Schema.between(0, 255)),
  g: Schema.Int.pipe(Schema.between(0, 255)),
  b: Schema.Int.pipe(Schema.between(0, 255)),
  lrv: Schema.Number.pipe(Schema.between(0, 100)),
  is_best_selling: Schema.Boolean,
  previous_name: Schema.NullOr(Schema.String),
  name_change_date: Schema.NullOr(Schema.String),
});
export const CatalogSchema = Schema.Array(PaintRecord);
