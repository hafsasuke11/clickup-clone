export const AVATAR_COLORS = ['bg-accent-purple', 'bg-accent-blue', 'bg-accent-green', 'bg-accent-pink', 'bg-accent-amber', 'bg-accent-cyan'];

export function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
