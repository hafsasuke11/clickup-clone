import { useEffect, useMemo, useState } from 'react';
import {
  Trash2, Mail, Clock, UserPlus, Search, LogOut, RotateCw, ShieldAlert, Activity,
  ChevronDown, ChevronRight, Check, ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import { describeActivity } from '@/utils/activityText';
import { PERMISSION_META, useMyMembership } from '@/utils/permissions';
import { apiErrorMessage } from '@/store/taskStore';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { Member, PermissionKey } from '@/utils/types';

type PendingConfirm =
  | { type: 'leave' }
  | { type: 'transfer'; userId: string; name: string }
  | { type: 'delete' }
  | { type: 'clearActivity' }
  | null;

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** A small on/off pill toggle. */
function Toggle({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-50 ${on ? 'bg-accent-purple' : 'bg-black/[0.12]'}`}
      aria-pressed={on}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

function MemberRow({
  member, isSelf, canEditPermissions, canRemove, busy, onRemove, onLeave, onPermissionToggle,
}: {
  member: Member;
  isSelf: boolean;
  canEditPermissions: boolean;
  canRemove: boolean;
  busy: boolean;
  onRemove: () => void;
  onLeave: () => void;
  onPermissionToggle: (key: PermissionKey, next: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const isOwner = member.role === 'owner';
  const grantedCount = PERMISSION_META.filter((p) => member.permissions[p.key]).length;

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-8 h-8 rounded-full ${colorFor(member.userId)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
          {member.user ? initialsOf(member.user.fullName) : '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-primary truncate">
            {member.user?.fullName ?? 'Unknown'}
            {isSelf && <span className="text-text-disabled"> (you)</span>}
          </p>
          <p className="text-xs text-text-secondary truncate">{member.user?.email}</p>
        </div>

        <span
          className={`text-[11px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${
            isOwner
              ? 'text-accent-purple bg-accent-purple/10 border-accent-purple/20'
              : 'text-text-secondary bg-black/[0.04] border-border'
          }`}
        >
          {isOwner ? 'Owner' : 'Member'}
        </span>

        {!isOwner && (
          <span className="text-[11px] text-text-secondary shrink-0 hidden sm:block w-24 text-right">
            {grantedCount === 0 ? 'View only' : `${grantedCount} permission${grantedCount === 1 ? '' : 's'}`}
          </span>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {!isOwner && canEditPermissions && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="p-1 text-text-secondary hover:text-text-primary hover:bg-black/[0.04] rounded transition-colors"
              title="Edit permissions"
            >
              {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          )}
          {canRemove && !isOwner && !isSelf && (
            <button
              onClick={onRemove}
              disabled={busy}
              title="Remove member"
              className="p-1 text-text-disabled hover:text-accent-red transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          )}
          {isSelf && !isOwner && (
            <button onClick={onLeave} title="Leave workspace" className="p-1 text-text-disabled hover:text-accent-red transition-colors">
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>

      {open && !isOwner && canEditPermissions && (
        <div className="px-4 pb-4 pt-1 bg-black/[0.015] space-y-1">
          <p className="text-[11px] text-text-secondary mb-1.5">
            Choose what {member.user?.fullName ?? 'this member'} is allowed to do. Everything is off by default.
          </p>
          {PERMISSION_META.map((p) => (
            <div key={p.key} className="flex items-center gap-3 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text-primary">{p.label}</p>
                <p className="text-[11px] text-text-disabled leading-snug">{p.hint}</p>
              </div>
              <Toggle
                on={member.permissions[p.key]}
                disabled={busy}
                onClick={() => onPermissionToggle(p.key, !member.permissions[p.key])}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  const { user } = useAuthStore();
  const {
    workspace, members, pendingInvites, activity,
    updateMemberPermissions, removeMember, revokeInvite, addMember,
    transferOwnership, deleteWorkspace, fetchActivity, clearActivity, fetchWorkspaces,
  } = useWorkspaceStore();
  const { setInviteModalOpen, addToast } = useUiStore();
  const me = useMyMembership();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState<PendingConfirm>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isOwnerUser = me?.role === 'owner';
  const canManageMembers = isOwnerUser || Boolean(me?.effectivePermissions.manageMembers);

  useEffect(() => {
    if (isOwnerUser) void fetchActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnerUser, workspace?.id]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.user?.fullName.toLowerCase().includes(q) || m.user?.email.toLowerCase().includes(q));
  }, [members, search]);

  const transferCandidates = members.filter((m) => m.role !== 'owner');

  const handleRemove = async (userId: string) => {
    setBusyUserId(userId);
    try {
      await removeMember(userId);
      addToast('Member removed', 'success');
    } catch (err) {
      addToast(apiErrorMessage(err, 'Failed to remove member.'), 'error');
    } finally {
      setBusyUserId(null);
    }
  };

  const handlePermissionToggle = async (userId: string, key: PermissionKey, next: boolean) => {
    setBusyUserId(userId);
    try {
      await updateMemberPermissions(userId, { [key]: next });
    } catch (err) {
      addToast(apiErrorMessage(err, 'Failed to update permissions.'), 'error');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeInvite(id);
      addToast('Invite revoked', 'info');
    } catch (err) {
      addToast(apiErrorMessage(err, 'Failed to revoke invite.'), 'error');
    }
  };

  const handleResend = async (email: string) => {
    try {
      await addMember(email);
      addToast('Invite resent', 'success');
    } catch (err) {
      addToast(apiErrorMessage(err, 'Failed to resend invite.'), 'error');
    }
  };

  const runConfirmed = async (fn: () => Promise<void>, successMsg: string) => {
    setActionLoading(true);
    try {
      await fn();
      addToast(successMsg, 'success');
      setConfirmAction(null);
    } catch (err) {
      addToast(apiErrorMessage(err, 'Something went wrong.'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 gap-3">
        <p className="text-xs text-text-secondary shrink-0">{members.length} member{members.length === 1 ? '' : 's'}</p>
        <div className="flex-1 flex justify-center max-w-xs">
          <div className="relative w-full">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-disabled" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent-purple transition-colors"
            />
          </div>
        </div>
        {canManageMembers && (
          <button onClick={() => setInviteModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-purple text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors shrink-0">
            <UserPlus size={13} /> Invite Member
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Your own access (members only) */}
        {me && !isOwnerUser && (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <ShieldCheck size={14} className="text-text-secondary" />
              <span className="text-sm font-semibold text-text-primary">Your access</span>
            </div>
            <div className="px-4 py-3 space-y-1.5">
              {PERMISSION_META.map((p) => {
                const on = me.effectivePermissions[p.key];
                return (
                  <div key={p.key} className="flex items-center gap-2 text-xs">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${on ? 'bg-accent-green/15 text-accent-green' : 'bg-black/[0.05] text-text-disabled'}`}>
                      {on ? <Check size={11} /> : '–'}
                    </span>
                    <span className={on ? 'text-text-primary' : 'text-text-disabled'}>{p.label}</span>
                  </div>
                );
              })}
              <p className="text-[11px] text-text-secondary pt-1.5">
                Need more access? Ask the workspace owner to grant it.
              </p>
            </div>
          </div>
        )}

        {/* Members + permissions */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-text-primary">Members</span>
            {isOwnerUser && <span className="text-[11px] text-text-secondary">Click a member to set permissions</span>}
          </div>
          {filteredMembers.length === 0 ? (
            <p className="text-sm text-text-secondary px-4 py-8 text-center">No members match “{search}”.</p>
          ) : (
            filteredMembers.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                isSelf={m.userId === user?.id}
                canEditPermissions={isOwnerUser}
                canRemove={canManageMembers}
                busy={busyUserId === m.userId}
                onRemove={() => void handleRemove(m.userId)}
                onLeave={() => setConfirmAction({ type: 'leave' })}
                onPermissionToggle={(key, next) => void handlePermissionToggle(m.userId, key, next)}
              />
            ))
          )}
        </div>

        {canManageMembers && pendingInvites.length > 0 && (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Clock size={14} className="text-text-secondary" />
              <span className="text-sm font-semibold text-text-primary">Pending Invites</span>
            </div>
            <div className="divide-y divide-border">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail size={13} className="text-text-disabled shrink-0" />
                    <span className="text-sm text-text-primary truncate">{inv.email}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => void handleResend(inv.email)} className="text-text-disabled hover:text-accent-purple transition-colors" title="Resend invite">
                      <RotateCw size={13} />
                    </button>
                    <button onClick={() => void handleRevoke(inv.id)} className="text-text-disabled hover:text-accent-red transition-colors" title="Revoke invite">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isOwnerUser && (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-text-secondary" />
                <span className="text-sm font-semibold text-text-primary">Activity log</span>
              </div>
              {activity.length > 0 && (
                <button
                  onClick={() => setConfirmAction({ type: 'clearActivity' })}
                  className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-accent-red transition-colors"
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
            {activity.length === 0 ? (
              <p className="text-sm text-text-secondary px-4 py-8 text-center">No activity yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <p className="text-sm text-text-primary truncate">
                      <span className="font-medium">{entry.actor?.fullName ?? 'Someone'}</span>{' '}
                      <span className="text-text-secondary">{describeActivity(entry)}</span>
                    </p>
                    <span className="text-xs text-text-disabled shrink-0">{timeAgo(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isOwnerUser && (
          <div className="bg-surface border border-accent-red/30 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-accent-red/20">
              <ShieldAlert size={14} className="text-accent-red" />
              <span className="text-sm font-semibold text-text-primary">Danger Zone</span>
            </div>
            <div className="divide-y divide-border">
              <div className="flex items-center justify-between px-4 py-3.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">Transfer ownership</p>
                  <p className="text-xs text-text-secondary">Hand this workspace to another member. You become a member with full permissions.</p>
                </div>
                {transferCandidates.length > 0 ? (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const target = transferCandidates.find((m) => m.userId === e.target.value);
                      if (target) setConfirmAction({ type: 'transfer', userId: target.userId, name: target.user?.fullName ?? 'this member' });
                      e.target.value = '';
                    }}
                    className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:border-accent-purple shrink-0"
                  >
                    <option value="" disabled>Choose a member...</option>
                    {transferCandidates.map((m) => (
                      <option key={m.userId} value={m.userId}>{m.user?.fullName ?? m.userId}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-text-disabled shrink-0">No other members</span>
                )}
              </div>
              <div className="flex items-center justify-between px-4 py-3.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">Delete workspace</p>
                  <p className="text-xs text-text-secondary">Permanently deletes this workspace and all its tasks and projects.</p>
                </div>
                <button
                  onClick={() => setConfirmAction({ type: 'delete' })}
                  className="px-3 py-1.5 bg-accent-red text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors shrink-0"
                >
                  Delete Workspace
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmAction?.type === 'leave' && (
        <ConfirmDialog
          title="Leave workspace?"
          message={`You'll lose access to ${workspace?.name ?? 'this workspace'} until someone invites you back.`}
          confirmLabel="Leave"
          danger
          loading={actionLoading}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void runConfirmed(async () => {
            if (!user) return;
            await removeMember(user.id);
            await fetchWorkspaces();
          }, 'You left the workspace')}
        />
      )}

      {confirmAction?.type === 'transfer' && (
        <ConfirmDialog
          title="Transfer ownership?"
          message={`${confirmAction.name} will become the owner of ${workspace?.name ?? 'this workspace'}. You'll become a member (keeping full permissions).`}
          confirmLabel="Transfer"
          danger
          loading={actionLoading}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void runConfirmed(() => transferOwnership(confirmAction.userId), 'Ownership transferred')}
        />
      )}

      {confirmAction?.type === 'clearActivity' && (
        <ConfirmDialog
          title="Clear activity log?"
          message="This removes every entry from this workspace's activity log. It can't be undone."
          confirmLabel="Clear"
          danger
          loading={actionLoading}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void runConfirmed(clearActivity, 'Activity cleared')}
        />
      )}

      {confirmAction?.type === 'delete' && (
        <ConfirmDialog
          title="Delete workspace?"
          message={`This permanently deletes "${workspace?.name ?? ''}" along with all its tasks, projects, and invites. This can't be undone.`}
          confirmLabel="Delete Workspace"
          danger
          requireText={workspace?.name ?? ''}
          loading={actionLoading}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void runConfirmed(deleteWorkspace, 'Workspace deleted')}
        />
      )}
    </div>
  );
}
