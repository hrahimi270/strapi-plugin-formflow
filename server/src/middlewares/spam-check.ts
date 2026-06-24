import type { Core } from '@strapi/strapi';

/**
 * IP/country blocklist configuration stored under `settings.spam.ipBlocklist`.
 *
 * Declared locally (structurally identical to the EE `IpBlocklistConfig`) so this
 * MIT middleware type-checks when the `ee/` tree is stripped — the runtime
 * blocklist evaluator is imported lazily and guarded below.
 */
interface IpBlocklistConfig {
  /** Exact IPv4/IPv6 addresses to block. */
  ips?: string[];
  /**
   * ISO-3166-1 alpha-2 codes to block. Matched case-insensitively against the
   * country resolved from a request header (e.g. `cf-ipcountry`) — no GeoIP DB.
   */
  countryCodes?: string[];
}

/**
 * The slice of the EE spam module the middleware lazily delegates to. Declared
 * locally (structurally identical to the EE exports) so this MIT middleware
 * type-checks when the `ee/` tree is stripped — never a `typeof import('../ee')`.
 */
interface EeSpamModule {
  verifyTurnstile(token: string, secretKey: string, signal: AbortSignal): Promise<boolean>;
  verifyHcaptcha(token: string, secretKey: string, signal: AbortSignal): Promise<boolean>;
  evaluateIpBlocklist(ip: string, blocklist: IpBlocklistConfig, country?: string): boolean;
}

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
 * Cloudflare Turnstile configuration (server-side, includes the secret key)
 */
export interface TurnstileConfig {
  enabled: boolean;
  siteKey?: string;
  secretKey?: string;
}

/**
 * hCaptcha configuration (server-side, includes the secret key)
 */
export interface HcaptchaConfig {
  enabled: boolean;
  siteKey?: string;
  secretKey?: string;
}

/**
 * Spam protection settings read from the form configuration
 */
export interface SpamCheckSettings {
  honeypot?: boolean;
  honeypotFieldName?: string;
  recaptcha?: SpamCheckRecaptchaConfig;
  turnstile?: TurnstileConfig;
  hcaptcha?: HcaptchaConfig;
  ipBlocklist?: IpBlocklistConfig;
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
    headers: Record<string, string | string[] | undefined>;
  };
  status: number;
  body: unknown;
  badRequest: (message?: string, details?: unknown) => unknown;
  /** Koa-resolved client IP, used by the Pro IP blocklist provider. */
  ip?: string;
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
 * Timeout (ms) for the reCAPTCHA siteverify request. A hung Google request must
 * not hold the submission open indefinitely; mirrors the webhook service.
 */
const RECAPTCHA_TIMEOUT_MS = 5000;

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
 *
 * Three additional Pro providers — Cloudflare Turnstile, hCaptcha and an
 * IP blocklist — run after reCAPTCHA, each gated by its own `can(...)` license
 * check. A missing entitlement skips the provider entirely (never a 400), so the
 * server behaves like the provider was simply not configured.
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
        .plugin('formflow')
        .service('form')
        .findBySlug(slug)) as SpamCheckForm | null;
    } catch (error) {
      strapi.log.error('[FormFlow] spam-check middleware: failed to load form', error);
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
        strapi.log.info(`[FormFlow] Honeypot triggered for form: ${slug}`);

        // Silently pretend success without storing the submission. Mirror the
        // real submit-success body EXACTLY (see public.submitForm) — same keys,
        // including a normalized `redirectUrl` — so a bot cannot fingerprint the
        // honeypot path by a missing key.
        ctx.status = 200;
        ctx.body = {
          data: {
            success: true,
            message: form.successMessage || 'Thank you for your submission',
            redirectUrl: form.redirectUrl ?? null,
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
          `[FormFlow] reCAPTCHA enabled but no secretKey configured for form: ${slug}`
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

        // Abort the verification request if Google does not respond in time so a
        // hung siteverify call cannot stall the submission. Fail closed below.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), RECAPTCHA_TIMEOUT_MS);

        const response = await fetch(RECAPTCHA_VERIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          strapi.log.warn(
            `[FormFlow] reCAPTCHA siteverify returned HTTP ${response.status} for form "${slug}"`
          );
          return ctx.badRequest('reCAPTCHA verification failed');
        }

        const result = (await response.json()) as RecaptchaVerifyResponse;

        if (!result.success) {
          strapi.log.warn(
            `[FormFlow] reCAPTCHA verification failed for form "${slug}": ${
              (result['error-codes'] || []).join(', ') || 'unknown'
            }`
          );
          return ctx.badRequest('reCAPTCHA verification failed');
        }

        // For v3, enforce the score threshold. Score enforcement is a Pro feature
        // (spam.recaptchaV3); token verification above (result.success) stays free
        // and always runs. When not entitled, a successfully-verified v3 token
        // proceeds regardless of score — never a 400 based solely on entitlement.
        if (
          spam.recaptcha.version === 'v3' &&
          strapi.plugin('formflow').service('license').can('spam.recaptchaV3')
        ) {
          const threshold =
            typeof spam.recaptcha.threshold === 'number'
              ? spam.recaptcha.threshold
              : DEFAULT_V3_THRESHOLD;
          const score = typeof result.score === 'number' ? result.score : 0;

          if (score < threshold) {
            strapi.log.warn(
              `[FormFlow] reCAPTCHA v3 score ${score} below threshold ${threshold} for form "${slug}"`
            );
            return ctx.badRequest('reCAPTCHA verification failed: low score');
          }
        }
      } catch (error) {
        // Fail closed on any error, including the AbortError raised when the
        // siteverify request exceeds RECAPTCHA_TIMEOUT_MS.
        strapi.log.error('[FormFlow] reCAPTCHA verification error', error);
        return ctx.badRequest('reCAPTCHA verification failed');
      }

      // Remove the token from the body so it never reaches validation/storage.
      delete body.recaptchaToken;
      delete body['g-recaptcha-response'];
    }

    // Pro spam providers. Look up the license wrapper once for all three blocks;
    // each block is gated by its own `can(...)`. A missing entitlement skips the
    // block (fall through), never a rejection.
    const licenseService = strapi.plugin('formflow').service('license');

    // Lazily load the EE spam providers once, only when at least one Pro spam
    // block could run (i.e. the license entitles it). In a stripped MIT fork the
    // import throws MODULE_NOT_FOUND, which we swallow → `ee` stays null and every
    // Pro block below falls through (free behaviour), never a rejection. Because
    // `can(...)` is false when EE is stripped, this load is in practice only ever
    // reached when the module is present.
    let ee: EeSpamModule | null = null;
    if (
      licenseService.can('spam.turnstile') ||
      licenseService.can('spam.hcaptcha') ||
      licenseService.can('spam.ipBlocklist')
    ) {
      try {
        ee = (await import('../ee/spam/index')) as EeSpamModule;
      } catch {
        ee = null;
      }
    }

    // (d) Cloudflare Turnstile
    if (ee && licenseService.can('spam.turnstile') && spam?.turnstile?.enabled) {
      const { secretKey } = spam.turnstile;

      if (!secretKey) {
        strapi.log.error(`[FormFlow] Turnstile enabled but no secretKey for form: ${slug}`);
        return ctx.badRequest('Turnstile is misconfigured');
      }

      const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
      if (!token) {
        return ctx.badRequest('Turnstile verification failed: missing token');
      }

      // Abort the verification if Cloudflare does not respond in time. The
      // provider swallows the AbortError and returns false (fail closed).
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), RECAPTCHA_TIMEOUT_MS);
      const passed = await ee.verifyTurnstile(token, secretKey, controller.signal);
      clearTimeout(timeoutId);

      if (!passed) {
        strapi.log.warn(`[FormFlow] Turnstile verification failed for form "${slug}"`);
        return ctx.badRequest('Turnstile verification failed');
      }

      delete body.turnstileToken;
    }

    // (e) hCaptcha
    if (ee && licenseService.can('spam.hcaptcha') && spam?.hcaptcha?.enabled) {
      const { secretKey } = spam.hcaptcha;

      if (!secretKey) {
        strapi.log.error(`[FormFlow] hCaptcha enabled but no secretKey for form: ${slug}`);
        return ctx.badRequest('hCaptcha is misconfigured');
      }

      const token = typeof body['h-captcha-response'] === 'string' ? body['h-captcha-response'] : '';
      if (!token) {
        return ctx.badRequest('hCaptcha verification failed: missing token');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), RECAPTCHA_TIMEOUT_MS);
      const passed = await ee.verifyHcaptcha(token, secretKey, controller.signal);
      clearTimeout(timeoutId);

      if (!passed) {
        strapi.log.warn(`[FormFlow] hCaptcha verification failed for form "${slug}"`);
        return ctx.badRequest('hCaptcha verification failed');
      }

      delete body['h-captcha-response'];
    }

    // (f) IP / country blocklist. Like the honeypot, a blocked IP or country
    // gets a silent fake success — never a 400 — so an attacker cannot detect
    // the block.
    if (ee && licenseService.can('spam.ipBlocklist') && spam?.ipBlocklist) {
      const submitterIp = ctx.ip ?? '';

      // Resolve the country from an upstream-proxy header (Cloudflare/Vercel/
      // generic), not a GeoIP DB. A header may arrive as string[]; take the
      // first value. No header → undefined → the country match is skipped.
      const headers = ctx.request.headers;
      const headerValue = (name: string): string | undefined => {
        const raw = headers[name];
        return Array.isArray(raw) ? raw[0] : raw;
      };
      const country =
        headerValue('cf-ipcountry') ??
        headerValue('x-country-code') ??
        headerValue('x-vercel-ip-country');

      if (
        (submitterIp || country) &&
        ee.evaluateIpBlocklist(submitterIp, spam.ipBlocklist, country)
      ) {
        strapi.log.info(
          `[FormFlow] IP/country blocklist triggered for form "${slug}", ip: ${submitterIp}, country: ${country ?? 'n/a'}`
        );
        ctx.status = 200;
        ctx.body = {
          data: {
            success: true,
            message: form.successMessage || 'Thank you for your submission',
            redirectUrl: form.redirectUrl ?? null,
          },
        };
        return;
      }
    }

    return next();
  };
};

export default spamCheck;
