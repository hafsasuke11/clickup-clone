import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { UserPlus, AlertCircle } from 'lucide-react';
import { getInviteInfo, acceptInvite, type InviteInfo } from '@/utils/authApi';
import { useSession } from '@/utils/authGuards';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const logout = useAuthStore((s) => s.logout);
  const addToast = useUiStore((s) => s.addToast);

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!token) return;
    getInviteInfo(token)
      .then(setInfo)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'This invite link is invalid or has expired.'));
  }, [token]);

  const accept = async () => {
    if (!token) return;
    setWorking(true);
    try {
      await acceptInvite(token);
      addToast(`You've joined ${info?.workspaceName ?? 'the workspace'}`, 'success');
      navigate('/app');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not accept this invite.', 'error');
      setWorking(false);
    }
  };

  const emailMatches = user && info && user.email.toLowerCase() === info.email.toLowerCase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-[400px] bg-surface border border-border rounded-2xl shadow-sm p-7">
        <div className="w-11 h-11 rounded-xl bg-accent-purple/10 flex items-center justify-center mb-4">
          <UserPlus size={20} className="text-accent-purple" />
        </div>

        {loadError ? (
          <>
            <h1 className="text-lg font-bold text-text-primary mb-1.5">Invite unavailable</h1>
            <p className="text-sm text-text-secondary flex items-start gap-1.5">
              <AlertCircle size={14} className="shrink-0 mt-0.5 text-accent-red" />
              {loadError}
            </p>
            <Link to="/" className="mt-5 inline-block text-sm font-semibold text-accent-purple hover:text-purple-700">Go home</Link>
          </>
        ) : !info || sessionLoading ? (
          <div className="flex justify-center py-6">
            <span className="w-6 h-6 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <h1 className="text-lg font-bold text-text-primary mb-1.5">Join {info.workspaceName}</h1>
            <p className="text-sm text-text-secondary">
              <strong className="text-text-primary">{info.inviterName}</strong> invited{' '}
              <strong className="text-text-primary">{info.email}</strong> to join{' '}
              <strong className="text-text-primary">{info.workspaceName}</strong> as {info.role}.
            </p>

            {!user && (
              <div className="mt-6 space-y-2.5">
                <p className="text-xs text-text-secondary">Sign in or create an account with {info.email} to accept.</p>
                <div className="flex gap-2.5">
                  <Link
                    to={`/login?invite=${token}`}
                    className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold border border-border text-text-primary hover:bg-black/[0.03] transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    to={`/signup?invite=${token}`}
                    className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold text-white bg-accent-purple hover:bg-purple-700 transition-colors"
                  >
                    Sign up
                  </Link>
                </div>
              </div>
            )}

            {user && emailMatches && (
              <button
                onClick={accept}
                disabled={working}
                className="mt-6 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-accent-purple hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {working ? 'Joining…' : `Accept & join ${info.workspaceName}`}
              </button>
            )}

            {user && !emailMatches && (
              <div className="mt-6 space-y-2.5">
                <p className="text-xs text-accent-red flex items-start gap-1.5">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  This invite is for {info.email}, but you're signed in as {user.email}.
                </p>
                <button
                  onClick={() => { logout(); navigate(`/login?invite=${token}`); }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold border border-border text-text-primary hover:bg-black/[0.03] transition-colors"
                >
                  Sign out and use {info.email}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
