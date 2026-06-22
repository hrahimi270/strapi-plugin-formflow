import type { Core } from '@strapi/strapi';

/**
 * Email notification configuration from form settings
 */
export interface EmailNotificationConfig {
  enabled: boolean;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  replyTo?: string;
  includeData?: boolean;
  template?: string;
  /** When true, this notification is an autoresponder sent to the submitter
   *  rather than to the admin addresses in `to`. */
  isAutoresponder?: boolean;
  /** The form field name whose submitted value supplies the recipient address.
   *  When omitted the first `email`-type field in the submission is used. */
  toField?: string;
  /** When true (and the license entitles `email.whiteLabel`), the
   *  "Sent by FormFlow" footer is omitted from the email body. */
  omitBranding?: boolean;
}

/**
 * Form data for email context
 */
export interface EmailFormContext {
  documentId: string;
  title: string;
  slug: string;
  fields?: Array<{
    name: string;
    label: string;
    type: string;
  }>;
}

/**
 * Submission data for email context
 */
export interface EmailSubmissionContext {
  documentId: string;
  createdAt: string;
  ipAddress?: string;
}

/**
 * Result of sending an email notification
 */
export interface EmailSendResult {
  success: boolean;
  error?: string;
  recipients?: string[];
}

/**
 * Layout field types that should be excluded from email data
 */
const LAYOUT_FIELD_TYPES = ['heading', 'paragraph', 'divider', 'spacer', 'html'];

/**
 * Email notification service for form submissions
 * Sends configurable email notifications using Strapi's email plugin
 */
const emailService = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Send email notification for a form submission
   * Errors are logged but don't throw to avoid failing submissions
   */
  async sendSubmissionNotification(
    config: EmailNotificationConfig,
    form: EmailFormContext,
    submission: EmailSubmissionContext,
    data: Record<string, unknown>
  ): Promise<EmailSendResult> {
    // Validate configuration
    if (!config.enabled) {
      return { success: true, recipients: [] };
    }

    if (!config.to || config.to.length === 0) {
      strapi.log.warn('[FormFlow] Email notification skipped: no recipients configured');
      return { success: false, error: 'No recipients configured' };
    }

    // Check if email plugin is available
    if (!strapi.plugins?.email?.services?.email) {
      strapi.log.error(
        '[FormFlow] Email plugin not available. Please install and configure @strapi/plugin-email'
      );
      return { success: false, error: 'Email plugin not available' };
    }

    try {
      // Custom email templates and reply-to are a Pro feature (email.customTemplate).
      // When not entitled, the configured template is ignored entirely (treated as
      // if unset) so the default body builders below provide the fallback.
      const canCustomTemplate = strapi
        .plugin('formflow')
        .service('license')
        .can('email.customTemplate');

      // Build email content. When a non-empty custom template is configured, render
      // it (substituting {{...}} placeholders) instead of the auto-generated body.
      // Otherwise fall back to the default layout. `template` is trimmed so a
      // whitespace-only value is treated as empty (uses the default body).
      const customTemplate = canCustomTemplate ? config.template?.trim() : undefined;
      const includeData = config.includeData !== false; // Default to true

      // White-label is a Pro feature (email.whiteLabel). The branding footer is
      // omitted only when the user opted in (`config.omitBranding`) AND the
      // license entitles it. EXEC gate: `can()` returns false when EE is stripped.
      const omitBranding =
        !!config.omitBranding &&
        strapi.plugin('formflow').service('license').can('email.whiteLabel');

      let htmlContent: string;
      let textContent: string;

      if (customTemplate) {
        htmlContent = await this.renderTemplateHtml(
          customTemplate,
          form,
          submission,
          data,
          includeData,
          omitBranding
        );
        textContent = await this.renderTemplateText(
          customTemplate,
          form,
          submission,
          data,
          includeData,
          omitBranding
        );
      } else {
        htmlContent = this.buildEmailHtml(form, submission, data, includeData, omitBranding);
        textContent = this.buildEmailText(form, submission, data, includeData, omitBranding);
      }

      // Process subject with template variables
      const defaultSubject = `New submission from {{form.title}}`;
      const subject = this.replaceTemplateVariables(
        config.subject || defaultSubject,
        form,
        submission,
        data
      );

      // Process replyTo with template variables. replyTo is part of the Pro
      // custom-template feature, so it is only applied when entitled.
      let replyTo = canCustomTemplate ? config.replyTo : undefined;
      if (replyTo) {
        replyTo = this.replaceTemplateVariables(replyTo, form, submission, data);
        // Validate it looks like an email
        if (!this.isValidEmail(replyTo)) {
          replyTo = undefined;
        }
      }

      // Build email options
      const emailOptions: Record<string, unknown> = {
        to: config.to,
        subject,
        html: htmlContent,
        text: textContent,
      };

      if (config.cc && config.cc.length > 0) {
        emailOptions.cc = config.cc;
      }

      if (config.bcc && config.bcc.length > 0) {
        emailOptions.bcc = config.bcc;
      }

      if (replyTo) {
        emailOptions.replyTo = replyTo;
      }

      // Send email using Strapi's email plugin
      await strapi.plugins.email.services.email.send(emailOptions);

      strapi.log.info(
        `[FormFlow] Email notification sent for form "${form.title}" to: ${config.to.join(', ')}`
      );

      return {
        success: true,
        recipients: config.to,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      strapi.log.error(`[FormFlow] Failed to send email notification: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Build HTML email content with professional styling
   */
  buildEmailHtml(
    form: EmailFormContext,
    submission: EmailSubmissionContext,
    data: Record<string, unknown>,
    includeData: boolean,
    omitBranding?: boolean
  ): string {
    const formattedDate = this.formatDate(submission.createdAt);

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Form Submission</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #32324D;
      margin: 0;
      padding: 0;
      background-color: #f6f6f9;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #4945FF 0%, #7B79FF 100%);
      color: #ffffff;
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 32px 24px;
    }
    .meta-section {
      background: #f6f6f9;
      border-radius: 4px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .meta-item {
      margin-bottom: 8px;
    }
    .meta-item:last-child {
      margin-bottom: 0;
    }
    .meta-label {
      font-weight: 600;
      color: #666687;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-value {
      color: #32324D;
      font-size: 14px;
    }
    .divider {
      height: 1px;
      background: #EAEAEF;
      margin: 24px 0;
    }
    .data-section h2 {
      font-size: 18px;
      font-weight: 600;
      color: #32324D;
      margin: 0 0 16px 0;
    }
    .field {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #EAEAEF;
    }
    .field:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .field-label {
      font-weight: 600;
      color: #666687;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .field-value {
      color: #32324D;
      font-size: 14px;
      word-break: break-word;
    }
    .field-value.empty {
      color: #A5A5BA;
      font-style: italic;
    }
    .footer {
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #A5A5BA;
      background: #f6f6f9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Form Submission</h1>
    </div>
    <div class="content">
      <div class="meta-section">
        <div class="meta-item">
          <div class="meta-label">Form</div>
          <div class="meta-value">${this.escapeHtml(form.title)}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Submitted</div>
          <div class="meta-value">${formattedDate}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Submission ID</div>
          <div class="meta-value" style="font-family: monospace; font-size: 12px;">${submission.documentId}</div>
        </div>
      </div>`;

    if (includeData) {
      html += `
      <div class="divider"></div>
      <div class="data-section">
        <h2>Submitted Data</h2>`;

      const fields = form.fields || [];
      const fieldOrder = fields.map((f) => f.name);

      // Sort data entries by field order, putting unknown fields at the end
      const sortedEntries = Object.entries(data).sort(([a], [b]) => {
        const indexA = fieldOrder.indexOf(a);
        const indexB = fieldOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });

      for (const [key, value] of sortedEntries) {
        const field = fields.find((f) => f.name === key);

        // Skip layout fields
        if (field && LAYOUT_FIELD_TYPES.includes(field.type)) {
          continue;
        }

        // Skip honeypot fields
        if (key.toLowerCase().includes('honeypot') || key.startsWith('_hp')) {
          continue;
        }

        const label = field?.label || key;
        const displayValue = this.formatValueForHtml(value);

        html += `
        <div class="field">
          <div class="field-label">${this.escapeHtml(label)}</div>
          <div class="field-value${!displayValue ? ' empty' : ''}">${displayValue || '(empty)'}</div>
        </div>`;
      }

      html += `
      </div>`;
    }

    html += `
    </div>`;

    if (!omitBranding) {
      html += `
    <div class="footer">
      <p>This email was sent automatically by FormFlow</p>
    </div>`;
    }

    html += `
  </div>
</body>
</html>`;

    return html;
  },

  /**
   * Build plain text email content as fallback
   */
  buildEmailText(
    form: EmailFormContext,
    submission: EmailSubmissionContext,
    data: Record<string, unknown>,
    includeData: boolean,
    omitBranding?: boolean
  ): string {
    const formattedDate = this.formatDate(submission.createdAt);

    let text = `NEW FORM SUBMISSION\n`;
    text += `${'='.repeat(50)}\n\n`;
    text += `Form: ${form.title}\n`;
    text += `Submitted: ${formattedDate}\n`;
    text += `Submission ID: ${submission.documentId}\n`;

    if (includeData) {
      text += `\n${'─'.repeat(50)}\n`;
      text += `SUBMITTED DATA\n`;
      text += `${'─'.repeat(50)}\n\n`;

      const fields = form.fields || [];

      for (const [key, value] of Object.entries(data)) {
        const field = fields.find((f) => f.name === key);

        // Skip layout fields
        if (field && LAYOUT_FIELD_TYPES.includes(field.type)) {
          continue;
        }

        // Skip honeypot fields
        if (key.toLowerCase().includes('honeypot') || key.startsWith('_hp')) {
          continue;
        }

        const label = field?.label || key;
        const displayValue = this.formatValueForText(value);

        text += `${label}:\n${displayValue}\n\n`;
      }
    }

    if (!omitBranding) {
      text += `${'─'.repeat(50)}\n`;
      text += `This email was sent automatically by FormFlow\n`;
    }

    return text;
  },

  /**
   * Format a value for HTML display.
   *
   * This is the single HTML-escape boundary for submission values in emails.
   * Stored submission data is RAW (the validation sanitizer only trims, it does
   * not HTML-escape), so every string here is escaped exactly once via
   * escapeHtml — never assume the value is pre-escaped, and never escape twice.
   */
  formatValueForHtml(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return '';
      return value.map((v) => this.escapeHtml(String(v))).join(', ');
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'object') {
      return `<pre style="margin: 0; font-size: 12px;">${this.escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
    }

    // Convert newlines to <br> for textarea content
    return this.escapeHtml(String(value)).replace(/\n/g, '<br>');
  },

  /**
   * Format a value for plain text display
   */
  formatValueForText(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '(empty)';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return '(empty)';
      return value.join(', ');
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  },

  /**
   * Replace template variables in a string.
   *
   * Supported placeholders:
   *   {{form.title}}, {{form.slug}}
   *   {{submission.id}}, {{submission.createdAt}}, {{submission.date}} (alias)
   *   {{data.fieldName}}  - a single submitted field value
   *   {{field.fieldName}} - legacy alias of {{data.fieldName}}, kept for back-compat
   *   {{data}}            - a block listing every submitted field as "Label: value"
   *
   * Unknown variables resolve to the empty string.
   *
   * The optional `escape` callback is the single escape boundary for interpolated
   * values: pass {@link escapeHtml} when rendering the HTML body so every value is
   * escaped exactly once, and omit it (identity) for the subject and the plain-text
   * body so they are NEVER HTML-escaped. The template's own literal text is left
   * untouched either way — only interpolated user/submission values pass through
   * `escape`, so there is no double-escaping.
   */
  replaceTemplateVariables(
    template: string,
    form: EmailFormContext,
    submission: EmailSubmissionContext,
    data: Record<string, unknown>,
    escape: (text: string) => string = (text) => text
  ): string {
    const fieldValue = (fieldName: string): string => {
      const value = data[fieldName];
      if (value === null || value === undefined) return '';
      if (Array.isArray(value)) return escape(value.join(', '));
      if (typeof value === 'object') return escape(JSON.stringify(value));
      return escape(String(value));
    };

    return template
      .replace(/\{\{form\.title\}\}/g, escape(form.title))
      .replace(/\{\{form\.slug\}\}/g, escape(form.slug))
      .replace(/\{\{submission\.id\}\}/g, escape(submission.documentId))
      .replace(/\{\{submission\.createdAt\}\}/g, escape(this.formatDate(submission.createdAt, false)))
      .replace(/\{\{submission\.date\}\}/g, escape(this.formatDate(submission.createdAt, false)))
      .replace(/\{\{data\}\}/g, () => this.buildDataBlock(form, submission, data, escape))
      .replace(/\{\{(?:data|field)\.(\w+)\}\}/g, (_, fieldName) => fieldValue(fieldName));
  },

  /**
   * Build the `{{data}}` block: every submitted field rendered as "Label: value",
   * one per line, in the form's field order with unknown fields appended. Layout
   * and honeypot fields are skipped (mirroring the auto-generated body).
   *
   * Interpolated labels and values pass through `escape` exactly once, so this is
   * safe in both the HTML body (escape = escapeHtml) and the plain-text body
   * (escape = identity). The newline separator is left raw; HTML callers can wrap
   * the result in <pre>/<br> as appropriate at the template level.
   */
  buildDataBlock(
    form: EmailFormContext,
    submission: EmailSubmissionContext,
    data: Record<string, unknown>,
    escape: (text: string) => string
  ): string {
    const fields = form.fields || [];
    const fieldOrder = fields.map((f) => f.name);

    const sortedEntries = Object.entries(data).sort(([a], [b]) => {
      const indexA = fieldOrder.indexOf(a);
      const indexB = fieldOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    const lines: string[] = [];
    for (const [key, value] of sortedEntries) {
      const field = fields.find((f) => f.name === key);

      if (field && LAYOUT_FIELD_TYPES.includes(field.type)) {
        continue;
      }
      if (key.toLowerCase().includes('honeypot') || key.startsWith('_hp')) {
        continue;
      }

      const label = field?.label || key;
      const displayValue = this.formatValueForText(value);
      lines.push(`${escape(label)}: ${escape(displayValue)}`);
    }

    return lines.join('\n');
  },

  /**
   * Render a custom email-body template into HTML.
   *
   * Delegates to the EE custom-template renderer (`ee/email`), injecting the MIT
   * pure helpers (`escapeHtml`, `replaceTemplateVariables`) so the EE module
   * stays free of `this` binding and never statically imports back into this
   * service factory.
   *
   * The EE module is imported lazily and guarded: in a stripped MIT fork the
   * import throws MODULE_NOT_FOUND, which we swallow and fall back to the default
   * `buildEmailHtml` body. (In a stripped fork the custom-template branch is
   * unreachable anyway because `can('email.customTemplate')` is false, so this
   * fallback is defensive — it must never crash.)
   */
  async renderTemplateHtml(
    template: string,
    form: EmailFormContext,
    submission: EmailSubmissionContext,
    data: Record<string, unknown>,
    includeData: boolean,
    omitBranding?: boolean
  ): Promise<string> {
    try {
      const { eeEmailService } = await import('../ee/email');
      return eeEmailService({ strapi }).renderTemplateHtml(
        template,
        form,
        submission,
        data,
        (text) => this.escapeHtml(text),
        (t, f, s, d, escape) => this.replaceTemplateVariables(t, f, s, d, escape)
      );
    } catch {
      // Stripped fork → free behaviour: default auto-generated body.
      return this.buildEmailHtml(form, submission, data, includeData, omitBranding);
    }
  },

  /**
   * Render a custom email-body template into plain text.
   *
   * Delegates to the EE custom-template renderer (`ee/email`); the plain-text
   * variant is NEVER HTML-escaped — values are interpolated as-is.
   *
   * Lazy + guarded like {@link renderTemplateHtml}: a missing `ee/email` module
   * (stripped fork) degrades to the default `buildEmailText` body.
   */
  async renderTemplateText(
    template: string,
    form: EmailFormContext,
    submission: EmailSubmissionContext,
    data: Record<string, unknown>,
    includeData: boolean,
    omitBranding?: boolean
  ): Promise<string> {
    try {
      const { eeEmailService } = await import('../ee/email');
      return eeEmailService({ strapi }).renderTemplateText(
        template,
        form,
        submission,
        data,
        (t, f, s, d) => this.replaceTemplateVariables(t, f, s, d)
      );
    } catch {
      // Stripped fork → free behaviour: default auto-generated body.
      return this.buildEmailText(form, submission, data, includeData, omitBranding);
    }
  },

  /**
   * Escape HTML special characters
   */
  escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
  },

  /**
   * Format a date string for display
   */
  formatDate(dateStr: string, includeTime = true): string {
    try {
      const date = new Date(dateStr);
      if (includeTime) {
        return date.toLocaleString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  },

  /**
   * Basic email validation
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
});

export default emailService;
