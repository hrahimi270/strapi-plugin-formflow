import { PLUGIN_ID } from '../pluginId';

/**
 * API endpoint builders for the strapi-forms plugin
 */
export const API = {
  // Forms
  forms: `/${PLUGIN_ID}/forms`,
  formsCount: `/${PLUGIN_ID}/forms/count`,
  form: (id: string) => `/${PLUGIN_ID}/forms/${id}`,
  duplicateForm: (id: string) => `/${PLUGIN_ID}/forms/${id}/duplicate`,

  // Submissions
  submissions: (formId: string) => `/${PLUGIN_ID}/forms/${formId}/submissions`,
  submission: (id: string) => `/${PLUGIN_ID}/submissions/${id}`,
  exportSubmissions: (formId: string) => `/${PLUGIN_ID}/forms/${formId}/export`,

  // Field Types
  fieldTypes: `/${PLUGIN_ID}/field-types`,
} as const;

/**
 * Validation rule for form fields
 */
export interface ValidationRule {
  type: string;
  value?: unknown;
  message: string;
}

/**
 * Option for select/radio/checkbox fields
 */
export interface FieldOption {
  label: string;
  value: string;
}

/**
 * Conditional display rule for fields
 */
export interface ConditionalRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
  value?: unknown;
}

/**
 * Form field definition
 */
export interface FormField {
  id: string;
  type: string;
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  required: boolean;
  validation: ValidationRule[];
  options?: FieldOption[];
  defaultValue?: unknown;
  order: number;
  width?: 'full' | 'half';
  conditional?: ConditionalRule;
  attributes?: Record<string, unknown>;
}

/**
 * Email notification configuration
 */
export interface EmailNotification {
  enabled: boolean;
  to: string[];
  subject: string;
  template?: string;
  replyTo?: string;
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  enabled: boolean;
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  events: Array<'submission.created' | 'submission.updated'>;
}

/**
 * Spam protection settings
 */
export interface SpamSettings {
  honeypot: boolean;
  honeypotFieldName: string;
}

/**
 * Form settings configuration
 */
export interface FormSettings {
  submitButtonText: string;
  resetButtonText: string;
  showResetButton: boolean;
  layout: 'single' | 'multi-step';
  emailNotifications: EmailNotification[];
  webhooks: WebhookConfig[];
  spam: SpamSettings;
}

/**
 * Form entity from the API
 */
export interface Form {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  description?: string;
  fields: FormField[];
  settings: FormSettings;
  successMessage: string;
  redirectUrl?: string;
  isActive: boolean;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

/**
 * Submission status type
 */
export type SubmissionStatus = 'new' | 'read' | 'processed' | 'archived' | 'spam';

/**
 * Form submission entity
 */
export interface FormSubmission {
  id: number;
  documentId: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: SubmissionStatus;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Field type definition for form builder
 */
export interface FieldType {
  type: string;
  label: string;
  icon: string;
  category: 'basic' | 'choice' | 'datetime' | 'advanced' | 'layout';
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
}

/**
 * API error response
 */
export interface ApiError {
  data: null;
  error: {
    status: number;
    name: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Form creation/update payload
 */
export interface FormPayload {
  title: string;
  slug?: string;
  description?: string;
  fields?: Partial<FormField>[];
  settings?: Partial<FormSettings>;
  successMessage?: string;
  redirectUrl?: string;
  isActive?: boolean;
}

/**
 * Submission update payload
 */
export interface SubmissionUpdatePayload {
  status?: SubmissionStatus;
}

/**
 * Query parameters for listing forms
 */
export interface FormsQueryParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  filters?: Record<string, unknown>;
}

/**
 * Query parameters for listing submissions
 */
export interface SubmissionsQueryParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  status?: SubmissionStatus;
}
