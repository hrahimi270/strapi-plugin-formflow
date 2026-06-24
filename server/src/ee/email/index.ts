/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import type { Core } from '@strapi/strapi';
import type { EmailFormContext, EmailSubmissionContext } from '../../services/email';

/**
 * EE email service — the premium custom-template renderers.
 *
 * Only the custom-template body rendering lives here; the default body builders
 * (`buildEmailHtml`/`buildEmailText`), the orchestration call-site
 * (`sendSubmissionNotification`), and all pure helpers stay MIT in
 * `services/email.ts`. The MIT service injects its own `escapeHtml` and
 * `replaceTemplateVariables` helpers so these renderers stay free of `this`
 * binding and avoid a circular import back into the email service factory.
 */
export const eeEmailService = ({ strapi: _strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Render a custom email-body template into HTML.
   *
   * Interpolated user/submission values are HTML-escaped exactly once (via the
   * injected `escapeHtml`) — this is the HTML escape boundary. The template's own
   * literal markup is preserved verbatim, so authors can include HTML. Newlines
   * in the rendered output are converted to <br> for readability.
   */
  renderTemplateHtml(
    template: string,
    form: EmailFormContext,
    submission: EmailSubmissionContext,
    data: Record<string, unknown>,
    escapeHtml: (text: string) => string,
    replaceTemplateVariables: (
      t: string,
      f: EmailFormContext,
      s: EmailSubmissionContext,
      d: Record<string, unknown>,
      escape?: (x: string) => string
    ) => string
  ): string {
    const rendered = replaceTemplateVariables(template, form, submission, data, (text) =>
      escapeHtml(text)
    );
    return rendered.replace(/\n/g, '<br>\n');
  },

  /**
   * Render a custom email-body template into plain text.
   *
   * The plain-text variant is NEVER HTML-escaped — values are interpolated as-is.
   */
  renderTemplateText(
    template: string,
    form: EmailFormContext,
    submission: EmailSubmissionContext,
    data: Record<string, unknown>,
    replaceTemplateVariables: (
      t: string,
      f: EmailFormContext,
      s: EmailSubmissionContext,
      d: Record<string, unknown>
    ) => string
  ): string {
    return replaceTemplateVariables(template, form, submission, data);
  },
});

/**
 * Minimal field shape needed to resolve the autoresponder recipient. Only the
 * `name`/`type` are read; widening to a richer field type at the call-site is
 * fine since this only requires the two keys.
 */
export interface AutoresponderField {
  name: string;
  type: string;
}

/** Same email shape used by the MIT email service (`isValidEmail`). */
const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Resolve the autoresponder recipient from the submitted data.
 *
 * Scans the form's `email`-type fields for the first one whose submitted value
 * is a non-empty string that looks like a valid email. When `toField` is given
 * (the configured submitter-email field name) that field is checked first and,
 * if it is missing/empty/invalid, the scan falls back to the first valid
 * `email`-type field. Returns the resolved address, or `null` when none is found.
 */
export function resolveAutoresponderRecipient(
  data: Record<string, unknown>,
  fields: AutoresponderField[],
  toField?: string
): string | null {
  const valueOf = (name: string): string | null => {
    const value = data[name];
    return typeof value === 'string' && value.trim() && isValidEmail(value.trim())
      ? value.trim()
      : null;
  };

  // Explicit field wins when it resolves to a valid email.
  if (toField) {
    const explicit = valueOf(toField);
    if (explicit) return explicit;
  }

  // Fall back to the first email-type field with a valid submitted value.
  for (const field of fields) {
    if (field.type === 'email') {
      const resolved = valueOf(field.name);
      if (resolved) return resolved;
    }
  }

  return null;
}

export default eeEmailService;
