import type { Core } from '@strapi/strapi';

import type { ValidatableField, UploadedFileMeta, UploadedFilesMap } from './validation';

/**
 * Re-export the multipart file types so the controller can type the files map it
 * forwards into {@link submissionService.submit} without reaching into the
 * validation service directly.
 */
export type { UploadedFileMeta, UploadedFilesMap };

/**
 * Media-library reference stored in submission.data for a `file` field.
 * Mirrors the public-safe subset of a Strapi upload file record.
 */
export interface SubmissionFileRef {
  /** Numeric media id. */
  id: number;
  /** Document id (Strapi v5); present on persisted upload records. */
  documentId?: string;
  /** Public URL of the uploaded file. */
  url: string;
  /** Stored file name. */
  name: string;
  /** Detected/declared MIME type. */
  mime?: string;
  /** File size in bytes. */
  size?: number;
}

/**
 * Content type UID for form submissions
 */
const SUBMISSION_CONTENT_TYPE_UID = 'plugin::strapi-forms.form-submission';

/**
 * Request-body control field used to request validate-only, step-scoped
 * validation for a multi-step form. Its value is a step id or a zero-based step
 * index. It is a control field (never a real form field) and is always stripped
 * from submission data before validation/storage, like the honeypot field.
 */
export const STEP_INDICATOR_FIELD = '_step';

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
  // Document Service findMany uses offset-notation 'start' (not 'offset').
  start?: number;
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
 * Multi-step form step definition. `fields` holds the stable field IDs that
 * belong to the step (matching `FormField.id`), NOT field names.
 */
export interface FormStepDefinition {
  id: string;
  title?: string;
  description?: string;
  fields: string[];
}

/**
 * Result of a validate-only step check. Reports validity and field-level errors
 * for the requested step WITHOUT persisting any submission. `step` echoes the
 * resolved step id (or the raw indicator when a step could not be resolved).
 */
export interface StepValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
  step: string;
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
    layout?: 'single' | 'multi-step';
    steps?: FormStepDefinition[];
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
   * @param data - Raw submission data (non-file fields)
   * @param metadata - Client metadata (IP, user agent, etc.)
   * @param files - Uploaded files keyed by field name (from multipart parser).
   *   Optional so plain JSON submissions keep working unchanged.
   * @returns Submission result with success message/redirect
   * @throws ValidationError if validation fails
   * @throws Error if form not found or inactive
   */
  async submit(
    slug: string,
    data: Record<string, unknown>,
    metadata: SubmissionMetadata,
    files: UploadedFilesMap = {}
  ): Promise<SubmissionResult> {
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

    // Strip the step-indicator control field. It is only meaningful for the
    // validate-only step check (see validateStep) and must never be validated
    // against form fields or persisted, even if a full submission includes it.
    delete submissionData[STEP_INDICATOR_FIELD];

    // Spam handling (honeypot + reCAPTCHA) lives in the spam-check middleware,
    // which runs before this controller/service. Defensively strip the honeypot
    // field here so it never reaches validation or storage.
    if (form.settings?.spam?.honeypot) {
      const honeypotFieldName = form.settings.spam.honeypotFieldName || '_gotcha';
      delete submissionData[honeypotFieldName];
    }

    const formFields = form.fields || [];

    // Validate non-file submission data against form field definitions.
    const validationResult = validationService.validate(formFields, submissionData);

    // Validate uploaded files (required/maxSize/allowedTypes) BEFORE persisting
    // anything to the media library, so oversize/disallowed files never land.
    const fileValidationResult = validationService.validateFiles(
      formFields,
      files,
      submissionData
    );

    // Merge field-level errors from both passes and reject as one response.
    const combinedErrors: Record<string, string[]> = {
      ...validationResult.errors,
      ...fileValidationResult.errors,
    };

    if (Object.keys(combinedErrors).length > 0) {
      throw new ValidationError(combinedErrors);
    }

    // Files passed validation: upload them to the media library and place the
    // resulting media references into the submission data under each field name.
    await this.processFileUploads(formFields, files, submissionData);

    // Sanitize data before storage
    const sanitizedData = validationService.sanitize(formFields, submissionData);

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
   * Validate a SINGLE step of a multi-step form WITHOUT persisting anything.
   *
   * This is the step-aware counterpart to {@link submit}: it powers per-step
   * (wizard) validation so a frontend can confirm a step is valid before letting
   * the user advance. It is VALIDATION-ONLY — no submission is ever created,
   * no files are uploaded, no hooks fire, and the submission count is untouched.
   * Persistence happens exclusively through a full {@link submit} call (one with
   * no step indicator).
   *
   * Only the non-file fields whose ids/names belong to the requested step are
   * checked, reusing the same per-field logic as a full submission (conditional
   * visibility against the full data, required, rules, type, options). File
   * fields are intentionally not validated here (uploads are deferred to the
   * final submit). The returned errors use the identical
   * `{ valid, errors }` shape as full validation (errors keyed by field name),
   * with an added `step` echoing the resolved step id.
   *
   * @param slug - Form slug identifier
   * @param data - Raw submission data accumulated so far (keyed by field name)
   * @param stepIndicator - Step id or zero-based step index to validate
   * @returns StepValidationResult (valid flag + field errors + resolved step)
   * @throws Error if the form is not found, inactive, not multi-step, or the
   *   step indicator cannot be resolved to a defined step
   */
  async validateStep(
    slug: string,
    data: Record<string, unknown>,
    stepIndicator: string | number
  ): Promise<StepValidationResult> {
    const formService = strapi.plugin('strapi-forms').service('form');
    const validationService = strapi.plugin('strapi-forms').service('validation');

    const form = (await formService.findBySlug(slug)) as SubmittableForm | null;

    if (!form) {
      throw new Error('Form not found');
    }

    if (!form.isActive) {
      throw new Error('Form is not accepting submissions');
    }

    const settings = form.settings;
    const steps = settings?.steps;

    // Step validation only applies to multi-step forms with defined steps.
    if (settings?.layout !== 'multi-step' || !steps?.length) {
      throw new Error('Form is not multi-step');
    }

    const step = this.resolveStep(steps, stepIndicator);

    if (!step) {
      throw new Error('Step not found');
    }

    // Work on a copy with control/spam fields stripped, mirroring submit().
    const submissionData = { ...data };
    delete submissionData[STEP_INDICATOR_FIELD];

    if (settings?.spam?.honeypot) {
      const honeypotFieldName = settings.spam.honeypotFieldName || '_gotcha';
      delete submissionData[honeypotFieldName];
    }

    // Validate only the fields belonging to this step. Step membership is keyed
    // by stable field id; validateSubset also matches by name defensively.
    const validationResult = validationService.validateSubset(
      form.fields || [],
      step.fields || [],
      submissionData
    );

    return {
      valid: validationResult.valid,
      errors: validationResult.errors,
      step: step.id,
    };
  },

  /**
   * Resolve a step indicator (a step id, or a zero-based index passed as a
   * number or numeric string) to its {@link FormStepDefinition}.
   *
   * Id matching takes precedence over index so a purely-numeric step id is not
   * accidentally treated as an index. Returns null when no step matches.
   *
   * @param steps - The form's defined steps
   * @param indicator - Step id or zero-based index
   */
  resolveStep(
    steps: FormStepDefinition[],
    indicator: string | number
  ): FormStepDefinition | null {
    // Prefer an exact id match.
    const byId = steps.find((s) => s.id === String(indicator));
    if (byId) {
      return byId;
    }

    // Fall back to a zero-based numeric index (number or numeric string).
    if (typeof indicator === 'number' || /^\d+$/.test(String(indicator))) {
      const index = Number(indicator);
      if (Number.isInteger(index) && index >= 0 && index < steps.length) {
        return steps[index];
      }
    }

    return null;
  },

  /**
   * Upload the validated files for each `file` field to the Strapi media library
   * and write the resulting media reference(s) into `submissionData` under the
   * field name.
   *
   * Must be called only AFTER {@link ValidationService.validateFiles} has
   * accepted the files, so oversize/disallowed files are never persisted. Uses
   * the core upload plugin's programmatic service (always present — `upload` is
   * a core Strapi plugin). A single uploaded file is stored as one reference
   * object; multiple files as an array of references.
   *
   * @param fields - Form field definitions (only `file` fields are processed)
   * @param files - Uploaded files keyed by field name (from the multipart parser)
   * @param submissionData - Mutable submission data; file refs are written here
   */
  async processFileUploads(
    fields: ValidatableField[],
    files: UploadedFilesMap,
    submissionData: Record<string, unknown>
  ): Promise<void> {
    const uploadService = strapi.plugin('upload').service('upload');

    for (const field of fields) {
      if (field.type !== 'file') {
        continue;
      }

      const uploaded = files[field.name];
      const fileList: UploadedFileMeta[] = uploaded
        ? Array.isArray(uploaded)
          ? uploaded
          : [uploaded]
        : [];

      if (fileList.length === 0) {
        continue;
      }

      // The upload service accepts an array of files in a single call and
      // returns the array of persisted media records.
      const created = (await uploadService.upload({
        data: {},
        files: fileList,
      })) as Array<Record<string, unknown>>;

      const refs = created.map((file) => this.toFileRef(file));

      // Preserve single-vs-multiple semantics: a single uploaded file is stored
      // as one object, multiple files as an array.
      submissionData[field.name] = refs.length === 1 ? refs[0] : refs;
    }
  },

  /**
   * Map a persisted upload-plugin file record to the public-safe media reference
   * we store in submission data.
   *
   * @param file - Raw file record returned by the upload service
   */
  toFileRef(file: Record<string, unknown>): SubmissionFileRef {
    // The upload record stores `size` in KILOBYTES and `sizeInBytes` in bytes.
    // Prefer the byte-accurate field for the stored reference.
    const sizeBytes =
      typeof file.sizeInBytes === 'number'
        ? file.sizeInBytes
        : typeof file.size === 'number'
          ? file.size
          : undefined;

    return {
      id: file.id as number,
      ...(typeof file.documentId === 'string' ? { documentId: file.documentId } : {}),
      url: (file.url as string) ?? '',
      name: (file.name as string) ?? '',
      ...(typeof file.mime === 'string' ? { mime: file.mime } : {}),
      ...(sizeBytes !== undefined ? { size: sizeBytes } : {}),
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
   * When a submission's status or data changes, fires the `submission.updated`
   * webhook event (in the background) for any webhook subscribed to it.
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
    }>,
    options: { triggerWebhooks?: boolean } = {}
  ): Promise<FormSubmission> {
    const { triggerWebhooks = true } = options;

    const result = (await strapi.documents(SUBMISSION_CONTENT_TYPE_UID).update({
      documentId,
      data: data as Record<string, unknown>,
      populate: ['form'],
    })) as unknown as FormSubmission;

    // Fire the submission.updated webhook event in the background.
    // Don't block the update response on webhook delivery. System-driven
    // updates (e.g. auto-mark-as-read on first view) pass triggerWebhooks:false
    // so merely opening a submission does not emit a webhook.
    if (triggerWebhooks) {
      this.triggerUpdateWebhooks(result, data).catch((error: Error) => {
        strapi.log.error('[Strapi Forms] submission.updated webhook error:', error);
      });
    }

    return result;
  },

  /**
   * Trigger `submission.updated` webhooks for an updated submission.
   *
   * Loads the parent form (with settings) and dispatches to any webhook whose
   * events include `submission.updated`.
   *
   * @param submission - The updated submission record (populated with form)
   * @param changed - The fields that were updated (forwarded as webhook data)
   */
  async triggerUpdateWebhooks(
    submission: FormSubmission,
    changed: Record<string, unknown>
  ): Promise<void> {
    const formRef = submission.form as { documentId?: string } | undefined;
    if (!formRef?.documentId) {
      return;
    }

    const formService = strapi.plugin('strapi-forms').service('form');
    const form = (await formService.findOne(formRef.documentId)) as SubmittableForm | null;

    const webhooks = form?.settings?.webhooks;
    if (!webhooks?.length) {
      return;
    }

    const webhookService = strapi.plugin('strapi-forms').service('webhook');

    const webhookFormContext = {
      documentId: form!.documentId,
      title: form!.title,
      slug: form!.slug,
    };

    const webhookSubmissionContext = {
      documentId: submission.documentId,
      status: submission.status,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };

    // The webhook payload data is the submission's current data when available,
    // otherwise the changed fields.
    const payloadData =
      submission.data && typeof submission.data === 'object'
        ? submission.data
        : (changed.data as Record<string, unknown> | undefined);

    await webhookService.triggerAll(
      webhooks,
      'submission.updated',
      webhookFormContext,
      webhookSubmissionContext,
      payloadData
    );
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
  async markAsRead(
    documentId: string,
    options: { triggerWebhooks?: boolean } = {}
  ): Promise<FormSubmission> {
    return this.update(documentId, { status: 'read' }, options);
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

    // Webhooks
    if (settings.webhooks?.length) {
      const webhookService = strapi.plugin('strapi-forms').service('webhook');

      // Prepare form context for webhook
      const webhookFormContext = {
        documentId: form.documentId,
        title: form.title,
        slug: form.slug,
      };

      // Prepare submission context for webhook
      const webhookSubmissionContext = {
        documentId: submission.documentId,
        status: submission.status,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
      };

      // Trigger all webhooks in background to not block response
      webhookService
        .triggerAll(
          settings.webhooks,
          'submission.created',
          webhookFormContext,
          webhookSubmissionContext,
          data
        )
        .catch((error: Error) => {
          strapi.log.error(
            `[Strapi Forms] Webhook trigger failed for form "${form.title}": ${error.message}`
          );
        });
    }
  },
});

export default submissionService;
