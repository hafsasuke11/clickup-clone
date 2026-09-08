import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldOff, X, KeyRound, Mail } from 'lucide-react';
import { twoFactorApi } from '@/utils/api';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

const codeInputCls =
  'w-full bg-background border border-border rounded-lg px-3 py-2.5 text-center text-lg tracking-[0.5em] font-mono text-text-primary placeholder:text-text-disabled placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:border-accent-purple transition-colors';

function ModalShell({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="shrink-0 p-1.5 -m-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-black/[0.04] transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/** Counts down the "Resend code" cooldown. */
function useResendCooldown() {
  const [until, setUntil] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (until <= Date.now()) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [until]);
  return {
    secondsLeft: Math.max(0, Math.ceil((until - Date.now()) / 1000)),
    arm: (ms: number) => setUntil(Date.now() + ms),
  };
}

interface SendResult { email: string; cooldownMs: number; devCode?: string }

/** Shared "enter the emailed code" step, used for both enable and disable. */
function EmailCodeModal({
  title, confirmLabel, danger, doneText, sendCode, verifyCode, onClose, onDone,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  doneText: string;
  sendCode: () => Promise<SendResult>;
  verifyCode: (code: string) => Promise<void>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<'sending' | 'entering' | 'done'>('sending');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { secondsLeft, arm } = useResendCooldown();

  const send = useCallback(async (resend: boolean) => {
    setError('');
    try {
      const r = await sendCode();
      if (r.devCode) console.info('[2FA] Email OTP (dev only):', r.devCode);
      setEmail(r.email);
      arm(r.cooldownMs);
      setPhase('entering');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a code. Try again.');
      // On the first send, still show the form so they can retry via "Resend".
      if (!resend) setPhase('entering');
    }
  }, [sendCode, arm]);

  // Send exactly one code on open (a ref guard keeps React 18 StrictMode's
  // double-invoke from firing two).
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    void send(false);
  }, [send]);

  const verify = async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true); setError('');
    try {
      await verifyCode(code);
      setPhase('done');
      setTimeout(onDone, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code is incorrect or expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title={title} onClose={onClose}>
      {phase === 'sending' && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
        </div>
      )}

      {phase === 'entering' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 text-sm text-text-secondary">
            <Mail size={16} className="shrink-0 mt-0.5 text-accent-purple" />
            <span>
              We emailed a 6-digit code to <b className="text-text-primary">{email || 'your email'}</b>.
              It expires in 5 minutes.
            </span>
          </div>

          <input
            autoFocus
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter code"
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') void verify(); }}
            className={codeInputCls}
          />
          {error && <p className="text-xs text-accent-red">{error}</p>}

          <button
            type="button"
            disabled={secondsLeft > 0}
            onClick={() => void send(true)}
            className="text-xs font-medium text-accent-purple hover:text-purple-700 disabled:text-text-disabled disabled:cursor-default transition-colors"
          >
            {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
          </button>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={() => void verify()}
              disabled={code.length !== 6 || busy}
              className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 ${
                danger ? 'bg-accent-red hover:bg-red-700' : 'bg-accent-purple hover:bg-purple-700'
              }`}
            >
              {busy ? 'Verifying…' : confirmLabel}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="w-12 h-12 rounded-full bg-accent-green/15 flex items-center justify-center">
            <ShieldCheck size={24} className="text-accent-green" />
          </div>
          <p className="text-sm font-medium text-text-primary">{doneText}</p>
        </div>
      )}
    </ModalShell>
  );
}

// ─── Panel ────────────────────────────────────────────────────
export default function TwoFactorPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [view, setView] = useState<'idle' | 'enable' | 'disable'>('idle');
  const addToast = useUiStore((s) => s.addToast);

  const load = () => twoFactorApi.status().then((s) => setEnabled(s.enabled)).catch(() => setEnabled(null));
  useEffect(() => { void load(); }, []);

  const refresh = () => {
    void load();
    void useAuthStore.getState().rehydrateFromServer();
  };

  return (
    <section className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={15} className="text-text-secondary" />
        <h2 className="text-sm font-semibold text-text-primary">Two-factor authentication</h2>
        <span
          className={`ml-auto text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            enabled ? 'bg-accent-green/15 text-accent-green' : 'bg-black/[0.05] text-text-secondary'
          }`}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <p className="text-sm text-text-secondary">
        {enabled
          ? 'A one-time code is emailed to you every time you sign in.'
          : 'Add a second step at sign-in with a one-time code sent to your email.'}
      </p>

      <div className="flex flex-wrap gap-2 mt-4">
        {enabled ? (
          <button
            onClick={() => setView('disable')}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-accent-red/40 text-accent-red rounded-lg text-sm font-medium hover:bg-accent-red/10 transition-colors"
          >
            <ShieldOff size={15} /> Disable 2FA
          </button>
        ) : (
          <button
            onClick={() => setView('enable')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-accent-purple text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            <ShieldCheck size={15} /> Enable 2FA
          </button>
        )}
      </div>

      {view === 'enable' && (
        <EmailCodeModal
          title="Turn on two-factor authentication"
          confirmLabel="Verify & enable"
          doneText="Two-factor authentication is on"
          sendCode={twoFactorApi.sendEnableCode}
          verifyCode={(c) => twoFactorApi.enable(c).then(() => undefined)}
          onClose={() => setView('idle')}
          onDone={() => { setView('idle'); refresh(); }}
        />
      )}

      {view === 'disable' && (
        <EmailCodeModal
          title="Turn off two-factor authentication"
          confirmLabel="Disable 2FA"
          danger
          doneText="Two-factor authentication is off"
          sendCode={twoFactorApi.sendDisableCode}
          verifyCode={(c) => twoFactorApi.disable(c).then(() => undefined)}
          onClose={() => setView('idle')}
          onDone={() => { setView('idle'); refresh(); addToast('Two-factor authentication disabled', 'success'); }}
        />
      )}
    </section>
  );
}
