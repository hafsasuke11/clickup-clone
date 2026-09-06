export function idTransform(_doc: unknown, ret: Record<string, any>) {
  ret.id = ret._id?.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
}
