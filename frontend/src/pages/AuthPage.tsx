import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, ArrowRight, Sparkles, User, Building2,
  Eye, EyeOff, AlertCircle, UserPlus,
} from 'lucide-react';
import { apiSignup, apiLogin, getInviteInfo, acceptInvite, type InviteInfo } from '@/utils/authApi';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { signupSchema, loginSchema, type SignupFormData, type LoginFormData } from '@/utils/authValidation';

// ─── Password strength ─────────────────────────────────────────
function getStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: '', color: '#E4E7EC' };
  if (pw.length < 6) return { level: 1, label: 'Too short', color: '#F04438' };
  const checks = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 12 && checks >= 3) return { level: 3, label: 'Strong', color: '#12B76A' };
  if (pw.length >= 8 && checks >= 2) return { level: 2, label: 'Good', color: '#F79009' };
  return { level: 1, label: 'Weak', color: '#F04438' };
}

function StrengthBar({ password }: { password: string }) {
  const s = getStrength(password);
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300" style={{ background: i <= s.level ? s.color : '#E4E7EC' }} />
        ))}
      </div>
      {s.label && <p className="text-xs font-medium" style={{ color: s.color }}>{s.label}</p>}
    </div>
  );
}

// ─── Input field wrapper ───────────────────────────────────────
function Field({
  label, icon, required, hint, error, children,
}: {
  label: string; icon?: React.ReactNode; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-text-secondary">
        {label}
        {required && <span className="text-accent-purple ml-0.5">*</span>}
        {hint && <span className="text-text-disabled font-normal ml-1">{hint}</span>}
      </label>
      <div className="relative">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-disabled pointer-events-none">{icon}</span>}
        {children}
      </div>
      {error && <p className="text-xs text-accent-red flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
    </div>
  );
}

// ─── Left branding panel ───────────────────────────────────────
const BOARD_COLUMNS = [
  { title: 'To do', color: '#6D4FE0', bars: [0.92, 0.58] },
  { title: 'In progress', color: '#F79009', bars: [0.7, 0.44] },
  { title: 'Done', color: '#12B76A', bars: [0.6, 0.82] },
];

function MiniBoard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full bg-white border border-border rounded-2xl shadow-md overflow-hidden mb-10"
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
        <span className="text-sm font-semibold text-text-primary">Sprint board</span>
        <span className="text-xs font-medium text-text-secondary">This week</span>
      </div>
      <div className="grid grid-cols-3 gap-3 p-4">
        {BOARD_COLUMNS.map((col, ci) => (
          <div key={col.title} className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: col.color }} />
              <span className="text-[11px] font-medium text-text-secondary">{col.title}</span>
            </div>
            {col.bars.map((w, bi) => (
              <motion.div
                key={bi}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.25 + ci * 0.08 + bi * 0.06 }}
                className="rounded-lg bg-black/[0.03] p-2"
              >
                <div className="h-1.5 rounded-full" style={{ width: `${w * 100}%`, background: col.color, opacity: 0.55 }} />
                <div className="mt-1.5 h-1 rounded-full bg-black/[0.07]" style={{ width: `${w * 68}%` }} />
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function LeftPanel({ isSignUp }: { isSignUp: boolean }) {
  return (
    <div
      className="hidden lg:flex lg:w-[48%] relative overflow-hidden flex-col items-center justify-center p-14"
      style={{ background: 'linear-gradient(160deg, #F5F3FF 0%, #EEF2FF 45%, #F7F8FA 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-[420px] h-[420px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(109,79,224,0.14) 0%, transparent 70%)', top: '5%', left: '-10%' }}
          animate={{ x: [0, 40, 0], y: [0, -20, 0] }}
          transition={{ repeat: Infinity, duration: 9, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(46,144,250,0.1) 0%, transparent 70%)', bottom: '10%', right: '-5%' }}
          animate={{ x: [0, -30, 0], y: [0, 30, 0] }}
          transition={{ repeat: Infinity, duration: 11, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
            style={{ background: 'linear-gradient(135deg, #6D4FE0 0%, #EE46BC 50%, #F79009 100%)' }}
          >
            C
          </div>
          <span className="text-text-primary font-bold text-2xl tracking-tight">ClickUp</span>
        </div>

        <h2 className="text-4xl font-bold text-text-primary leading-tight mb-3">
          {isSignUp ? 'Turn scattered tasks into a clear plan.' : 'Your workspace is right where you left it.'}
        </h2>
        <p className="text-text-secondary text-base leading-relaxed mb-8">
          {isSignUp
            ? 'Organize work in lists and boards, set due dates, and watch progress on a live dashboard.'
            : 'Jump back into your lists, boards, and calendar.'}
        </p>

        <MiniBoard />

        <div className="flex items-center gap-2 text-accent-purple">
          <Sparkles size={14} />
          <span className="text-xs font-medium">Free to use. No credit card required.</span>
        </div>
      </div>
    </div>
  );
}

// ─── Invite banner ──────────────────────────────────────────────
function InviteBanner({ info }: { info: InviteInfo }) {
  return (
    <div className="flex items-start gap-2.5 bg-accent-purple/10 border border-accent-purple/25 text-text-primary p-3.5 rounded-xl mb-5 text-sm">
      <UserPlus size={16} className="shrink-0 mt-0.5 text-accent-purple" />
      <span>
        <strong>{info.inviterName}</strong> invited you to join <strong>{info.workspaceName}</strong>. Sign up (or log in) with <strong>{info.email}</strong> to accept.
      </span>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full inline-block"
    />
  );
}

// ─── Main AuthPage ──────────────────────────────────────────────
export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSignUp = location.pathname === '/signup';
  const setAuth = useAuthStore((s) => s.setAuth);
  const addingAccount = useAuthStore((s) => s.addingAccount);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const addToast = useUiStore((s) => s.addToast);

  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState('');

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', company: '', email: '', password: '', confirmPassword: '', agreedToTerms: false },
  });
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    setError('');
    signupForm.reset({ fullName: '', company: '', email: inviteInfo?.email ?? '', password: '', confirmPassword: '', agreedToTerms: false });
    loginForm.reset({ email: inviteInfo?.email ?? '', password: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignUp]);

  useEffect(() => {
    if (!inviteToken) return;
    getInviteInfo(inviteToken)
      .then((info) => {
        setInviteInfo(info);
        signupForm.setValue('email', info.email);
        loginForm.setValue('email', info.email);
      })
      .catch((err) => setInviteError(err instanceof Error ? err.message : 'This invite link is invalid or has expired.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken]);

  const onSubmitSignup = async (data: SignupFormData) => {
    setLoading(true); setError('');
    try {
      const result = await apiSignup({
        fullName: data.fullName.trim(),
        email: data.email.trim(),
        password: data.password,
        company: data.company?.trim() || undefined,
        inviteToken: inviteToken ?? undefined,
      });
      setAuth(result.token, result.user);
      navigate('/app');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitLogin = async (data: LoginFormData) => {
    setLoading(true); setError('');
    try {
      const result = await apiLogin({ email: data.email.trim(), password: data.password });
      setAuth(result.token, result.user);
      if (inviteToken) {
        try {
          await acceptInvite(inviteToken);
        } catch (err) {
          addToast(err instanceof Error ? err.message : 'Could not join that workspace.', 'error');
        }
      }
      const from = (location.state as { from?: string })?.from;
      navigate(from && from.startsWith('/app') ? from : '/app');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (hasIcon = true, hasError = false) =>
    `w-full ${hasIcon ? 'pl-10' : 'pl-4'} pr-4 py-3 bg-white border rounded-xl text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 transition-colors ${
      hasError ? 'border-accent-red focus:border-accent-red focus:ring-accent-red/30' : 'border-border focus:border-accent-purple focus:ring-accent-purple/30'
    }`;

  const signupPassword = signupForm.watch('password');

  return (
    <div className="min-h-screen flex bg-background">
      <LeftPanel isSignUp={isSignUp} />

      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={isSignUp ? 'signup' : 'login'}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-[420px]"
          >
            <Link to="/" className="lg:hidden flex items-center gap-2 mb-8 justify-center">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg, #6D4FE0 0%, #EE46BC 100%)' }}>C</div>
              <span className="font-bold text-xl text-text-primary">ClickUp</span>
            </Link>

            <h1 className="text-[28px] font-bold text-text-primary mb-1.5">{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
            <p className="text-sm text-text-secondary mb-7">
              {isSignUp ? 'Start for free. No credit card needed.' : 'Enter your details to access your workspace.'}
            </p>

            {addingAccount && (
              <div className="flex items-start gap-2.5 bg-accent-purple/10 border border-accent-purple/25 text-text-primary p-3.5 rounded-xl mb-5 text-sm">
                <UserPlus size={16} className="shrink-0 mt-0.5 text-accent-purple" />
                <span>Adding another account. Your other accounts stay signed in on this browser, and you can switch between them from the sidebar.</span>
              </div>
            )}

            {inviteInfo && <InviteBanner info={inviteInfo} />}

            {inviteError && (
              <div className="flex items-start gap-2.5 bg-accent-red/10 border border-accent-red/25 text-accent-red p-3.5 rounded-xl mb-5 text-sm">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{inviteError}</span>
              </div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5 bg-accent-red/10 border border-accent-red/25 text-accent-red p-3.5 rounded-xl mb-5 text-sm">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>
                  {error}
                  {inviteToken && isSignUp && /already registered/i.test(error) && (
                    <>
                      {' '}
                      <Link to={`/login?invite=${inviteToken}`} className="underline font-medium">Log in instead</Link>.
                    </>
                  )}
                </span>
              </motion.div>
            )}

            {isSignUp ? (
              <form onSubmit={signupForm.handleSubmit(onSubmitSignup)} className="space-y-4" noValidate>
                <Field label="Full name" icon={<User size={16} />} required error={signupForm.formState.errors.fullName?.message}>
                  <input type="text" placeholder="Jane Smith" autoComplete="name"
                    className={inputCls(true, !!signupForm.formState.errors.fullName)}
                    {...signupForm.register('fullName')} />
                </Field>
                <Field label="Company" icon={<Building2 size={16} />} hint="(optional)">
                  <input type="text" placeholder="Acme Inc." autoComplete="organization"
                    className={inputCls()}
                    {...signupForm.register('company')} />
                </Field>
                <Field label="Email" icon={<Mail size={16} />} required error={signupForm.formState.errors.email?.message}>
                  <input type="email" placeholder="you@company.com" autoComplete="email" readOnly={!!inviteInfo}
                    className={`${inputCls(true, !!signupForm.formState.errors.email)} ${inviteInfo ? 'bg-black/[0.03] cursor-not-allowed' : ''}`}
                    {...signupForm.register('email')} />
                </Field>
                <div>
                  <Field label="Password" icon={<Lock size={16} />} required error={signupForm.formState.errors.password?.message}>
                    <input type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters" autoComplete="new-password"
                      className={`${inputCls(true, !!signupForm.formState.errors.password)} pr-11`}
                      {...signupForm.register('password')} />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-secondary transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </Field>
                  <StrengthBar password={signupPassword ?? ''} />
                </div>
                <Field label="Confirm password" icon={<Lock size={16} />} required error={signupForm.formState.errors.confirmPassword?.message}>
                  <input type={showConfirm ? 'text' : 'password'} placeholder="Re-enter your password" autoComplete="new-password"
                    className={`${inputCls(true, !!signupForm.formState.errors.confirmPassword)} pr-11`}
                    {...signupForm.register('confirmPassword')} />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-secondary transition-colors">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </Field>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" className="mt-0.5 w-4 h-4 rounded border-border accent-accent-purple cursor-pointer" {...signupForm.register('agreedToTerms')} />
                  <span className="text-xs text-text-secondary leading-relaxed">
                    I agree to the{' '}
                    <a href="#" className="text-accent-purple hover:text-purple-700 transition-colors underline underline-offset-2">Terms of Service</a>
                    {' '}and{' '}
                    <a href="#" className="text-accent-purple hover:text-purple-700 transition-colors underline underline-offset-2">Privacy Policy</a>
                  </span>
                </label>
                {signupForm.formState.errors.agreedToTerms && (
                  <p className="text-xs text-accent-red flex items-center gap-1 -mt-2"><AlertCircle size={11} />{signupForm.formState.errors.agreedToTerms.message}</p>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  style={{ background: 'linear-gradient(135deg, #6D4FE0 0%, #5A3FC0 100%)', boxShadow: '0 4px 20px rgba(109,79,224,0.3)' }}>
                  {loading ? <SpinnerIcon /> : <><span>Create Account</span><ArrowRight size={16} /></>}
                </button>
              </form>
            ) : (
              <form onSubmit={loginForm.handleSubmit(onSubmitLogin)} className="space-y-4" noValidate>
                <Field label="Email" icon={<Mail size={16} />} required error={loginForm.formState.errors.email?.message}>
                  <input type="email" placeholder="you@company.com" autoComplete="email" readOnly={!!inviteInfo}
                    className={`${inputCls(true, !!loginForm.formState.errors.email)} ${inviteInfo ? 'bg-black/[0.03] cursor-not-allowed' : ''}`}
                    {...loginForm.register('email')} />
                </Field>
                <Field label="Password" icon={<Lock size={16} />} required error={loginForm.formState.errors.password?.message}>
                  <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password"
                    className={`${inputCls(true, !!loginForm.formState.errors.password)} pr-11`}
                    {...loginForm.register('password')} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-secondary transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </Field>

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  style={{ background: 'linear-gradient(135deg, #6D4FE0 0%, #5A3FC0 100%)', boxShadow: '0 4px 20px rgba(109,79,224,0.3)' }}>
                  {loading ? <SpinnerIcon /> : <><span>Sign In</span><ArrowRight size={16} /></>}
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-text-secondary">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <Link
                to={`${isSignUp ? '/login' : '/signup'}${inviteToken ? `?invite=${inviteToken}` : ''}`}
                className="text-accent-purple font-semibold hover:text-purple-700 transition-colors"
              >
                {isSignUp ? 'Sign in' : 'Sign up free'}
              </Link>
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
