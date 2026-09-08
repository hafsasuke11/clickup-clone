import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

export async function findUserByEmail(email: string) {
  return User.findOne({ email: email.toLowerCase().trim() });
}

export async function findUserById(id: string) {
  return User.findById(id);
}

export async function createUser(data: {
  email: string;
  password: string;
  fullName: string;
  company?: string;
}) {
  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw new Error('EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  return User.create({
    email: data.email.toLowerCase().trim(),
    passwordHash,
    fullName: data.fullName.trim(),
    company: data.company?.trim() ?? '',
  });
}

export async function verifyPassword(user: { passwordHash: string }, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

export function toPublicUser(user: {
  _id: unknown;
  email: string;
  fullName: string;
  company: string;
  createdAt?: Date;
  twoFactorEnabled?: boolean;
}) {
  return {
    id: String(user._id),
    email: user.email,
    fullName: user.fullName,
    company: user.company,
    createdAt: user.createdAt,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
  };
}
