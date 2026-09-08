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

/** Thrown for any non-2xx response. Carries the parsed JSON body so callers can
 *  react to structured errors (e.g. a duplicate-task 409) instead of just text. */
export class ApiError extends Error {
  status: number;
  data: Record<string, unknown> | null;
  constructor(message: string, status: number, data: Record<string, unknown> | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
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
    let body: Record<string, unknown> | null = null;
    try {
      body = await res.json();
      if (body && typeof body.error === 'string') message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(message, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Generic REST helpers used by the stores. */
export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined }),
};

// ─── Auth & invite calls ──────────────────────────────────────
export interface AuthResponse {
  token: string;
  user: User;
}

/** Returned by /login when the account has 2FA — no session is granted yet.
 *  A 6-digit code has been emailed to `email`. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challenge: string;
  email: string;
  /** Time to wait before "Resend code" is allowed again. */
  cooldownMs: number;
  /** Only present in non-production, so the flow is usable without an inbox. */
  devCode?: string;
}
export type LoginResult = AuthResponse | TwoFactorChallenge;

export function isTwoFactorChallenge(r: LoginResult): r is TwoFactorChallenge {
  return (r as TwoFactorChallenge).twoFactorRequired === true;
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

export async function apiLogin(data: { email: string; password: string }): Promise<LoginResult> {
  try {
    return await apiClient.post<LoginResult>('/api/auth/login', data);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Login failed. Please try again.');
  }
}

/** Second step of a 2FA login — redeems the emailed code for a real session. */
export async function apiLogin2fa(data: { challenge: string; code: string }): Promise<AuthResponse> {
  try {
    return await apiClient.post<AuthResponse>('/api/auth/login/2fa', data);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Verification failed. Please try again.');
  }
}

/** Email a fresh sign-in code during a 2FA login. */
export async function apiLogin2faResend(data: { challenge: string }) {
  return apiClient.post<{ sent: true; cooldownMs: number; devCode?: string }>(
    '/api/auth/login/2fa/resend', data,
  );
}

// ─── Two-factor authentication (management) ────────────────────
export interface TwoFactorStatus {
  enabled: boolean;
  email: string;
}
export interface OtpSendResult {
  sent: true;
  email: string;
  cooldownMs: number;
  devCode?: string;
}

export const twoFactorApi = {
  status: () => apiClient.get<TwoFactorStatus>('/api/auth/2fa/status'),
  sendEnableCode: () => apiClient.post<OtpSendResult>('/api/auth/2fa/enable/send'),
  enable: (code: string) => apiClient.post<{ enabled: true }>('/api/auth/2fa/enable', { code }),
  sendDisableCode: () => apiClient.post<OtpSendResult>('/api/auth/2fa/disable/send'),
  disable: (code: string) => apiClient.post<{ enabled: false }>('/api/auth/2fa/disable', { code }),
};

export async function apiMe(): Promise<User> {
  const res = await apiClient.get<{ user: User }>('/api/auth/me');
  return res.user;
}

export interface InviteInfo {
  email: string;
  role: 'member';
  workspaceName: string;
  inviterName: string;
}

export function getInviteInfo(token: string): Promise<InviteInfo> {
  return apiClient.get<InviteInfo>(`/api/invites/${token}`);
}

export async function acceptInvite(token: string): Promise<void> {
  await apiClient.post(`/api/invites/${token}/accept`);
}
