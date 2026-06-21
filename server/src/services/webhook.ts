import type { Core } from '@strapi/strapi';
import crypto from 'crypto';

/**
 * Webhook event types
 */
export type WebhookEvent = 'submission.created' | 'submission.updated' | 'submission.deleted';

/**
 * Webhook configuration from form settings
 */
export interface WebhookConfig {
  enabled: boolean;
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  events?: WebhookEvent[];
  includeFormData?: boolean;
  secret?: string;
  timeout?: number;
}

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  form: {
    id: string;
    title: string;
    slug: string;
  };
  submission: {
    id: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
    data?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Form context for webhook payload
 */
export interface WebhookFormContext {
  documentId: string;
  title: string;
  slug: string;
}

/**
 * Submission context for webhook payload
 */
export interface WebhookSubmissionContext {
  documentId: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Result of triggering a webhook
 */
export interface WebhookTriggerResult {
  success: boolean;
  url?: string;
  status?: number;
  error?: string;
  duration?: number;
  /**
   * Number of delivery attempts made (1 = succeeded/failed on first try).
   * Only populated by the retrying delivery path.
   */
  attempts?: number;
}

/**
 * Outcome of a single delivery attempt, used internally by the retry loop to
 * decide whether another attempt is worthwhile.
 */
export interface WebhookAttemptOutcome {
  /** True when the endpoint accepted the delivery (2xx). */
  success: boolean;
  /** True when the failure is transient and another attempt may succeed. */
  retryable: boolean;
  /** HTTP status code, when a response was received. */
  status?: number;
  /** Human-readable error/status message. */
  error?: string;
  /** Wall-clock duration of the attempt in milliseconds. */
  duration: number;
  /**
   * Server-requested delay before the next attempt in milliseconds, parsed
   * from a `Retry-After` header (429/503). Undefined when not provided.
   */
  retryAfterMs?: number;
}

/**
 * Default timeout for webhook requests (10 seconds)
 */
const DEFAULT_TIMEOUT = 10000;

/**
 * Maximum timeout allowed (30 seconds)
 */
const MAX_TIMEOUT = 30000;

/**
 * User agent for webhook requests
 */
const USER_AGENT = 'Strapi-Forms-Webhook/1.0';

/**
 * Backoff schedule (in milliseconds) applied BEFORE each retry. The first
 * delivery attempt fires immediately; if it fails with a retryable error the
 * Nth retry waits BACKOFF_SCHEDULE_MS[N-1] (plus jitter) before firing.
 *
 * Schedule: ~1s, 5s, 30s, 2m, 10m -> 5 retries on top of the initial attempt
 * for a maximum of 6 total attempts. Mirrors the cadence in gap-analysis.md.
 */
const BACKOFF_SCHEDULE_MS = [1000, 5000, 30000, 120000, 600000];

/**
 * Maximum number of delivery attempts (initial attempt + retries).
 */
const MAX_ATTEMPTS = BACKOFF_SCHEDULE_MS.length + 1;

/**
 * Upper bound on any single backoff delay, including a server-supplied
 * Retry-After. Prevents a misbehaving endpoint from parking a retry timer for
 * an unbounded amount of time.
 */
const MAX_BACKOFF_MS = 600000; // 10 minutes

/**
 * Jitter factor applied to each backoff delay (+/- 20%). Spreads retries so a
 * burst of failed deliveries does not stampede a recovering endpoint.
 */
const JITTER_RATIO = 0.2;

/**
 * Cap on the number of webhook deliveries that may be retrying in the
 * background at once. Each in-flight retry holds a timer and (eventually) an
 * open socket; this bounds memory/connection pressure if many endpoints fail
 * simultaneously. Deliveries beyond the cap are dropped (logged) rather than
 * queued, since durable persistence is out of scope for this pass.
 */
const MAX_INFLIGHT_RETRIES = 100;

/**
 * HTTP statuses that are retryable even though they fall in the 4xx range.
 * 408 = Request Timeout, 429 = Too Many Requests.
 */
const RETRYABLE_4XX = new Set([408, 429]);

/**
 * Process-wide counter of webhook deliveries currently waiting to retry.
 * Module-scoped so it is shared across every service invocation within the
 * process (the service factory runs per call site).
 */
let inflightRetries = 0;

/**
 * Sleep helper used to space out retry attempts.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Don't keep the event loop alive solely for a pending retry timer.
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  });
}

/**
 * Apply +/- JITTER_RATIO jitter to a base delay and clamp to MAX_BACKOFF_MS.
 */
function withJitter(baseMs: number): number {
  const jitter = baseMs * JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.min(Math.max(0, Math.round(baseMs + jitter)), MAX_BACKOFF_MS);
}

/**
 * Parse a `Retry-After` header value into milliseconds. Supports both the
 * delta-seconds form ("120") and the HTTP-date form. Returns undefined when
 * absent or unparseable.
 */
function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined;
  }

  const trimmed = headerValue.trim();

  // delta-seconds form
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_BACKOFF_MS);
  }

  // HTTP-date form
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    if (diff > 0) {
      return Math.min(diff, MAX_BACKOFF_MS);
    }
    return 0;
  }

  return undefined;
}

/**
 * Webhook service for triggering HTTP callbacks on form events
 * Supports HMAC signature verification, custom headers, and parallel execution
 */
const webhookService = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Trigger a single webhook for an event.
   *
   * Performs a SINGLE delivery attempt and returns its result. This preserves
   * the original contract used by `sendTest` and any direct callers; the retry
   * loop lives in `triggerWithRetry` and wraps this method's underlying
   * attempt logic. The retryable-status policy is exposed via the returned
   * `WebhookTriggerResult` for callers that don't need retries.
   */
  async trigger(
    config: WebhookConfig,
    event: WebhookEvent,
    form: WebhookFormContext,
    submission: WebhookSubmissionContext,
    data?: Record<string, unknown>
  ): Promise<WebhookTriggerResult> {
    // Validate configuration
    if (!config.enabled) {
      return { success: true, url: config.url };
    }

    if (!config.url) {
      strapi.log.warn('[Strapi Forms] Webhook skipped: no URL configured');
      return { success: false, error: 'No URL configured' };
    }

    // Check if this webhook is subscribed to this event
    const events = config.events || ['submission.created'];
    if (!events.includes(event)) {
      return { success: true, url: config.url };
    }

    // Validate URL
    if (!this.isValidUrl(config.url)) {
      strapi.log.warn(`[Strapi Forms] Webhook skipped: invalid URL "${config.url}"`);
      return { success: false, url: config.url, error: 'Invalid URL' };
    }

    const outcome = await this.attemptDelivery(config, event, form, submission, data, 1);

    return {
      success: outcome.success,
      url: config.url,
      status: outcome.status,
      error: outcome.error,
      duration: outcome.duration,
      attempts: 1,
    };
  },

  /**
   * Perform a single HTTP delivery attempt and classify the outcome so the
   * retry loop can decide whether to try again. Keeps the existing per-attempt
   * AbortController timeout intact.
   *
   * Retryable: network errors, timeouts, 5xx, 408, 429.
   * Non-retryable: all other 4xx (bad request, auth, etc.).
   */
  async attemptDelivery(
    config: WebhookConfig,
    event: WebhookEvent,
    form: WebhookFormContext,
    submission: WebhookSubmissionContext,
    data: Record<string, unknown> | undefined,
    attempt: number
  ): Promise<WebhookAttemptOutcome> {
    const startTime = Date.now();

    // Build payload
    const includeData = config.includeFormData !== false; // Default to true
    const payload = this.buildPayload(event, form, submission, data, includeData);

    // Build headers
    const headers = this.buildHeaders(config, payload);

    // Prepare request options
    const method = config.method || 'POST';
    const timeout = Math.min(config.timeout || DEFAULT_TIMEOUT, MAX_TIMEOUT);

    // Create abort controller for per-attempt timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(config.url, {
        method,
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      if (response.ok) {
        strapi.log.info(
          `[Strapi Forms] Webhook delivered: ${config.url} - Event: ${event} - ` +
            `Status: ${response.status} - Attempt ${attempt}/${MAX_ATTEMPTS} (${duration}ms)`
        );
        return { success: true, retryable: false, status: response.status, duration };
      }

      const status = response.status;
      const retryable = status >= 500 || RETRYABLE_4XX.has(status);
      const errorMessage = `HTTP ${status}: ${response.statusText}`;
      const retryAfterMs =
        status === 429 || status === 503
          ? parseRetryAfter(response.headers.get('retry-after'))
          : undefined;

      strapi.log.warn(
        `[Strapi Forms] Webhook returned error: ${config.url} - ${errorMessage} - ` +
          `Attempt ${attempt}/${MAX_ATTEMPTS} - ${retryable ? 'retryable' : 'non-retryable'} (${duration}ms)`
      );

      return { success: false, retryable, status, error: errorMessage, duration, retryAfterMs };
    } catch (error) {
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      const isAbort = error instanceof Error && error.name === 'AbortError';
      const errorMessage = isAbort
        ? `Request timeout after ${timeout}ms`
        : error instanceof Error
          ? error.message
          : 'Unknown error';

      // Network errors and timeouts are transient -> retryable.
      strapi.log.warn(
        `[Strapi Forms] Webhook attempt failed: ${config.url} - ${errorMessage} - ` +
          `Attempt ${attempt}/${MAX_ATTEMPTS} - retryable (${duration}ms)`
      );

      return { success: false, retryable: true, error: errorMessage, duration };
    }
  },

  /**
   * Deliver a single webhook with in-process exponential backoff.
   *
   * The first attempt fires immediately. On a retryable failure it waits the
   * scheduled backoff (with jitter, or a server-supplied Retry-After when
   * larger) and tries again, up to MAX_ATTEMPTS total. Non-retryable failures
   * (most 4xx) stop immediately. The returned result reflects the final
   * attempt and the total number of attempts made.
   *
   * This is async but intended to run in the background (see `triggerAll`); it
   * never throws, so a fire-and-forget caller cannot be broken by a rejection.
   */
  async triggerWithRetry(
    config: WebhookConfig,
    event: WebhookEvent,
    form: WebhookFormContext,
    submission: WebhookSubmissionContext,
    data?: Record<string, unknown>
  ): Promise<WebhookTriggerResult> {
    let lastOutcome: WebhookAttemptOutcome = {
      success: false,
      retryable: false,
      duration: 0,
      error: 'Webhook not attempted',
    };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      lastOutcome = await this.attemptDelivery(config, event, form, submission, data, attempt);

      if (lastOutcome.success) {
        return {
          success: true,
          url: config.url,
          status: lastOutcome.status,
          duration: lastOutcome.duration,
          attempts: attempt,
        };
      }

      // Stop on non-retryable failures or once attempts are exhausted.
      if (!lastOutcome.retryable || attempt >= MAX_ATTEMPTS) {
        break;
      }

      // Backoff for this retry. A server-supplied Retry-After takes precedence
      // when it asks for a longer wait than our schedule.
      const scheduled = withJitter(BACKOFF_SCHEDULE_MS[attempt - 1]);
      const waitMs =
        lastOutcome.retryAfterMs !== undefined
          ? Math.min(Math.max(lastOutcome.retryAfterMs, scheduled), MAX_BACKOFF_MS)
          : scheduled;

      strapi.log.info(
        `[Strapi Forms] Webhook retry scheduled: ${config.url} - ` +
          `next attempt ${attempt + 1}/${MAX_ATTEMPTS} in ${waitMs}ms`
      );

      await delay(waitMs);
    }

    strapi.log.error(
      `[Strapi Forms] Webhook delivery exhausted: ${config.url} - ` +
        `${lastOutcome.error || 'Unknown error'} after ${
          lastOutcome.retryable ? MAX_ATTEMPTS : 'non-retryable'
        } attempt(s)`
    );

    return {
      success: false,
      url: config.url,
      status: lastOutcome.status,
      error: lastOutcome.error,
      duration: lastOutcome.duration,
      attempts: MAX_ATTEMPTS,
    };
  },

  /**
   * Dispatch a webhook delivery (with retry) in the background.
   *
   * Returns immediately; the retry loop runs detached so it can never delay or
   * fail the form submission. Honors a process-wide in-flight cap so a mass
   * outage of webhook endpoints can't accumulate unbounded retry timers. When
   * the cap is hit a single immediate attempt is still made (best effort) but
   * no retries are scheduled.
   */
  dispatchWithRetry(
    config: WebhookConfig,
    event: WebhookEvent,
    form: WebhookFormContext,
    submission: WebhookSubmissionContext,
    data?: Record<string, unknown>
  ): void {
    if (inflightRetries >= MAX_INFLIGHT_RETRIES) {
      strapi.log.warn(
        `[Strapi Forms] Webhook retry capacity reached (${MAX_INFLIGHT_RETRIES} in flight); ` +
          `attempting ${config.url} once without retries`
      );
      // Best-effort single attempt, no retry, fully detached.
      void this.attemptDelivery(config, event, form, submission, data, 1).catch(() => undefined);
      return;
    }

    inflightRetries += 1;
    void this.triggerWithRetry(config, event, form, submission, data)
      .catch((error: unknown) => {
        // triggerWithRetry never throws, but guard defensively so the detached
        // promise can't surface an unhandled rejection.
        const message = error instanceof Error ? error.message : 'Unknown error';
        strapi.log.error(`[Strapi Forms] Webhook retry loop crashed: ${config.url} - ${message}`);
      })
      .finally(() => {
        inflightRetries -= 1;
      });
  },

  /**
   * Build webhook payload
   */
  buildPayload(
    event: WebhookEvent,
    form: WebhookFormContext,
    submission: WebhookSubmissionContext,
    data: Record<string, unknown> | undefined,
    includeFormData: boolean
  ): WebhookPayload {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      form: {
        id: form.documentId,
        title: form.title,
        slug: form.slug,
      },
      submission: {
        id: submission.documentId,
        status: submission.status,
        createdAt: submission.createdAt,
      },
    };

    // Include updatedAt if available
    if (submission.updatedAt) {
      payload.submission.updatedAt = submission.updatedAt;
    }

    // Include form data if configured
    if (includeFormData && data) {
      // Filter out honeypot fields
      const filteredData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (!key.toLowerCase().includes('honeypot') && !key.startsWith('_hp')) {
          filteredData[key] = value;
        }
      }
      payload.submission.data = filteredData;
    }

    return payload;
  },

  /**
   * Build request headers with optional HMAC signature
   */
  buildHeaders(config: WebhookConfig, payload: WebhookPayload): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      'X-Webhook-Event': payload.event,
    };

    // Add custom headers
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        // Don't override critical headers
        if (!['content-type', 'content-length'].includes(key.toLowerCase())) {
          headers[key] = value;
        }
      }
    }

    // Add HMAC signature if secret is configured
    if (config.secret) {
      const signature = this.generateSignature(payload, config.secret);
      headers['X-Webhook-Signature'] = signature;
      headers['X-Webhook-Timestamp'] = payload.timestamp;
    }

    return headers;
  },

  /**
   * Generate HMAC-SHA256 signature for webhook verification
   * Format: sha256=<hex_digest>
   *
   * Verification on receiving end:
   * 1. Get timestamp from X-Webhook-Timestamp header
   * 2. Get signature from X-Webhook-Signature header
   * 3. Compute: HMAC-SHA256(secret, timestamp + "." + JSON.stringify(body))
   * 4. Compare with signature (use timing-safe comparison)
   */
  generateSignature(payload: WebhookPayload, secret: string): string {
    const timestamp = payload.timestamp;
    const body = JSON.stringify(payload);

    // Create signature payload: timestamp.body
    const signaturePayload = `${timestamp}.${body}`;

    // Generate HMAC-SHA256
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signaturePayload);

    return `sha256=${hmac.digest('hex')}`;
  },

  /**
   * Verify a webhook signature (utility for documentation/testing)
   */
  verifySignature(payload: WebhookPayload, secret: string, providedSignature: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);

    // Use timing-safe comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature));
    } catch {
      return false;
    }
  },

  /**
   * Validate URL format
   */
  isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Only allow http and https protocols
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },

  /**
   * Trigger all configured webhooks for an event.
   *
   * Each eligible webhook is dispatched with in-process exponential-backoff
   * retry that runs in the BACKGROUND, so this method resolves immediately and
   * never delays or fails the form submission. The returned array reports that
   * each delivery was accepted/dispatched (one entry per active webhook),
   * preserving the `WebhookTriggerResult[]` contract for existing callers; the
   * eventual delivery success/failure is surfaced via `strapi.log`.
   */
  async triggerAll(
    webhooks: WebhookConfig[],
    event: WebhookEvent,
    form: WebhookFormContext,
    submission: WebhookSubmissionContext,
    data?: Record<string, unknown>
  ): Promise<WebhookTriggerResult[]> {
    if (!webhooks || webhooks.length === 0) {
      return [];
    }

    // Filter to enabled webhooks that subscribe to this event and have a valid URL.
    const activeWebhooks = webhooks.filter((w) => {
      if (!w.enabled || !w.url) return false;
      if (!this.isValidUrl(w.url)) {
        strapi.log.warn(`[Strapi Forms] Webhook skipped: invalid URL "${w.url}"`);
        return false;
      }
      const events = w.events || ['submission.created'];
      return events.includes(event);
    });

    if (activeWebhooks.length === 0) {
      return [];
    }

    // Dispatch each delivery with background retry; resolve immediately so the
    // submission flow is never blocked on webhook delivery.
    return activeWebhooks.map((webhook) => {
      this.dispatchWithRetry(webhook, event, form, submission, data);
      return { success: true, url: webhook.url };
    });
  },

  /**
   * Send a test webhook to verify configuration
   */
  async sendTest(config: WebhookConfig): Promise<WebhookTriggerResult> {
    const testForm: WebhookFormContext = {
      documentId: 'test-form-id',
      title: 'Test Form',
      slug: 'test-form',
    };

    const testSubmission: WebhookSubmissionContext = {
      documentId: 'test-submission-id',
      status: 'new',
      createdAt: new Date().toISOString(),
    };

    const testData: Record<string, unknown> = {
      name: 'Test User',
      email: 'test@example.com',
      message: 'This is a test webhook payload',
    };

    // Force enable for test
    const testConfig = { ...config, enabled: true };

    return this.trigger(testConfig, 'submission.created', testForm, testSubmission, testData);
  },
});

export default webhookService;
