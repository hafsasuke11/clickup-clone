/**
 * A compact list of page numbers for a pager, collapsing long runs to a gap:
 * `pageList(5, 20)` → `[1, 'gap', 4, 5, 6, 'gap', 20]`.
 * Seven or fewer pages are always shown in full.
 */
export function pageList(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push('gap');
  for (let i = start; i <= end; i += 1) out.push(i);
  if (end < total - 1) out.push('gap');
  out.push(total);
  return out;
}
