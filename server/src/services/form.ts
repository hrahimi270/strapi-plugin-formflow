import type { Core } from '@strapi/strapi';
import { v4 as uuidv4 } from 'uuid';

/**
 * Field type definition for the form builder
 */
export interface FieldType {
  type: string;
  label: string;
  icon: string;
  category: 'basic' | 'choice' | 'datetime' | 'advanced' | 'layout';
}

/**
 * Form field structure stored in the fields JSON array
 */
export interface FormField {
  id: string;
  type: string;
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  required: boolean;
  validation: Array<{
    type: string;
    value?: unknown;
    message: string;
  }>;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: unknown;
  order: number;
  width?: 'full' | 'half';
  conditional?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
    value?: unknown;
  };
  attributes?: Record<string, unknown>;
}

/**
 * Multi-step form step definition
 */
export interface FormStep {
  id: string;
  title: string;
  description?: string;
  fields: string[];
}

/**
 * reCAPTCHA configuration. The secretKey is server-only and MUST NEVER be
 * exposed through the public schema.
 */
export interface RecaptchaConfig {
  enabled: boolean;
  siteKey: string;
  secretKey: string;
  version: 'v2' | 'v3';
  threshold?: number;
}

/**
 * Spam protection configuration
 */
export interface SpamProtectionConfig {
  honeypot: boolean;
  honeypotFieldName: string;
  recaptcha?: RecaptchaConfig;
}

/**
 * Default form settings structure
 */
export interface FormSettings {
  submitButtonText: string;
  showResetButton: boolean;
  resetButtonText: string;
  layout: 'single' | 'multi-step';
  steps?: FormStep[];
  emailNotifications: Array<{
    enabled: boolean;
    to: string[];
    subject: string;
    template?: string;
    replyTo?: string;
  }>;
  webhooks: Array<{
    enabled: boolean;
    url: string;
    method: 'POST' | 'PUT';
    headers?: Record<string, string>;
    events: Array<'submission.created' | 'submission.updated'>;
  }>;
  spam: SpamProtectionConfig;
  /**
   * Optional raw CSS the consuming frontend may inject when rendering the form
   * (e.g. into a <style> tag). Exposed verbatim through the public schema; the
   * server never interprets it. Empty by default so existing forms are
   * unaffected.
   */
  customCss?: string;
}

const CONTENT_TYPE_UID = 'plugin::strapi-forms.form';
const SUBMISSION_CONTENT_TYPE_UID = 'plugin::strapi-forms.form-submission';

const formService = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Find all forms with optional query parameters
   */
  async find(query: Record<string, unknown> = {}) {
    return strapi.documents(CONTENT_TYPE_UID).findMany({
      ...query,
    });
  },

  /**
   * Find a single form by documentId
   */
  async findOne(documentId: string) {
    return strapi.documents(CONTENT_TYPE_UID).findOne({
      documentId,
    });
  },

  /**
   * Find a form by its slug (used for public API)
   *
   * Returns the PUBLISHED version of the form. With draftAndPublish enabled,
   * the document service defaults to the draft version (publishedAt=null),
   * which would make published+active forms appear unpublished to the public
   * API. Passing status:'published' ensures the public-facing record is used.
   */
  async findBySlug(slug: string) {
    const forms = await strapi.documents(CONTENT_TYPE_UID).findMany({
      filters: { slug },
      status: 'published',
      limit: 1,
    });
    return forms[0] || null;
  },

  /**
   * Find the DRAFT version of a form by its slug (admin-only lookup)
   */
  async findDraftBySlug(slug: string) {
    const forms = await strapi.documents(CONTENT_TYPE_UID).findMany({
      filters: { slug },
      status: 'draft',
      limit: 1,
    });
    return forms[0] || null;
  },

  /**
   * Create a new form with auto-generated field IDs
   */
  async create(data: {
    title: string;
    slug?: string;
    description?: string;
    fields?: Partial<FormField>[];
    settings?: Partial<FormSettings>;
    successMessage?: string;
    redirectUrl?: string;
    isActive?: boolean;
  }) {
    // Generate UUIDs for fields if not provided and ensure proper ordering
    const processedFields = data.fields
      ? data.fields.map((field, index) => ({
          ...field,
          id: field.id || uuidv4(),
          order: field.order ?? index,
          required: field.required ?? false,
          validation: field.validation || [],
        }))
      : [];

    return strapi.documents(CONTENT_TYPE_UID).create({
      status: 'published',
      data: {
        ...data,
        fields: processedFields,
        settings: {
          ...this.getDefaultSettings(),
          ...data.settings,
        },
      },
    });
  },

  /**
   * Update an existing form
   */
  async update(
    documentId: string,
    data: {
      title?: string;
      slug?: string;
      description?: string;
      fields?: Partial<FormField>[];
      settings?: Partial<FormSettings>;
      successMessage?: string;
      redirectUrl?: string;
      isActive?: boolean;
      submissionCount?: number;
    }
  ) {
    // Process fields to ensure they have IDs and proper ordering
    const processedData: Record<string, unknown> = { ...data };
    if (data.fields) {
      processedData.fields = data.fields.map((field, index) => ({
        ...field,
        id: field.id || uuidv4(),
        order: field.order ?? index,
      }));
    }

    return strapi.documents(CONTENT_TYPE_UID).update({
      documentId,
      status: 'published',
      data: processedData,
    });
  },

  /**
   * Delete a form and all its associated submissions
   */
  async delete(documentId: string) {
    // First, delete all associated submissions to maintain referential integrity
    const submissions = await strapi.documents(SUBMISSION_CONTENT_TYPE_UID).findMany({
      filters: { form: { documentId } },
    });

    // Delete submissions in parallel for better performance
    await Promise.all(
      submissions.map((submission) =>
        strapi.documents(SUBMISSION_CONTENT_TYPE_UID).delete({
          documentId: submission.documentId,
        })
      )
    );

    // Now delete the form itself
    return strapi.documents(CONTENT_TYPE_UID).delete({
      documentId,
    });
  },

  /**
   * Generate a slug for a duplicated form that is unique across existing forms.
   *
   * Derives a base of `${original}-copy` and, if that is already taken, appends
   * an incrementing suffix (`-copy-2`, `-copy-3`, ...) until a free slug is
   * found. A null/empty base falls back to `form-copy`.
   */
  async generateUniqueSlug(baseSlug: string) {
    const base = `${baseSlug || 'form'}-copy`;

    let candidate = base;
    let suffix = 2;

    // Check against the draft version: every document has a draft row, so this
    // reliably detects any existing form using the candidate slug.
    while (
      (
        await strapi.documents(CONTENT_TYPE_UID).findMany({
          filters: { slug: candidate },
          status: 'draft',
          limit: 1,
        })
      ).length > 0
    ) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  },

  /**
   * Duplicate an existing form with a new title and a unique slug.
   *
   * create() does not backfill a slug, so we must generate one here; otherwise
   * the copy is saved with slug:null, which breaks the editor and 404s the
   * public API.
   */
  async duplicate(documentId: string) {
    const original = await this.findOne(documentId);

    if (!original) {
      throw new Error('Form not found');
    }

    // Extract only the data fields we need, excluding system fields
    const { title, slug, description, fields, settings, successMessage, redirectUrl, isActive } =
      original;

    // Generate new field IDs for the duplicated form to ensure uniqueness
    const duplicatedFields = Array.isArray(fields)
      ? fields.map((field: FormField) => ({
          ...field,
          id: uuidv4(),
        }))
      : [];

    const newSlug = await this.generateUniqueSlug(slug as string);

    return this.create({
      title: `${title} (Copy)`,
      slug: newSlug,
      description,
      fields: duplicatedFields,
      settings: settings as Partial<FormSettings>,
      successMessage,
      redirectUrl,
      isActive,
    });
  },

  /**
   * Get form schema for public API consumption (sanitized)
   */
  async getPublicSchema(slug: string) {
    const form = await this.findBySlug(slug);

    if (!form || !form.isActive) {
      return null;
    }

    const settings = (form.settings || {}) as FormSettings;
    const fields = (form.fields || []) as FormField[];

    // Return only public-safe data, excluding sensitive settings
    return {
      title: form.title,
      description: form.description,
      slug: form.slug,
      fields: fields.map((field) => ({
        id: field.id,
        type: field.type,
        name: field.name,
        label: field.label,
        placeholder: field.placeholder,
        description: field.description,
        required: field.required,
        options: field.options,
        defaultValue: field.defaultValue,
        order: field.order,
        width: field.width,
        conditional: field.conditional,
        validation: (field.validation || []).map((v) => ({
          type: v.type,
          value: v.value,
          message: v.message,
        })),
      })),
      settings: {
        submitButtonText: settings.submitButtonText || 'Submit',
        showResetButton: settings.showResetButton || false,
        resetButtonText: settings.resetButtonText || 'Reset',
        layout: settings.layout || 'single',
        // Expose steps only for multi-step layouts so the frontend can render them
        ...(settings.layout === 'multi-step' && settings.steps
          ? { steps: settings.steps }
          : {}),
        // Expose custom CSS only when set so the consuming frontend can inject
        // it (e.g. into a <style> tag). Omitted entirely when empty, keeping the
        // response shape unchanged for existing forms.
        ...(settings.customCss ? { customCss: settings.customCss } : {}),
        spam: {
          honeypot: settings.spam?.honeypot || false,
          honeypotFieldName: settings.spam?.honeypotFieldName,
          // Expose only public-safe reCAPTCHA fields (NEVER the secretKey)
          ...(settings.spam?.recaptcha?.enabled
            ? {
                recaptcha: {
                  siteKey: settings.spam.recaptcha.siteKey,
                  version: settings.spam.recaptcha.version,
                },
              }
            : {}),
        },
      },
    };
  },

  /**
   * Get default settings for a new form
   */
  getDefaultSettings(): FormSettings {
    return {
      submitButtonText: 'Submit',
      showResetButton: false,
      resetButtonText: 'Reset',
      layout: 'single',
      emailNotifications: [],
      webhooks: [],
      spam: {
        honeypot: true,
        honeypotFieldName: '_gotcha',
      },
      customCss: '',
    };
  },

  /**
   * Get all supported field types for the form builder
   */
  getFieldTypes(): FieldType[] {
    return [
      // Basic input fields
      { type: 'text', label: 'Text', icon: 'text', category: 'basic' },
      { type: 'textarea', label: 'Text Area', icon: 'text', category: 'basic' },
      { type: 'email', label: 'Email', icon: 'mail', category: 'basic' },
      { type: 'number', label: 'Number', icon: 'number', category: 'basic' },
      { type: 'phone', label: 'Phone', icon: 'phone', category: 'basic' },
      { type: 'url', label: 'URL', icon: 'link', category: 'basic' },
      { type: 'password', label: 'Password', icon: 'lock', category: 'basic' },

      // Choice fields
      {
        type: 'select',
        label: 'Dropdown',
        icon: 'chevron-down',
        category: 'choice',
      },
      {
        type: 'radio',
        label: 'Radio Buttons',
        icon: 'circle',
        category: 'choice',
      },
      {
        type: 'checkbox',
        label: 'Checkboxes',
        icon: 'check-square',
        category: 'choice',
      },
      {
        type: 'boolean',
        label: 'Yes/No Toggle',
        icon: 'toggle',
        category: 'choice',
      },

      // Date/Time fields
      { type: 'date', label: 'Date', icon: 'calendar', category: 'datetime' },
      { type: 'time', label: 'Time', icon: 'clock', category: 'datetime' },
      {
        type: 'datetime',
        label: 'Date & Time',
        icon: 'calendar',
        category: 'datetime',
      },

      // Advanced fields
      {
        type: 'file',
        label: 'File Upload',
        icon: 'upload',
        category: 'advanced',
      },
      {
        type: 'hidden',
        label: 'Hidden Field',
        icon: 'eye-off',
        category: 'advanced',
      },

      // Layout elements
      { type: 'heading', label: 'Heading', icon: 'type', category: 'layout' },
      {
        type: 'paragraph',
        label: 'Paragraph',
        icon: 'align-left',
        category: 'layout',
      },
      { type: 'divider', label: 'Divider', icon: 'minus', category: 'layout' },
    ];
  },

  /**
   * Recompute and persist the submission count for a form.
   *
   * Rather than a racy read-modify-write on the draft, this derives the count
   * from the authoritative number of related submissions so concurrent
   * submissions cannot clobber each other.
   *
   * IMPORTANT: this must NOT call documents().update({ status: 'published' }).
   * That writes the count to the draft and then publishes the WHOLE draft over
   * the published version, force-publishing any in-progress unpublished admin
   * edits to title/fields/settings on every public submit. Instead we:
   *   1. Write the count to the DRAFT via a normal document service update
   *      (no status change, so this stays draft-only and triggers no publish).
   *   2. Patch ONLY the published row's `submissionCount` column directly via
   *      the lower-level query engine, which does not run publish() and so
   *      leaves the rest of the published record untouched.
   * Both draft and published rows therefore stay in sync without leaking draft
   * edits into the published, public-facing form.
   */
  async incrementSubmissionCount(documentId: string) {
    const total = await strapi.documents(SUBMISSION_CONTENT_TYPE_UID).count({
      filters: { form: { documentId } },
    });

    // 1. Write to the draft only (default target for the document service).
    const updated = await strapi.documents(CONTENT_TYPE_UID).update({
      documentId,
      data: { submissionCount: total } as Record<string, unknown>,
    });

    // 2. Patch the published row's column directly (if a published version
    // exists) WITHOUT triggering publish(), so the public schema reflects the
    // same count without copying unpublished draft edits over the published
    // record. updateMany is a no-op when no published row matches.
    try {
      await strapi.db.query(CONTENT_TYPE_UID).updateMany({
        where: { documentId, publishedAt: { $notNull: true } },
        data: { submissionCount: total },
      });
    } catch (error) {
      strapi.log.warn(
        `[Strapi Forms] Failed to sync published submissionCount for form ${documentId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    return updated;
  },

  /**
   * Count forms matching optional filters
   */
  async count(filters: Record<string, unknown> = {}) {
    return strapi.documents(CONTENT_TYPE_UID).count({
      filters,
    });
  },
});

export default formService;
