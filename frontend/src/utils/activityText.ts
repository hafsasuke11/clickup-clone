import type { ActivityEntry } from './types';

export function describeActivity(entry: ActivityEntry): string {
  const meta = entry.meta;
  const target = entry.target?.fullName ?? (meta.email as string | undefined) ?? 'someone';

  switch (entry.action) {
    case 'member_invited':
      return meta.resent ? `resent an invite to ${target}` : `invited ${target}`;
    case 'member_added':
      return `added ${target}`;
    case 'invite_revoked':
      return `revoked the invite for ${target}`;
    case 'role_changed':
      return `changed ${target}'s role from ${meta.oldRole} to ${meta.newRole}`;
    case 'member_removed':
      return `removed ${target}`;
    case 'member_left':
      return `left the workspace`;
    case 'workspace_renamed':
      return `renamed the workspace from "${meta.oldName}" to "${meta.newName}"`;
    case 'ownership_transferred':
      return `transferred ownership to ${target}`;
    default:
      return entry.action;
  }
}
