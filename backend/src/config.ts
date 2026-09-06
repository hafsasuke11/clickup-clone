/**
 * Centralised runtime configuration and safety checks.
 * Imported early (via the route modules) so `dotenv/config` has already run.
 */

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
