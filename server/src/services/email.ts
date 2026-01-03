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
      strapi.log.warn('[Strapi Forms] Email notification skipped: no recipients configured');
      return { success: false, error: 'No recipients configured' };
    }

    // Check if email plugin is available
    if (!strapi.plugins?.email?.services?.email) {
      strapi.log.error(
        '[Strapi Forms] Email plugin not available. Please install and configure @strapi/plugin-email'
      );
      return { success: false, error: 'Email plugin not available' };
    }

    try {
      // Build email content
      const includeData = config.includeData !== false; // Default to true
      const htmlContent = this.buildEmailHtml(form, submission, data, includeData);
      const textContent = this.buildEmailText(form, submission, data, includeData);

      // Process subject with template variables
      const defaultSubject = `New submission from {{form.title}}`;
      const subject = this.replaceTemplateVariables(
        config.subject || defaultSubject,
        form,
        submission,
        data
      );

      // Process replyTo with template variables
      let replyTo = config.replyTo;
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
        `[Strapi Forms] Email notification sent for form "${form.title}" to: ${config.to.join(', ')}`
      );

      return {
        success: true,
        recipients: config.to,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      strapi.log.error(`[Strapi Forms] Failed to send email notification: ${errorMessage}`);

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
    includeData: boolean
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
    </div>
    <div class="footer">
      <p>This email was sent automatically by Strapi Forms</p>
    </div>
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
    includeData: boolean
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

    text += `${'─'.repeat(50)}\n`;
    text += `This email was sent automatically by Strapi Forms\n`;

    return text;
  },

  /**
   * Format a value for HTML display
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
   * Replace template variables in a string
   * Supports: {{form.title}}, {{form.slug}}, {{submission.id}}, {{submission.date}}, {{field.fieldName}}
   */
  replaceTemplateVariables(
    template: string,
    form: EmailFormContext,
    submission: EmailSubmissionContext,
    data: Record<string, unknown>
  ): string {
    return template
      .replace(/\{\{form\.title\}\}/g, form.title)
      .replace(/\{\{form\.slug\}\}/g, form.slug)
      .replace(/\{\{submission\.id\}\}/g, submission.documentId)
      .replace(/\{\{submission\.date\}\}/g, this.formatDate(submission.createdAt, false))
      .replace(/\{\{field\.(\w+)\}\}/g, (_, fieldName) => {
        const value = data[fieldName];
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) return value.join(', ');
        return String(value);
      });
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

  /**
   * Send multiple email notifications for a form submission
   * Convenience method that processes all configured notifications
   */
  async sendAllNotifications(
    notifications: EmailNotificationConfig[],
    form: EmailFormContext,
    submission: EmailSubmissionContext,
    data: Record<string, unknown>
  ): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];

    for (const notification of notifications) {
      if (notification.enabled) {
        const result = await this.sendSubmissionNotification(notification, form, submission, data);
        results.push(result);
      }
    }

    return results;
  },
});

export default emailService;
