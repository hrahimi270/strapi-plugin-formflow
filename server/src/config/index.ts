/**
 * Plugin configuration schema.
 *
 * The optional `recaptcha` block lets administrators set instance-wide
 * reCAPTCHA defaults (e.g. a global secret key) without depending on it: spam
 * handling reads per-form settings first. Secrets defined here are server-only
 * and are NEVER returned in public responses.
 */
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
  },
  validator() {},
};
