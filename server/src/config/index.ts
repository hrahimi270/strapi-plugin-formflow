/**
 * Plugin configuration schema.
 *
 * The optional `recaptcha` block lets administrators set instance-wide
 * reCAPTCHA defaults (e.g. a global secret key) without depending on it: spam
 * handling reads per-form settings first. Secrets defined here are server-only
 * and are NEVER returned in public responses.
 *
 * Privacy / data-protection options (both OFF by default, so existing forms are
 * unaffected unless an administrator opts in):
 * - `anonymizeIp`: when true, submitter IP addresses are masked before storage
 *   (IPv4 last octet zeroed, IPv6 truncated to the /64 prefix) in both
 *   `submission.ipAddress` and `submission.metadata.ipAddress`. When false (the
 *   default) raw IPs are stored exactly as today.
 * - `dataRetentionDays`: when greater than 0, a daily cron job deletes
 *   submissions whose `createdAt` is older than `now - dataRetentionDays`. The
 *   default of 0 disables retention entirely (submissions are kept forever and
 *   no cron job is registered).
 */
export interface FormFlowConfig {
  recaptcha: {
    enabled: boolean;
    siteKey: string;
    secretKey: string;
    version: 'v2' | 'v3';
    threshold: number;
  };
  /**
   * Mask submitter IP addresses before storage. Default `false` (store raw IP).
   */
  anonymizeIp: boolean;
  /**
   * Delete submissions older than this many days via a daily cron job.
   * `0` (default) disables auto-deletion; submissions are kept indefinitely.
   */
  dataRetentionDays: number;
  license: {
    /**
     * License key obtained from the Merchant-of-Record after purchase.
     * Set via FORMFLOW_LICENSE_KEY env var. Empty string = free tier.
     * SERVER-ONLY: never returned in public API responses or the /license snapshot.
     */
    key: string;
    /**
     * Number of days to preserve Pro/Business tier after a connectivity failure
     * reaching the MoR validation endpoint. Default 14. Applies to network/timeout
     * failures ONLY — revoked or expired keys hard-expire immediately with no grace.
     */
    graceDays: number;
    /**
     * Merchant-of-Record provider that issues/validates license keys. Driven by
     * the MOR_PROVIDER env var; one of `lemonsqueezy` (default) or `polar`.
     * Swapping providers is a single env var — the HTTP/auth details live in
     * `server/src/ee/license/mor-client.ts`.
     */
    provider: 'lemonsqueezy' | 'polar';
  };
}

export default {
  default: {
    recaptcha: {
      // Optional global defaults; per-form settings take precedence.
      enabled: false,
      siteKey: '',
      secretKey: '',
      version: 'v3' as 'v2' | 'v3',
      threshold: 0.5,
    },
    // Privacy defaults: both OFF so nothing changes for existing forms.
    anonymizeIp: false,
    dataRetentionDays: 0,
    license: {
      key: process.env.FORMFLOW_LICENSE_KEY ?? '',
      graceDays: Number(process.env.FORMFLOW_LICENSE_GRACE_DAYS ?? 14),
      // Default to Lemon Squeezy; only the explicit `polar` value switches.
      provider:
        process.env.MOR_PROVIDER === 'polar'
          ? ('polar' as const)
          : ('lemonsqueezy' as const),
    },
  },
  /**
   * Validate the privacy options if an administrator supplied them. Kept lenient
   * (only rejects clearly-wrong types/values) so existing setups that omit these
   * keys continue to load with the defaults above.
   */
  validator(config: Partial<FormFlowConfig> = {}) {
    if (
      config.anonymizeIp !== undefined &&
      typeof config.anonymizeIp !== 'boolean'
    ) {
      throw new Error(
        '[FormFlow] config "anonymizeIp" must be a boolean.'
      );
    }

    if (config.dataRetentionDays !== undefined) {
      const days = config.dataRetentionDays;
      if (
        typeof days !== 'number' ||
        !Number.isInteger(days) ||
        days < 0
      ) {
        throw new Error(
          '[FormFlow] config "dataRetentionDays" must be a non-negative integer (0 disables auto-deletion).'
        );
      }
    }

    if (config.license !== undefined) {
      if (
        config.license.key !== undefined &&
        typeof config.license.key !== 'string'
      ) {
        throw new Error('[FormFlow] config "license.key" must be a string.');
      }
      if (config.license.graceDays !== undefined) {
        const days = config.license.graceDays;
        if (typeof days !== 'number' || !Number.isInteger(days) || days < 0) {
          throw new Error(
            '[FormFlow] config "license.graceDays" must be a non-negative integer.'
          );
        }
      }
      if (
        config.license.provider !== undefined &&
        config.license.provider !== 'lemonsqueezy' &&
        config.license.provider !== 'polar'
      ) {
        throw new Error(
          '[FormFlow] config "license.provider" must be "lemonsqueezy" or "polar".'
        );
      }
    }
  },
};
