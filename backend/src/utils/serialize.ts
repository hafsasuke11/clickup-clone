/**
 * Mongoose `toJSON` transform: renames `_id` to `id` and drops the internal
 * `__v` version key, so API responses use clean `{ id, ... }` shapes.
 */
export function docToJSON(_doc: unknown, ret: Record<string, any>) {
  ret.id = ret._id?.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
}
