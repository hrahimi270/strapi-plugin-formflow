import type { Core } from '@strapi/strapi';

import type { ValidatableField } from './validation';

/**
 * Content type UID for form submissions
 */
const SUBMISSION_CONTENT_TYPE_UID = 'plugin::strapi-forms.form-submission';

/**
 * Submission status values
 */
export type SubmissionStatus = 'new' | 'read' | 'processed' | 'archived' | 'spam';

/**
 * Metadata collected from the submission request
 */
export interface SubmissionMetadata {
  ipAddress: string;
  userAgent?: string;
  referrer?: string;
  submittedAt: string;
  formVersion?: string;
}

/**
 * Form submission record structure
 */
export interface FormSubmission {
  documentId: string;
  form: { documentId: string };
  data: Record<string, unknown>;
  metadata: SubmissionMetadata;
  status: SubmissionStatus;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Query options for finding submissions
 */
export interface SubmissionQuery {
  filters?: Record<string, unknown>;
  sort?: Record<string, 'asc' | 'desc'> | string;
  limit?: number;
  offset?: number;
  populate?: string[];
}

/**
 * Result of a successful submission
 */
export interface SubmissionResult {
  submission: FormSubmission;
  successMessage?: string;
  redirectUrl?: string;
}

/**
 * Spam submission result (silently rejected)
 */
export interface SpamSubmissionResult {
  successMessage?: string;
  redirectUrl?: string;
}

/**
 * Custom validation error with field-level details
 */
class ValidationError extends Error {
  name = 'ValidationError' as const;
  details: Record<string, string[]>;

  constructor(details: Record<string, string[]>) {
    super('Validation failed');
    this.details = details;
  }
}

/**
 * Form structure for submission processing
 */
export interface SubmittableForm {
  documentId: string;
  slug: string;
  title: string;
  isActive: boolean;
  fields: ValidatableField[];
  settings?: {
    spam?: {
      honeypot?: boolean;
      honeypotFieldName?: string;
    };
    emailNotifications?: Array<{
      enabled: boolean;
      to: string[];
      subject?: string;
      template?: string;
      replyTo?: string;
    }>;
    webhooks?: Array<{
      enabled: boolean;
      url: string;
      method?: 'POST' | 'PUT';
      headers?: Record<string, string>;
      events?: Array<'submission.created' | 'submission.updated'>;
    }>;
  };
  successMessage?: string;
  redirectUrl?: string;
  submissionCount?: number;
  updatedAt: string;
}

/**
 * Submission service for handling form submissions
 * Coordinates validation, sanitization, storage, and post-submission hooks
 */
const submissionService = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Submit form data
   * Complete submission workflow: validate, sanitize, store, trigger hooks
   *
   * @param slug - Form slug identifier
   * @param data - Raw submission data
   * @param metadata - Client metadata (IP, user agent, etc.)
   * @returns Submission result with success message/redirect
   * @throws ValidationError if validation fails
   * @throws Error if form not found or inactive
   */
  async submit(
    slug: string,
    data: Record<string, unknown>,
    metadata: SubmissionMetadata
  ): Promise<SubmissionResult | SpamSubmissionResult> {
    const formService = strapi.plugin('strapi-forms').service('form');
    const validationService = strapi.plugin('strapi-forms').service('validation');

    // Get form by slug
    const form = (await formService.findBySlug(slug)) as SubmittableForm | null;

    if (!form) {
      throw new Error('Form not found');
    }

    if (!form.isActive) {
      throw new Error('Form is not accepting submissions');
    }

    // Create a mutable copy of submission data
    const submissionData = { ...data };

    // Check honeypot spam filter
    if (form.settings?.spam?.honeypot) {
      const honeypotFieldName = form.settings.spam.honeypotFieldName || '_gotcha';

      if (validationService.isSpam(submissionData, honeypotFieldName)) {
        // Log spam attempt but return success to avoid detection
        strapi.log.info(`[Strapi Forms] Spam submission detected for form: ${slug}`);

        return {
          successMessage: form.successMessage || 'Thank you for your submission',
          redirectUrl: form.redirectUrl,
        };
      }

      // Remove honeypot field from data before processing
      delete submissionData[honeypotFieldName];
    }

    // Validate submission data against form field definitions
    const validationResult = validationService.validate(form.fields || [], submissionData);

    if (!validationResult.valid) {
      throw new ValidationError(validationResult.errors);
    }

    // Sanitize data before storage
    const sanitizedData = validationService.sanitize(form.fields || [], submissionData);

    // Create submission record
    const submission = (await strapi.documents(SUBMISSION_CONTENT_TYPE_UID).create({
      data: {
        form: form.documentId,
        data: sanitizedData,
        metadata: {
          ...metadata,
          formVersion: form.updatedAt,
        },
        status: 'new' as SubmissionStatus,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    })) as unknown as FormSubmission;

    // Update form submission count
    await formService.incrementSubmissionCount(form.documentId);

    // Trigger post-submission hooks asynchronously (don't block response)
    this.triggerPostSubmissionHooks(form, submission, sanitizedData).catch((error: Error) => {
      strapi.log.error('[Strapi Forms] Post-submission hook error:', error);
    });

    return {
      submission,
      successMessage: form.successMessage || 'Thank you for your submission',
      redirectUrl: form.redirectUrl,
    };
  },

  /**
   * Find submissions for a specific form
   *
   * @param formId - Form documentId
   * @param query - Query options (filters, sort, pagination)
   * @returns Array of submission records
   */
  async find(formId: string, query: SubmissionQuery = {}): Promise<FormSubmission[]> {
    const results = await strapi.documents(SUBMISSION_CONTENT_TYPE_UID).findMany({
      ...query,
      filters: {
        ...query.filters,
        form: { documentId: formId },
      },
      sort: query.sort || { createdAt: 'desc' },
      populate: query.populate || ['form'],
    });

    return results as unknown as FormSubmission[];
  },

  /**
   * Find a single submission by documentId
   *
   * @param documentId - Submission documentId
   * @returns Submission record or null
   */
  async findOne(documentId: string): Promise<FormSubmission | null> {
    const result = await strapi.documents(SUBMISSION_CONTENT_TYPE_UID).findOne({
      documentId,
      populate: ['form'],
    });

    return result as unknown as FormSubmission | null;
  },

  /**
   * Update a submission record
   *
   * @param documentId - Submission documentId
   * @param data - Fields to update
   * @returns Updated submission record
   */
  async update(
    documentId: string,
    data: Partial<{
      status: SubmissionStatus;
      data: Record<string, unknown>;
      metadata: Partial<SubmissionMetadata>;
    }>
  ): Promise<FormSubmission> {
    const result = await strapi.documents(SUBMISSION_CONTENT_TYPE_UID).update({
      documentId,
      data: data as Record<string, unknown>,
    });

    return result as unknown as FormSubmission;
  },

  /**
   * Delete a single submission
   *
   * @param documentId - Submission documentId
   * @returns Deleted submission record
   */
  async delete(documentId: string): Promise<FormSubmission> {
    const result = await strapi.documents(SUBMISSION_CONTENT_TYPE_UID).delete({
      documentId,
    });

    return result as unknown as FormSubmission;
  },

  /**
   * Delete multiple submissions
   *
   * @param formId - Form documentId (for verification)
   * @param submissionIds - Array of submission documentIds
   * @returns Array of deleted submission records
   */
  async deleteMany(formId: string, submissionIds: string[]): Promise<FormSubmission[]> {
    const results: FormSubmission[] = [];

    for (const id of submissionIds) {
      // Verify submission belongs to the form before deleting
      const submission = await this.findOne(id);

      if (submission && submission.form?.documentId === formId) {
        const deleted = await this.delete(id);
        results.push(deleted);
      }
    }

    return results;
  },

  /**
   * Count submissions for a form
   *
   * @param formId - Form documentId
   * @param filters - Additional filters
   * @returns Submission count
   */
  async count(formId: string, filters: Record<string, unknown> = {}): Promise<number> {
    return strapi.documents(SUBMISSION_CONTENT_TYPE_UID).count({
      filters: {
        ...filters,
        form: { documentId: formId },
      },
    });
  },

  /**
   * Get submission statistics for a form
   *
   * @param formId - Form documentId
   * @returns Object with counts by status
   */
  async getStats(formId: string): Promise<Record<SubmissionStatus | 'total', number>> {
    const statuses: SubmissionStatus[] = ['new', 'read', 'processed', 'archived', 'spam'];
    const stats: Record<string, number> = { total: 0 };

    for (const status of statuses) {
      const count = await this.count(formId, { status });
      stats[status] = count;
      stats.total += count;
    }

    return stats as Record<SubmissionStatus | 'total', number>;
  },

  /**
   * Mark a submission as read
   *
   * @param documentId - Submission documentId
   * @returns Updated submission record
   */
  async markAsRead(documentId: string): Promise<FormSubmission> {
    return this.update(documentId, { status: 'read' });
  },

  /**
   * Mark a submission as processed
   *
   * @param documentId - Submission documentId
   * @returns Updated submission record
   */
  async markAsProcessed(documentId: string): Promise<FormSubmission> {
    return this.update(documentId, { status: 'processed' });
  },

  /**
   * Mark a submission as spam
   *
   * @param documentId - Submission documentId
   * @returns Updated submission record
   */
  async markAsSpam(documentId: string): Promise<FormSubmission> {
    return this.update(documentId, { status: 'spam' });
  },

  /**
   * Archive a submission
   *
   * @param documentId - Submission documentId
   * @returns Updated submission record
   */
  async archive(documentId: string): Promise<FormSubmission> {
    return this.update(documentId, { status: 'archived' });
  },

  /**
   * Trigger post-submission hooks (notifications, webhooks)
   * This runs asynchronously after the submission is stored
   *
   * @param form - Form configuration
   * @param submission - Created submission record
   * @param data - Sanitized submission data
   */
  async triggerPostSubmissionHooks(
    form: SubmittableForm,
    submission: FormSubmission,
    data: Record<string, unknown>
  ): Promise<void> {
    const settings = form.settings || {};

    // Email notifications
    if (settings.emailNotifications?.length) {
      const emailService = strapi.plugin('strapi-forms').service('email');

      // Prepare form context for email
      const formContext = {
        documentId: form.documentId,
        title: form.title,
        slug: form.slug,
        fields: form.fields?.map((f) => ({
          name: f.name,
          label: f.label,
          type: f.type,
        })),
      };

      // Prepare submission context for email
      const submissionContext = {
        documentId: submission.documentId,
        createdAt: submission.createdAt,
        ipAddress: submission.ipAddress,
      };

      // Send all configured notifications
      for (const notification of settings.emailNotifications) {
        if (notification.enabled && notification.to?.length) {
          // Run in background to not block response
          emailService
            .sendSubmissionNotification(notification, formContext, submissionContext, data)
            .catch((error: Error) => {
              strapi.log.error(
                `[Strapi Forms] Email notification failed for form "${form.title}": ${error.message}`
              );
            });
        }
      }
    }

    // Webhooks (placeholder for Phase 5)
    if (settings.webhooks?.length) {
      for (const webhook of settings.webhooks) {
        if (webhook.enabled && webhook.events?.includes('submission.created')) {
          strapi.log.info(`[Strapi Forms] Webhook queued for form "${form.title}": ${webhook.url}`);
          // TODO: Implement webhook triggering in Phase 5
          // await this.triggerWebhook(webhook, form, submission, data);
        }
      }
    }
  },

  /**
   * Export submissions as CSV (placeholder for export service)
   *
   * @param formId - Form documentId
   * @param filters - Optional filters
   * @returns CSV string
   */
  async exportToCsv(formId: string, filters: Record<string, unknown> = {}): Promise<string> {
    const submissions = await this.find(formId, { filters });

    if (submissions.length === 0) {
      return '';
    }

    // Get all unique field names from submissions
    const fieldNames = new Set<string>();
    for (const submission of submissions) {
      if (submission.data && typeof submission.data === 'object') {
        Object.keys(submission.data).forEach((key) => fieldNames.add(key));
      }
    }

    const headers = ['Submission ID', 'Status', 'Submitted At', ...Array.from(fieldNames)];

    // Build CSV rows
    const rows = submissions.map((submission) => {
      const values = [
        submission.documentId,
        submission.status,
        submission.createdAt,
        ...Array.from(fieldNames).map((field) => {
          const value = (submission.data as Record<string, unknown>)?.[field];
          if (value === null || value === undefined) return '';
          if (Array.isArray(value)) return value.join('; ');
          return String(value);
        }),
      ];

      // Escape CSV values
      return values
        .map((v) => {
          const str = String(v);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  },
});

export default submissionService;
