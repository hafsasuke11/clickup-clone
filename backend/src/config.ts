/**
 * All environment configuration and startup checks live here:
 * reading env vars, validating the JWT secret, and connecting to MongoDB.
 * Imported after `dotenv/config` has run.
 */
import mongoose from 'mongoose';
import { Task } from './models/Task.js';
import { Workspace } from './models/Workspace.js';
import { DEFAULT_PROJECT_STATUSES, DEFAULT_TASK_STATUSES } from './models/statusDefaults.js';

const DEV_FALLBACK_SECRET = 'clickup-dev-secret-change-in-production';
const KNOWN_WEAK_SECRETS = new Set([DEV_FALLBACK_SECRET, 'change-me-in-production', 'secret', 'changeme']);

export const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  const isWeak = !secret || KNOWN_WEAK_SECRETS.has(secret) || secret.length < 32;

  if (IS_PRODUCTION && isWeak) {
    console.error(
      'FATAL: JWT_SECRET is missing or too weak. Generate a strong random value ' +
        '(for example: `openssl rand -base64 48`) and set it in the environment before starting in production.',
    );
    process.exit(1);
  }

  if (isWeak) {
    console.warn(
      'WARNING: JWT_SECRET is unset or weak - falling back to an insecure development secret. ' +
        'Never run this build in production without a strong JWT_SECRET.',
    );
    return secret || DEV_FALLBACK_SECRET;
  }

  return secret;
}

export const JWT_SECRET = resolveJwtSecret();

/** Allowed browser origins for CORS. Comma-separated `CORS_ORIGINS`, else `FRONTEND_URL`, else localhost dev. */
export const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Connect to MongoDB using MONGODB_URI, retrying with backoff instead of exiting
 * on failure. The HTTP server starts regardless (see index.ts), so a database
 * that is slow to start or briefly unavailable never kills the process —
 * Mongoose finishes connecting in the background and reconnects on its own if
 * the link later drops.
 */
/**
 * Small idempotent data fix-ups run once per successful connection. Cheap to
 * re-run: the queries no-op when there is nothing to change.
 */
async function runStartupMigrations(): Promise<void> {
  try {
    // The "To Do" status was retired — fold any leftover tasks into "Pending".
    // 'todo' is no longer part of the status union, so the filter is cast.
    const { modifiedCount } = await Task.updateMany(
      { status: 'todo' } as Record<string, unknown>,
      { $set: { status: 'pending' } },
    );
    if (modifiedCount > 0) {
      console.log(`Migrated ${modifiedCount} task(s) from "todo" to "pending".`);
    }

    // Workspaces created before per-workspace statuses need the built-in lists.
    const seededTasks = await Workspace.updateMany(
      { $or: [{ taskStatuses: { $exists: false } }, { taskStatuses: { $size: 0 } }] },
      { $set: { taskStatuses: DEFAULT_TASK_STATUSES } },
    );
    const seededProjects = await Workspace.updateMany(
      { $or: [{ projectStatuses: { $exists: false } }, { projectStatuses: { $size: 0 } }] },
      { $set: { projectStatuses: DEFAULT_PROJECT_STATUSES } },
    );
    const seeded = Math.max(seededTasks.modifiedCount, seededProjects.modifiedCount);
    if (seeded > 0) {
      console.log(`Seeded built-in statuses for ${seeded} workspace(s).`);
    }
  } catch (err) {
    console.error('Startup migration failed (continuing anyway):', (err as Error).message);
  }
}

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    // A missing URI is a config mistake, not a transient fault — retrying is pointless.
    console.error('MONGODB_URI is not set. Add it to backend/.env.');
    process.exit(1);
  }

  // Mongoose buffers queries while disconnected and auto-reconnects; these
  // listeners just make what is happening visible in the terminal.
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected — reconnecting in the background'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', (err as Error).message));

  for (let attempt = 1; ; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log('Connected to MongoDB');
      await runStartupMigrations();
      return;
    } catch (err) {
      const waitMs = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
      console.error(
        `MongoDB connection attempt ${attempt} failed (${(err as Error).message}). Retrying in ${waitMs / 1000}s…`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
