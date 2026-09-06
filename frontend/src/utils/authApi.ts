import { apiClient } from './apiClient';
import type { User } from './types';

export interface AuthResponse {
  token: string;
  user: User;
}

function friendlyError(message: string): string {
  return message;
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
    throw new Error(friendlyError(err instanceof Error ? err.message : 'Signup failed. Please try again.'));
  }
}

export async function apiLogin(data: { email: string; password: string }): Promise<AuthResponse> {
  try {
    return await apiClient.post<AuthResponse>('/api/auth/login', data);
  } catch (err) {
    throw new Error(friendlyError(err instanceof Error ? err.message : 'Login failed. Please try again.'));
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

export async function getInviteInfo(token: string): Promise<InviteInfo> {
  return apiClient.get<InviteInfo>(`/api/invites/${token}`);
}

export async function acceptInvite(token: string): Promise<void> {
  await apiClient.post(`/api/invites/${token}/accept`);
}
