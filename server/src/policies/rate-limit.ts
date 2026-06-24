import type { Core } from '@strapi/strapi';

/**
 * Rate limit record stored per form+IP combination
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * Rate limit settings from form configuration
 */
interface RateLimitSettings {
  enabled: boolean;
  maxSubmissions: number;
  windowMs: number;
}

/**
 * Form structure with rate limit settings
 */
interface FormWithRateLimit {
  documentId: string;
  slug: string;
  settings?: {
    rateLimit?: RateLimitSettings;
  };
}

/**
 * Policy context interface for rate limit policy
 *
 * Note: at runtime this is Object.assign({ is, type }, koa-ctx). Only the koa
 * ctx's OWN properties survive that copy — the convenience methods `set`/`throw`
 * live on the koa context PROTOTYPE and are NOT present here. The koa `response`
 * object IS an own property, so headers are set via `response.set`. To signal
 * HTTP 429 we throw a RateLimitHttpError carrying `status: 429` (mapped to 429 by
 * Strapi's error middleware via http-errors), not a non-existent `policyContext.throw`.
 */
export interface RateLimitPolicyContext {
  params: Record<string, string>;
  request: {
    ip: string;
    headers: Record<string, string | string[] | undefined>;
  };
  /** Koa response object (own property) — used to set the Retry-After header */
  response: {
    set(header: string, value: string): void;
  };
}

/**
 * HTTP error thrown when a form's rate limit is exceeded. It carries an explicit
 * `status: 429` + `expose: true`; Strapi's error middleware routes unknown error
 * instances through `formatInternalError` → http-errors `createError(err)`, which
 * preserves the pre-set status, yielding a correct HTTP 429. We use a LOCAL class
 * (not `@strapi/utils`' RateLimitError) because the plugin bundle ships its own
 * copy of `@strapi/utils`, so a bundled `RateLimitError` fails core's
 * `instanceof ApplicationError` check and falls through to a generic HTTP 500.
 */
class RateLimitHttpError extends Error {
  status = 429;

  statusCode = 429;

  expose = true;

  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * In-memory rate limit store
 * Maps form:ip keys to rate limit records
 *
 * Note: In production multi-instance deployments, consider using Redis
 * for distributed rate limiting across instances
 */
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Cleanup interval in milliseconds (1 minute)
 */
const CLEANUP_INTERVAL_MS = 60000;

/**
 * Reference to the cleanup interval timer
 * Stored to allow cleanup on module unload if needed
 */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic cleanup of expired rate limit entries.
 * This prevents memory leaks from accumulated old entries.
 *
 * Called from the plugin bootstrap so the timer's lifecycle is tied to the
 * Strapi instance (and cleared in destroy) rather than to module load.
 */
export const startRateLimitCleanup = (): void => {
  if (cleanupInterval) return; // Already running

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent Node.js from exiting
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
};

/**
 * Stop the periodic cleanup timer. Called from the plugin destroy hook.
 */
export const stopRateLimitCleanup = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

/**
 * Extract client IP address from request
 * Handles proxy headers (x-forwarded-for) for accurate IP detection
 *
 * @param ctx - Policy context with request info
 * @returns Client IP address string
 */
const getClientIp = (ctx: RateLimitPolicyContext): string => {
  // Check x-forwarded-for header first (common in proxy/load balancer setups)
  const forwardedFor = ctx.request.headers['x-forwarded-for'];

  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const firstIp = ips.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  // Fall back to direct IP
  return ctx.request.ip || 'unknown';
};

/**
 * Rate limit policy
 *
 * Prevents abuse by limiting the number of form submissions from a single
 * IP address within a configurable time window. Rate limiting is configured
 * per-form in the form settings.
 *
 * Usage in routes:
 * ```
 * policies: ['plugin::formflow.rate-limit']
 * ```
 *
 * Form settings example:
 * ```json
 * {
 *   "settings": {
 *     "rateLimit": {
 *       "enabled": true,
 *       "maxSubmissions": 5,
 *       "windowMs": 60000
 *     }
 *   }
 * }
 * ```
 *
 * @param policyContext - Context containing route params and request info
 * @param _config - Policy configuration (unused)
 * @param strapi - Strapi instance
 * @returns true to allow request, false to block
 */
const rateLimitPolicy = async (
  policyContext: RateLimitPolicyContext,
  _config: unknown,
  { strapi }: { strapi: Core.Strapi }
): Promise<boolean> => {
  const { slug } = policyContext.params;

  // No slug means we can't look up form settings
  if (!slug) {
    return true;
  }

  try {
    // Get form to check rate limit settings
    const form = (await strapi
      .plugin('formflow')
      .service('form')
      .findBySlug(slug)) as FormWithRateLimit | null;

    // If no form found or rate limiting not configured/enabled, allow
    if (!form?.settings?.rateLimit?.enabled) {
      return true;
    }

    const { maxSubmissions, windowMs } = form.settings.rateLimit;

    // Validate rate limit settings
    if (!maxSubmissions || maxSubmissions <= 0 || !windowMs || windowMs <= 0) {
      strapi.log.warn(
        `[FormFlow] Invalid rate limit settings for form "${slug}": ` +
          `maxSubmissions=${maxSubmissions}, windowMs=${windowMs}`
      );
      return true;
    }

    const ip = getClientIp(policyContext);
    const key = `${slug}:${ip}`;
    const now = Date.now();

    // Get or create rate limit record
    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      // Create new record - window has expired or first request
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, record);
      return true;
    }

    // Increment count for existing window
    record.count++;

    // Check if over limit
    if (record.count > maxSubmissions) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);

      strapi.log.warn(
        `[FormFlow] Rate limit exceeded for form "${slug}" from IP ${ip}. ` +
          `Count: ${record.count}/${maxSubmissions}, retry after: ${retryAfterSeconds}s`
      );

      // Set Retry-After so clients know when to retry. `response` is an own
      // property of the koa ctx, so `response.set` survives createPolicyContext
      // (unlike the prototype `ctx.set`, which is dropped by Object.assign).
      policyContext.response.set('Retry-After', String(retryAfterSeconds));

      // Throw a 429-carrying error — Strapi maps it to HTTP 429 via
      // formatInternalError + http-errors (which preserves the pre-set status).
      // Returning false would emit a generic 403 PolicyError; the earlier
      // `policyContext.throw(429,...)` silently failed because `throw` is a koa
      // prototype method absent from the Object.assign-built policy context.
      throw new RateLimitHttpError('Too many submissions. Please try again later.');
    }

    return true;
  } catch (error) {
    // Re-throw the intentional rate-limit rejection so it surfaces as HTTP 429;
    // only UNEXPECTED errors fail open (so a broken limiter never blocks forms).
    if (error instanceof RateLimitHttpError) {
      throw error;
    }
    strapi.log.error('[FormFlow] rate-limit policy error:', error);
    return true;
  }
};

export default rateLimitPolicy;
