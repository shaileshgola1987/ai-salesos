const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET'];

/** Secrets that ship with a working dev default so the app runs with zero setup — but must
 * never reach production still set to that default (PRD §18 Security hardening). */
const INSECURE_PRODUCTION_DEFAULTS: Record<string, string> = {
  JWT_SECRET: 'dev-secret-change-me',
  PLATFORM_JWT_SECRET: 'dev-platform-secret-change-me',
  PLATFORM_SECRET: 'dev-secret-change-me',
};

/** Fails fast on boot rather than running with a broken or insecure configuration. */
export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
  }

  if (process.env.NODE_ENV !== 'production') return;

  for (const [key, insecureValue] of Object.entries(
    INSECURE_PRODUCTION_DEFAULTS,
  )) {
    if (process.env[key] === insecureValue) {
      throw new Error(
        `${key} is still set to its development default — set a real secret before running in production.`,
      );
    }
  }
}
