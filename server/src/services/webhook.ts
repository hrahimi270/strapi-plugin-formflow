import type { Core } from '@strapi/strapi';

// Type-only re-exports are erased at compile time and create no runtime require,
// so the file stays runtime-strip-safe (a clean-strip `tsc` will surface TS2307
// for these — the accepted from-source-rebuild cost, see premium-plan.md §4).
export type {
  WebhookEvent,
  WebhookConfig,
  WebhookPayload,
  WebhookFormContext,
  WebhookSubmissionContext,
  WebhookTriggerResult,
  WebhookAttemptOutcome,
} from '../ee/webhooks';

import type {
  WebhookConfig,
  WebhookEvent,
  WebhookFormContext,
  WebhookSubmissionContext,
  WebhookTriggerResult,
} from '../ee/webhooks';

/**
 * The slice of the EE webhook service the wrapper delegates to. Kept loose so
 * the wrapper never statically imports the EE engine at runtime (which would
 * defeat the stripped-fork fallback). Mirrors the methods callers rely on:
 * `triggerAll` (background dispatch from the submission flow) and `sendTest`
 * (the admin test-webhook controller).
 */
interface EeWebhookInstance {
  triggerAll(
    webhooks: WebhookConfig[],
    event: WebhookEvent,
    form: WebhookFormContext,
    submission: WebhookSubmissionContext,
    data?: Record<string, unknown>
  ): Promise<WebhookTriggerResult[]>;
  sendTest(config: WebhookConfig): Promise<WebhookTriggerResult>;
}

export interface WebhookService {
  triggerAll(
    webhooks: WebhookConfig[],
    event: WebhookEvent,
    form: WebhookFormContext,
    submission: WebhookSubmissionContext,
    data?: Record<string, unknown>
  ): Promise<WebhookTriggerResult[]>;
  sendTest(config: WebhookConfig): Promise<WebhookTriggerResult>;
}

/**
 * Thin MIT wrapper around the premium (`ee/`) webhook engine. It lazily imports
 * the EE implementation the first time a method is called: if the EE module is
 * present it delegates every call to it; if it is absent (stripped MIT fork) the
 * import is caught and the wrapper degrades to a free no-op stub. No method ever
 * throws and the static top-level `../ee/webhooks` import is gone, so plugin LOAD
 * never hard-crashes on a stripped runtime (premium-plan.md §10).
 *
 * Callers only reach these methods behind `can('webhooks')`, so on a licensed
 * runtime with `ee/` present the stub is never hit; it exists purely so the
 * registered service shape resolves harmlessly when `ee/` is absent.
 */
const webhookService = ({ strapi }: { strapi: Core.Strapi }): WebhookService => {
  let eeImpl: EeWebhookInstance | null = null;
  let loaded = false;

  // Dynamic, never top-level: a missing `ee/webhooks` (stripped fork) throws
  // MODULE_NOT_FOUND here, which we swallow to fall back to the no-op stub.
  async function loadEE(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
      const mod = await import('../ee/webhooks');
      eeImpl = mod.default({ strapi }) as EeWebhookInstance;
    } catch {
      eeImpl = null;
    }
  }

  return {
    async triggerAll(
      webhooks: WebhookConfig[],
      event: WebhookEvent,
      form: WebhookFormContext,
      submission: WebhookSubmissionContext,
      data?: Record<string, unknown>
    ): Promise<WebhookTriggerResult[]> {
      await loadEE();
      if (eeImpl) return eeImpl.triggerAll(webhooks, event, form, submission, data);
      return [];
    },

    async sendTest(config: WebhookConfig): Promise<WebhookTriggerResult> {
      await loadEE();
      if (eeImpl) return eeImpl.sendTest(config);
      return { success: false, url: config?.url, error: 'Webhooks unavailable' };
    },
  };
};

export default webhookService;
