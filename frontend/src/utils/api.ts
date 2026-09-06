import type { User } from './types';

// ─── Low-level fetch wrapper ───────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';

let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

/** Wire the API client to the auth store (called once from main.tsx). */
export function configureApiClient(opts: { getToken: () => string | null; onUnauthorized: () => void }) {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    onUnauthorized();
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Generic REST helpers used by the stores. */
export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ─── Auth & invite calls ──────────────────────────────────────
export interface AuthResponse {
  token: string;
  user: User;
}

export async function apiSignup(data: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword?: string;
  company?: string;
  inviteToken?: string;
}): Promise<AuthResponse> {
  try {
    return await apiClient.post<AuthResponse>('/api/auth/signup', data);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Signup failed. Please try again.');
  }
}

export async function apiLogin(data: { email: string; password: string }): Promise<AuthResponse> {
  try {
    return await apiClient.post<AuthResponse>('/api/auth/login', data);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Login failed. Please try again.');
  }
}

export async function apiMe(): Promise<User> {
  const res = await apiClient.get<{ user: User }>('/api/auth/me');
  return res.user;
}

export interface InviteInfo {
  email: string;
  role: 'admin' | 'member';
  workspaceName: string;
  inviterName: string;
}

export function getInviteInfo(token: string): Promise<InviteInfo> {
  return apiClient.get<InviteInfo>(`/api/invites/${token}`);
}

export async function acceptInvite(token: string): Promise<void> {
  await apiClient.post(`/api/invites/${token}/accept`);
}
