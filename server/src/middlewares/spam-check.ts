import type { Core } from '@strapi/strapi';

/**
 * reCAPTCHA configuration (server-side, includes the secret key)
 */
export interface SpamCheckRecaptchaConfig {
  enabled: boolean;
  siteKey?: string;
  secretKey?: string;
  version?: 'v2' | 'v3';
  threshold?: number;
}

/**
 * Spam protection settings read from the form configuration
 */
export interface SpamCheckSettings {
  honeypot?: boolean;
  honeypotFieldName?: string;
  recaptcha?: SpamCheckRecaptchaConfig;
}

/**
 * Minimal form shape needed for spam checking
 */
export interface SpamCheckForm {
  successMessage?: string;
  redirectUrl?: string;
  settings?: {
    spam?: SpamCheckSettings;
  };
}

/**
 * Koa context shape used by the spam-check middleware
 */
export interface SpamCheckContext {
  params: { slug?: string };
  request: {
    body: Record<string, unknown>;
  };
  status: number;
  body: unknown;
  badRequest: (message?: string, details?: unknown) => unknown;
}

/**
 * Google reCAPTCHA verification endpoint
 */
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/**
 * Default score threshold for reCAPTCHA v3
 */
const DEFAULT_V3_THRESHOLD = 0.5;

/**
 * Shape of Google's reCAPTCHA siteverify response
 */
interface RecaptchaVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

/**
 * spam-check middleware factory
 *
 * Runs on POST /api/forms/:slug/submit BEFORE the submission controller.
 * Handles two spam defenses, keeping the submission service focused on
 * validate + store + hooks:
 *
 * 1. Honeypot: if the configured honeypot field is non-empty, silently returns
 *    a fake success (200) without storing anything, so bots cannot detect they
 *    were caught.
 * 2. reCAPTCHA: if enabled, verifies the token with Google. For v3, enforces a
 *    minimum score threshold. On failure responds with 400 (bad request).
 *
 * The reCAPTCHA secret key is read from form settings server-side and is never
 * exposed to clients.
 */
const spamCheck = (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: SpamCheckContext, next: () => Promise<void>): Promise<unknown> => {
    const { slug } = ctx.params;

    // Without a slug we cannot load form settings; let downstream handle it.
    if (!slug) {
      return next();
    }

    let form: SpamCheckForm | null = null;
    try {
      form = (await strapi
        .plugin('strapi-forms')
        .service('form')
        .findBySlug(slug)) as SpamCheckForm | null;
    } catch (error) {
      strapi.log.error('[Strapi Forms] spam-check middleware: failed to load form', error);
      // Fail open: let the controller/policies decide what to do.
      return next();
    }

    // No published form -> let the policy/controller produce the 404.
    if (!form) {
      return next();
    }

    const spam = form.settings?.spam;
    const body = (ctx.request.body || {}) as Record<string, unknown>;

    // (b) Honeypot check
    if (spam?.honeypot) {
      const honeypotFieldName = spam.honeypotFieldName || '_gotcha';
      const honeypotValue = body[honeypotFieldName];

      if (typeof honeypotValue === 'string' ? honeypotValue.trim() !== '' : !!honeypotValue) {
        strapi.log.info(`[Strapi Forms] Honeypot triggered for form: ${slug}`);

        // Silently pretend success without storing the submission.
        ctx.status = 200;
        ctx.body = {
          data: {
            success: true,
            message: form.successMessage || 'Thank you for your submission',
            ...(form.redirectUrl ? { redirectUrl: form.redirectUrl } : {}),
          },
        };
        return;
      }
    }

    // (c) reCAPTCHA verification
    if (spam?.recaptcha?.enabled) {
      const secret = spam.recaptcha.secretKey;

      if (!secret) {
        strapi.log.error(
          `[Strapi Forms] reCAPTCHA enabled but no secretKey configured for form: ${slug}`
        );
        return ctx.badRequest('reCAPTCHA is misconfigured');
      }

      const token =
        (typeof body.recaptchaToken === 'string' && body.recaptchaToken) ||
        (typeof body['g-recaptcha-response'] === 'string' && body['g-recaptcha-response']) ||
        '';

      if (!token) {
        return ctx.badRequest('reCAPTCHA verification failed: missing token');
      }

      try {
        const params = new URLSearchParams();
        params.append('secret', secret);
        params.append('response', token);

        const response = await fetch(RECAPTCHA_VERIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        const result = (await response.json()) as RecaptchaVerifyResponse;

        if (!result.success) {
          strapi.log.warn(
            `[Strapi Forms] reCAPTCHA verification failed for form "${slug}": ${
              (result['error-codes'] || []).join(', ') || 'unknown'
            }`
          );
          return ctx.badRequest('reCAPTCHA verification failed');
        }

        // For v3, enforce the score threshold.
        if (spam.recaptcha.version === 'v3') {
          const threshold =
            typeof spam.recaptcha.threshold === 'number'
              ? spam.recaptcha.threshold
              : DEFAULT_V3_THRESHOLD;
          const score = typeof result.score === 'number' ? result.score : 0;

          if (score < threshold) {
            strapi.log.warn(
              `[Strapi Forms] reCAPTCHA v3 score ${score} below threshold ${threshold} for form "${slug}"`
            );
            return ctx.badRequest('reCAPTCHA verification failed: low score');
          }
        }
      } catch (error) {
        strapi.log.error('[Strapi Forms] reCAPTCHA verification error', error);
        return ctx.badRequest('reCAPTCHA verification failed');
      }

      // Remove the token from the body so it never reaches validation/storage.
      delete body.recaptchaToken;
      delete body['g-recaptcha-response'];
    }

    return next();
  };
};

export default spamCheck;
