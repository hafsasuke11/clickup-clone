import { create } from 'zustand';
import { apiMe } from '@/utils/api';
import type { User } from '@/utils/types';
import { useWorkspaceStore } from './workspaceStore';
import { useTaskStore } from './taskStore';

/**
 * Multi-account auth.
 *
 * - `clickup-accounts` (localStorage, shared by every tab): the pool of known
 *   sessions `{ accounts: { [userId]: { token, user } }, lastActiveUserId }`.
 *   Survives a browser restart.
 * - `clickup-active-user` (sessionStorage, per tab): which account THIS tab is
 *   using. Lets two tabs be signed into different accounts at the same time.
 *
 * A new tab with no active-user pointer adopts `lastActiveUserId` (feels like
 * "stay signed in"). Signing out removes that account from the shared pool, so
 * other tabs on the same account drop it too.
 */

interface StoredAccount {
  token: string;
  user: User;
}

interface AccountPool {
  accounts: Record<string, StoredAccount>;
  lastActiveUserId: string | null;
}

const POOL_KEY = 'clickup-accounts';
const TAB_KEY = 'clickup-active-user';
const LEGACY_AUTH_KEY = 'clickup-auth';

function readPool(): AccountPool {
  try {
    const raw = localStorage.getItem(POOL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AccountPool> | null;
      if (parsed && typeof parsed === 'object' && parsed.accounts && typeof parsed.accounts === 'object') {
        return {
          accounts: parsed.accounts as Record<string, StoredAccount>,
          lastActiveUserId: parsed.lastActiveUserId ?? null,
        };
      }
    }
  } catch {
    // corrupt or unavailable storage — start clean
  }
  return { accounts: {}, lastActiveUserId: null };
}

function writePool(pool: AccountPool): void {
  try {
    localStorage.setItem(POOL_KEY, JSON.stringify(pool));
  } catch {
    // storage full or unavailable — nothing actionable
  }
}

function readTabUserId(): string | null {
  try {
    return sessionStorage.getItem(TAB_KEY);
  } catch {
    return null;
  }
}

function writeTabUserId(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(TAB_KEY, id);
    else sessionStorage.removeItem(TAB_KEY);
  } catch {
    // ignore
  }
}

/** Remove an account from the pool and repoint `lastActiveUserId` if needed. */
function dropAccount(pool: AccountPool, userId: string | null): AccountPool {
  if (!userId || !pool.accounts[userId]) return pool;
  const accounts = { ...pool.accounts };
  delete accounts[userId];
  const remaining = Object.keys(accounts);
  const lastActiveUserId =
    pool.lastActiveUserId && accounts[pool.lastActiveUserId]
      ? pool.lastActiveUserId
      : remaining.length
        ? remaining[remaining.length - 1]
        : null;
  return { accounts, lastActiveUserId };
}

/** One-time import of the pre-multi-account `clickup-auth` blob. */
function migrateLegacyAuth(pool: AccountPool): AccountPool {
  if (Object.keys(pool.accounts).length > 0) return pool;
  try {
    const raw = localStorage.getItem(LEGACY_AUTH_KEY);
    if (!raw) return pool;
    const parsed = JSON.parse(raw) as { state?: { token?: string; user?: User } } | null;
    const token = parsed?.state?.token;
    const user = parsed?.state?.user;
    if (token && user?.id) {
      const migrated: AccountPool = { accounts: { [user.id]: { token, user } }, lastActiveUserId: user.id };
      writePool(migrated);
      localStorage.removeItem(LEGACY_AUTH_KEY);
      return migrated;
    }
    localStorage.removeItem(LEGACY_AUTH_KEY);
  } catch {
    // malformed legacy data — ignore
  }
  return pool;
}

function resolveInitialSession(): { token: string | null; user: User | null } {
  const pool = migrateLegacyAuth(readPool());

  let activeId = readTabUserId();
  if (activeId && !pool.accounts[activeId]) activeId = null;
  if (!activeId && pool.lastActiveUserId && pool.accounts[pool.lastActiveUserId]) {
    activeId = pool.lastActiveUserId;
  }
  if (!activeId) {
    const ids = Object.keys(pool.accounts);
    activeId = ids.length ? ids[ids.length - 1] : null;
  }

  if (activeId) {
    writeTabUserId(activeId);
    const acc = pool.accounts[activeId];
    return { token: acc.token, user: acc.user };
  }
  return { token: null, user: null };
}

/** Wipe workspace/task state that belonged to the previous account. */
function resetScopedStores(): void {
  useWorkspaceStore.getState().reset();
  useTaskStore.getState().reset();
}

function knownAccountsOf(pool: AccountPool): User[] {
  return Object.values(pool.accounts).map((a) => a.user);
}

interface AuthStore {
  token: string | null;
  user: User | null;
  loading: boolean;
  hydrated: boolean;
  /** Every account signed in on this browser (any tab). */
  knownAccounts: User[];
  /** True while the user is deliberately adding a second account. */
  addingAccount: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  beginAddAccount: () => void;
  cancelAddAccount: () => void;
  switchAccount: (userId: string) => void;
  rehydrateFromServer: () => Promise<void>;
}

const initial = resolveInitialSession();

export const useAuthStore = create<AuthStore>((set, get) => ({
  token: initial.token,
  user: initial.user,
  loading: true,
  hydrated: false,
  knownAccounts: knownAccountsOf(readPool()),
  addingAccount: false,

  setAuth: (token, user) => {
    const prevUserId = get().user?.id ?? null;
    const pool = readPool();
    pool.accounts[user.id] = { token, user };
    pool.lastActiveUserId = user.id;
    writePool(pool);
    writeTabUserId(user.id);
    set({ token, user, loading: false, hydrated: true, addingAccount: false, knownAccounts: knownAccountsOf(pool) });
    if (prevUserId !== user.id) resetScopedStores();
  },

  logout: () => {
    const activeId = get().user?.id ?? readTabUserId();
    const pool = dropAccount(readPool(), activeId);
    writePool(pool);
    writeTabUserId(null);
    set({ token: null, user: null, loading: false, hydrated: true, addingAccount: false, knownAccounts: knownAccountsOf(pool) });
    resetScopedStores();
  },

  beginAddAccount: () => set({ addingAccount: true }),
  cancelAddAccount: () => set({ addingAccount: false }),

  switchAccount: (userId) => {
    const pool = readPool();
    const acc = pool.accounts[userId];
    if (!acc || get().user?.id === userId) {
      set({ addingAccount: false });
      return;
    }
    pool.lastActiveUserId = userId;
    writePool(pool);
    writeTabUserId(userId);
    set({ token: acc.token, user: acc.user, loading: true, hydrated: false, addingAccount: false });
    resetScopedStores();
    void get().rehydrateFromServer();
  },

  rehydrateFromServer: async () => {
    const { token } = get();
    if (!token) {
      set({ loading: false, hydrated: true });
      return;
    }
    try {
      const fresh = await apiMe();
      const pool = readPool();
      if (pool.accounts[fresh.id]) {
        pool.accounts[fresh.id] = { token, user: fresh };
        writePool(pool);
      }
      set({ user: fresh, loading: false, hydrated: true, knownAccounts: knownAccountsOf(pool) });
    } catch {
      // A 401 is already turned into a clean logout by the API client's
      // onUnauthorized hook. Anything else here is transient (network,
      // server hiccup) — keep the stored session so a flaky connection
      // doesn't sign the user out.
      set({ loading: false, hydrated: true });
    }
  },
}));

/** Keep this tab consistent when accounts change in other tabs. */
export function subscribeAuthStorage(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('storage', (e) => {
    if (e.key !== POOL_KEY) return;
    const pool = readPool();
    const knownAccounts = knownAccountsOf(pool);
    const activeId = readTabUserId();
    const { token } = useAuthStore.getState();

    if (!activeId) {
      useAuthStore.setState({ knownAccounts });
      return;
    }

    if (!pool.accounts[activeId]) {
      // This account was signed out from another tab — follow suit.
      if (token) {
        writeTabUserId(null);
        useAuthStore.setState({ token: null, user: null, hydrated: true, loading: false, knownAccounts });
        resetScopedStores();
      } else {
        useAuthStore.setState({ knownAccounts });
      }
      return;
    }
    if (pool.accounts[activeId].token !== token) {
      useAuthStore.setState({
        token: pool.accounts[activeId].token,
        user: pool.accounts[activeId].user,
        knownAccounts,
      });
    } else {
      useAuthStore.setState({ knownAccounts });
    }
  });
}
