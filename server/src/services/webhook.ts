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
 * Webhook service for triggering HTTP callbacks on form events
 * Supports HMAC signature verification, custom headers, and parallel execution
 */
const webhookService = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Trigger a single webhook for an event
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

    const startTime = Date.now();

    try {
      // Build payload
      const includeData = config.includeFormData !== false; // Default to true
      const payload = this.buildPayload(event, form, submission, data, includeData);

      // Build headers
      const headers = this.buildHeaders(config, payload);

      // Prepare request options
      const method = config.method || 'POST';
      const timeout = Math.min(config.timeout || DEFAULT_TIMEOUT, MAX_TIMEOUT);

      // Create abort controller for timeout
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

        if (!response.ok) {
          const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          strapi.log.warn(
            `[Strapi Forms] Webhook returned error: ${config.url} - ${errorMessage} (${duration}ms)`
          );
          return {
            success: false,
            url: config.url,
            status: response.status,
            error: errorMessage,
            duration,
          };
        }

        strapi.log.info(
          `[Strapi Forms] Webhook triggered: ${config.url} - Event: ${event} - Status: ${response.status} (${duration}ms)`
        );

        return {
          success: true,
          url: config.url,
          status: response.status,
          duration,
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Handle specific error types
      let finalError = errorMessage;
      if (errorMessage.includes('abort')) {
        finalError = `Request timeout after ${config.timeout || DEFAULT_TIMEOUT}ms`;
      }

      strapi.log.error(
        `[Strapi Forms] Webhook failed: ${config.url} - ${finalError} (${duration}ms)`
      );

      return {
        success: false,
        url: config.url,
        error: finalError,
        duration,
      };
    }
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
   * Trigger all configured webhooks for an event
   * Runs webhooks in parallel and collects results
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

    // Filter to enabled webhooks that subscribe to this event
    const activeWebhooks = webhooks.filter((w) => {
      if (!w.enabled) return false;
      const events = w.events || ['submission.created'];
      return events.includes(event);
    });

    if (activeWebhooks.length === 0) {
      return [];
    }

    // Trigger all webhooks in parallel
    const results = await Promise.allSettled(
      activeWebhooks.map((webhook) => this.trigger(webhook, event, form, submission, data))
    );

    // Process results
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      // Handle rejected promise
      const webhook = activeWebhooks[index];
      return {
        success: false,
        url: webhook.url,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      };
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
