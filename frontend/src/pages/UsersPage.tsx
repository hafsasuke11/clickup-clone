import { useEffect, useMemo, useState } from 'react';
import { Trash2, Mail, Clock, UserPlus, Search, LogOut, RotateCw, ShieldAlert, Activity } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';
import { initialsOf, colorFor } from '@/utils/avatarHelpers';
import { describeActivity } from '@/utils/activityText';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { WorkspaceRole } from '@/utils/types';

const ROLE_LABELS: Record<WorkspaceRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };

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

export default function UsersPage() {
  const { user } = useAuthStore();
  const {
    workspace, members, pendingInvites, activity,
    updateMemberRole, removeMember, revokeInvite, addMember,
    transferOwnership, deleteWorkspace, fetchActivity, clearActivity, fetchWorkspaces,
  } = useWorkspaceStore();
  const { setInviteModalOpen, addToast } = useUiStore();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState<PendingConfirm>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const myRole = members.find((m) => m.userId === user?.id)?.role ?? 'member';
  const canManage = myRole === 'owner' || myRole === 'admin';
  const canChangeRoles = myRole === 'owner';
  const isOwnerUser = myRole === 'owner';

  useEffect(() => {
    if (canManage) void fetchActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, workspace?.id]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.user?.fullName.toLowerCase().includes(q) || m.user?.email.toLowerCase().includes(q));
  }, [members, search]);

  const transferCandidates = members.filter((m) => m.role !== 'owner');

  const handleRoleChange = async (userId: string, role: 'admin' | 'member') => {
    setBusyUserId(userId);
    try {
      await updateMemberRole(userId, role);
      addToast('Role updated', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update role.', 'error');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRemove = async (userId: string) => {
    setBusyUserId(userId);
    try {
      await removeMember(userId);
      addToast('Member removed', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to remove member.', 'error');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeInvite(id);
      addToast('Invite revoked', 'info');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to revoke invite.', 'error');
    }
  };

  const handleResend = async (email: string, role: WorkspaceRole) => {
    try {
      await addMember(email, role === 'admin' ? 'admin' : 'member');
      addToast('Invite resent', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to resend invite.', 'error');
    }
  };

  const runConfirmed = async (fn: () => Promise<void>, successMsg: string) => {
    setActionLoading(true);
    try {
      await fn();
      addToast(successMsg, 'success');
      setConfirmAction(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Something went wrong.', 'error');
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
        {canManage && (
          <button onClick={() => setInviteModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-purple text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors shrink-0">
            <UserPlus size={13} /> Invite Member
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 max-w-4xl mx-auto w-full">
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs text-text-secondary font-semibold uppercase tracking-wider border-b border-border">
            <div className="col-span-5">Name</div>
            <div className="col-span-3">Role</div>
            <div className="col-span-3">Joined</div>
            <div className="col-span-1" />
          </div>
          {filteredMembers.length === 0 ? (
            <p className="text-sm text-text-secondary px-4 py-8 text-center">No members match "{search}".</p>
          ) : filteredMembers.map((m) => {
            const isOwner = m.role === 'owner';
            const isSelf = m.userId === user?.id;
            return (
              <div key={m.userId} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border last:border-0 items-center">
                <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-full ${colorFor(m.userId)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                    {m.user ? initialsOf(m.user.fullName) : '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">
                      {m.user?.fullName ?? 'Unknown'}
                      {isSelf && <span className="text-text-disabled"> (you)</span>}
                    </p>
                    <p className="text-xs text-text-secondary truncate">{m.user?.email}</p>
                  </div>
                </div>
                <div className="col-span-3">
                  {canChangeRoles && !isOwner ? (
                    <select
                      value={m.role}
                      disabled={busyUserId === m.userId}
                      onChange={(e) => void handleRoleChange(m.userId, e.target.value as 'admin' | 'member')}
                      className="text-xs bg-background border border-border rounded-lg px-2 py-1 text-text-primary focus:outline-none focus:border-accent-purple disabled:opacity-50"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full border font-medium capitalize ${isOwner ? 'text-accent-purple bg-accent-purple/10 border-accent-purple/20' : 'text-text-secondary bg-black/[0.04] border-border'}`}>
                      {ROLE_LABELS[m.role]}
                    </span>
                  )}
                </div>
                <div className="col-span-3 text-xs text-text-secondary">
                  {new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="col-span-1 flex justify-end">
                  {canManage && !isOwner && !isSelf && (
                    <button
                      onClick={() => void handleRemove(m.userId)}
                      disabled={busyUserId === m.userId}
                      title="Remove member"
                      className="text-text-disabled hover:text-accent-red transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {isSelf && !isOwner && (
                    <button
                      onClick={() => setConfirmAction({ type: 'leave' })}
                      title="Leave workspace"
                      className="text-text-disabled hover:text-accent-red transition-colors"
                    >
                      <LogOut size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {canManage && pendingInvites.length > 0 && (
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
                    <span className="text-[11px] text-text-secondary capitalize shrink-0">{inv.role}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => void handleResend(inv.email, inv.role)} className="text-text-disabled hover:text-accent-purple transition-colors" title="Resend invite">
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

        {canManage && (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-text-secondary" />
                <span className="text-sm font-semibold text-text-primary">Activity</span>
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
                  <p className="text-xs text-text-secondary">Hand this workspace to another member. You'll become an admin.</p>
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
          message={`${confirmAction.name} will become the owner of ${workspace?.name ?? 'this workspace'}. You'll be moved to admin.`}
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
