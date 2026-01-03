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
 * Default form settings structure
 */
export interface FormSettings {
  submitButtonText: string;
  showResetButton: boolean;
  resetButtonText: string;
  layout: 'single' | 'multi-step';
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
  spam: {
    honeypot: boolean;
    honeypotFieldName: string;
  };
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
   */
  async findBySlug(slug: string) {
    const forms = await strapi.documents(CONTENT_TYPE_UID).findMany({
      filters: { slug },
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
   * Duplicate an existing form with a new title and slug
   */
  async duplicate(documentId: string) {
    const original = await this.findOne(documentId);

    if (!original) {
      throw new Error('Form not found');
    }

    // Extract only the data fields we need, excluding system fields
    const { title, description, fields, settings, successMessage, redirectUrl, isActive } =
      original;

    // Generate new field IDs for the duplicated form to ensure uniqueness
    const duplicatedFields = Array.isArray(fields)
      ? fields.map((field: FormField) => ({
          ...field,
          id: uuidv4(),
        }))
      : [];

    return this.create({
      title: `${title} (Copy)`,
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
        spam: settings.spam
          ? {
              honeypot: settings.spam.honeypot || false,
              honeypotFieldName: settings.spam.honeypotFieldName,
            }
          : { honeypot: false },
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
   * Increment the submission count for a form
   */
  async incrementSubmissionCount(documentId: string) {
    const form = await this.findOne(documentId);
    if (!form) {
      throw new Error('Form not found');
    }

    const currentCount = typeof form.submissionCount === 'number' ? form.submissionCount : 0;

    return this.update(documentId, {
      submissionCount: currentCount + 1,
    });
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
