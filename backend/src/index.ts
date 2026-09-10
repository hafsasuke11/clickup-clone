import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB, CORS_ORIGINS, IS_PRODUCTION } from './config.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import inviteRoutes from './routes/invites.js';
import { requireAuth } from './middleware/requireAuth.js';

// Last-resort safety net. In development, log an unexpected error but keep the
// server running so one bad request or a momentary database blip never leaves
// the frontend showing "Failed to fetch". In production, log and exit so a
// process manager can restart from a known-good state.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  if (IS_PRODUCTION) process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  if (IS_PRODUCTION) process.exit(1);
});

const app = express();
const PORT = process.env.PORT ?? 3001;

app.set('trust proxy', 1); // behind a load balancer / reverse proxy in production
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));

// Every endpoint takes a small JSON body, except the task attachment upload,
// which carries a base64 file (capped at 5 MB → ~6.7 MB encoded). Route that one
// path through a larger parser and keep the tight 100 kb limit everywhere else.
const jsonSmall = express.json({ limit: '100kb' });
const jsonLarge = express.json({ limit: '10mb' });
const isAttachmentUpload = (req: Request) =>
  req.method === 'POST' && /\/tasks\/[^/]+\/attachments\/?$/.test(req.path);
app.use((req, res, next) => (isAttachmentUpload(req) ? jsonLarge : jsonSmall)(req, res, next));

// Throttle credential endpoints. Only failed attempts count toward the limit,
// so ordinary users are never blocked but brute-force / stuffing is stopped.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth/login', authLimiter); // also covers /api/auth/login/2fa
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', requireAuth, workspaceRoutes);
app.use('/api/invites', inviteRoutes);

// Central error handler — Express 5 forwards async route rejections here.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  const status =
    typeof err === 'object' && err !== null && typeof (err as { status?: number }).status === 'number'
      ? (err as { status: number }).status
      : 500;
  const message =
    !IS_PRODUCTION && err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  res.status(status).json({ error: message });
});

// Start listening right away so the API is reachable even while MongoDB is still
// coming online. connectDB() keeps retrying in the background and Mongoose
// queues queries until the connection is ready.
const server = app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

// A listen failure (port already in use, etc.) is not something to recover
// from — exit loudly instead of letting the uncaughtException net below swallow
// it and leave a half-dead process holding no port.
server.on('error', (err) => {
  console.error('HTTP server failed to start:', err);
  process.exit(1);
});

void connectDB();
