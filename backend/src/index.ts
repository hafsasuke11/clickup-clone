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

const app = express();
const PORT = process.env.PORT ?? 3001;

app.set('trust proxy', 1); // behind a load balancer / reverse proxy in production
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json({ limit: '100kb' }));

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

app.use('/api/auth/login', authLimiter);
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

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
});
