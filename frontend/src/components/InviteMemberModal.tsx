import { useEffect, useState } from 'react';
import { X, Mail, AlertCircle, Clock, Trash2, Link2, Check } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useUiStore } from '@/store/uiStore';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyLinkButton({ url, label = 'Copy link' }: { url: string; label?: string }) {
  const { addToast } = useUiStore();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      addToast('Could not copy — select and copy the link manually.', 'error');
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-purple hover:text-purple-700 transition-colors shrink-0"
    >
      {copied ? <Check size={13} /> : <Link2 size={13} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export default function InviteMemberModal() {
  const { setInviteModalOpen } = useUiStore();
  const { addMember, pendingInvites, fetchPendingInvites, revokeInvite } = useWorkspaceStore();
  const { addToast } = useUiStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastInvite, setLastInvite] = useState<{ email: string; url: string; emailSent: boolean } | null>(null);

  useEffect(() => { void fetchPendingInvites(); }, [fetchPendingInvites]);

  const close = () => setInviteModalOpen(false);

  const submit = async () => {
    if (!email.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await addMember(email.trim());
      setLastInvite({
        email: email.trim(),
        url: res.inviteUrl ?? '',
        emailSent: res.emailSent ?? false,
      });
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite.');
    } finally {
      setLoading(false);
    }
  };

  const cancelInvite = async (id: string) => {
    try {
      await revokeInvite(id);
      addToast('Invite revoked', 'info');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to revoke invite.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">Invite a member</h3>
          <button onClick={close} className="text-text-secondary hover:text-text-primary"><X size={16} /></button>
        </div>
        <div className="px-5 py-5 space-y-3">
          <p className="text-xs text-text-secondary">
            Enter an email. We'll send them an invite link — they choose whether to
            join. You can also copy the link and share it yourself.
          </p>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="teammate@company.com"
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent-purple transition-colors"
            />
          </div>
          {error && <p className="text-xs text-accent-red flex items-center gap-1"><AlertCircle size={11} />{error}</p>}

          {lastInvite && (
            <div className="rounded-lg border border-accent-purple/25 bg-accent-purple/5 p-3 space-y-2">
              <p className="text-xs text-text-secondary">
                {lastInvite.emailSent
                  ? <>Invite emailed to <span className="font-medium text-text-primary">{lastInvite.email}</span>. If it doesn't arrive, share this link:</>
                  : <>Invite created for <span className="font-medium text-text-primary">{lastInvite.email}</span>. Send them this link:</>}
              </p>
              {lastInvite.url && (
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={lastInvite.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 px-2 py-1.5 text-[11px] text-text-secondary bg-background border border-border rounded-md truncate"
                  />
                  <CopyLinkButton url={lastInvite.url} />
                </div>
              )}
            </div>
          )}

          {pendingInvites.length > 0 && (
            <div className="pt-2">
              <p className="text-[10px] font-semibold text-text-disabled uppercase tracking-wider mb-1.5">Pending invites</p>
              <div className="space-y-1">
                {pendingInvites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background border border-border">
                    <Clock size={12} className="text-text-disabled shrink-0" />
                    <span className="text-xs text-text-secondary truncate flex-1">{inv.email}</span>
                    <CopyLinkButton url={inv.inviteUrl} label="Link" />
                    <button onClick={() => cancelInvite(inv.id)} className="text-text-disabled hover:text-accent-red transition-colors shrink-0" title="Revoke invite">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={close} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border rounded-lg transition-colors">Done</button>
          <button onClick={submit} disabled={loading || !email.trim()} className="px-4 py-2 text-sm bg-accent-purple text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium">
            {loading ? 'Sending...' : 'Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}
