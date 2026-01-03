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
 */
export interface RateLimitPolicyContext {
  params: Record<string, string>;
  request: {
    ip: string;
    headers: Record<string, string | string[] | undefined>;
  };
  status: number;
  body: unknown;
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
 * Start the periodic cleanup of expired rate limit entries
 * This prevents memory leaks from accumulated old entries
 */
const startCleanupInterval = (): void => {
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

// Start cleanup on module load
startCleanupInterval();

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
 * policies: ['plugin::strapi-forms.rate-limit']
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
      .plugin('strapi-forms')
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
        `[Strapi Forms] Invalid rate limit settings for form "${slug}": ` +
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
        `[Strapi Forms] Rate limit exceeded for form "${slug}" from IP ${ip}. ` +
          `Count: ${record.count}/${maxSubmissions}, retry after: ${retryAfterSeconds}s`
      );

      // Set response status and body
      policyContext.status = 429;
      policyContext.body = {
        error: {
          status: 429,
          name: 'TooManyRequestsError',
          message: 'Too many submissions. Please try again later.',
          details: {
            retryAfter: retryAfterSeconds,
          },
        },
      };

      return false;
    }

    return true;
  } catch (error) {
    // Log error but allow request (fail open)
    // This ensures the form remains usable even if rate limiting breaks
    strapi.log.error('[Strapi Forms] rate-limit policy error:', error);
    return true;
  }
};

export default rateLimitPolicy;
