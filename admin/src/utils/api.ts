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
  submissionStats: (formId: string) => `/${PLUGIN_ID}/forms/${formId}/submissions/stats`,
  submission: (id: string) => `/${PLUGIN_ID}/submissions/${id}`,
  // NOTE: the export endpoint is nested under the submissions collection on the server
  // (GET /strapi-forms/forms/:formId/submissions/export).
  exportSubmissions: (formId: string) => `/${PLUGIN_ID}/forms/${formId}/submissions/export`,

  // Field Types
  fieldTypes: `/${PLUGIN_ID}/field-types`,
} as const;

/**
 * Resolve the admin JWT the same way `@strapi/admin`'s fetch client does:
 * primarily from localStorage (`jwtToken`), falling back to a cookie.
 *
 * Used by {@link rawRequest} for the few calls that the standard
 * `useFetchClient` cannot perform (raw text/CSV downloads and a `DELETE`
 * carrying a request body), since that client always JSON-parses responses
 * and never sends a body on `DELETE`.
 */
const getAdminToken = (): string | null => {
  try {
    const fromStorage = window.localStorage.getItem('jwtToken');
    if (fromStorage) {
      return JSON.parse(fromStorage) as string;
    }
  } catch {
    // ignore malformed storage values and fall through to the cookie
  }

  const match = document.cookie.match(/(?:^|;\s*)jwtToken=([^;]+)/);
  if (match) {
    try {
      return JSON.parse(decodeURIComponent(match[1])) as string;
    } catch {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
};

/**
 * Prefix a plugin-relative URL with the configured Strapi backend URL.
 */
const withBackendUrl = (url: string): string => {
  const backendURL = (window as unknown as { strapi?: { backendURL?: string } }).strapi?.backendURL;
  const normalized = url.charAt(0) === '/' ? url : `/${url}`;
  return backendURL ? `${backendURL}${normalized}` : normalized;
};

/**
 * Options for {@link rawRequest}.
 */
export interface RawRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  accept?: string;
  signal?: AbortSignal;
}

/**
 * Result of a {@link rawRequest} call.
 */
export interface RawRequestResult {
  ok: boolean;
  status: number;
  text: string;
}

/**
 * Attempt to extract a human-readable error message from a Strapi error
 * response body. Strapi serializes errors as `{ error: { message } }`; fall
 * back to the raw text (or undefined) when the body is not JSON.
 */
const extractErrorMessage = (text: string): string | undefined => {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return parsed?.error?.message || parsed?.message || undefined;
  } catch {
    return text.trim() || undefined;
  }
};

/**
 * Perform an authenticated request using the native `fetch` API and return the
 * raw response body as text. This intentionally bypasses `useFetchClient` for
 * the two cases it cannot handle:
 *  - downloading a `text/csv` (or raw JSON) export without JSON-parsing it
 *  - sending a `DELETE` with a JSON body (batch delete)
 *
 * Throws a descriptive `Error` when the admin token cannot be resolved (so the
 * request is never sent unauthenticated) and on any non-ok response, surfacing
 * the server's error message when the body can be parsed.
 */
export const rawRequest = async (
  url: string,
  options: RawRequestOptions
): Promise<RawRequestResult> => {
  const token = getAdminToken();
  if (!token) {
    throw new Error('Not authenticated: missing admin session token');
  }

  const headers: Record<string, string> = {
    Accept: options.accept ?? 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const init: RequestInit = {
    method: options.method,
    headers,
    signal: options.signal,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(withBackendUrl(url), init);
  const text = await response.text();

  if (!response.ok) {
    const serverMessage = extractErrorMessage(text);
    throw new Error(
      serverMessage || `Request failed with status ${response.status}`
    );
  }

  return { ok: response.ok, status: response.status, text };
};

/**
 * All supported form field type names (18 total).
 * Mirrors the server `getFieldTypes()` registry.
 */
export type FieldTypeName =
  // basic
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'phone'
  | 'url'
  | 'password'
  // choice
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'boolean'
  // datetime
  | 'date'
  | 'time'
  | 'datetime'
  // advanced
  | 'file'
  | 'hidden'
  // layout
  | 'heading'
  | 'paragraph'
  | 'divider';

/**
 * Category grouping for field types (used by the field selector)
 */
export type FieldTypeCategory = 'basic' | 'choice' | 'datetime' | 'advanced' | 'layout';

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
  /** One of {@link FieldTypeName}; kept as a widened `string` for forward-compatibility. */
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
 * A single step in a multi-step (wizard) form
 */
export interface FormStep {
  id: string;
  title: string;
  description?: string;
  fields: string[];
}

/**
 * Email notification configuration
 */
export interface EmailNotification {
  enabled: boolean;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  replyTo?: string;
  includeData?: boolean;
  template?: string;
}

/**
 * Webhook event types
 */
export type WebhookEvent = 'submission.created' | 'submission.updated' | 'submission.deleted';

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  enabled: boolean;
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  events: WebhookEvent[];
  includeFormData?: boolean;
  secret?: string;
  timeout?: number;
}

/**
 * Google reCAPTCHA configuration (part of spam protection)
 */
export interface RecaptchaConfig {
  enabled: boolean;
  siteKey: string;
  secretKey: string;
  version: 'v2' | 'v3';
  threshold?: number;
}

/**
 * Spam protection settings
 */
export interface SpamSettings {
  honeypot: boolean;
  honeypotFieldName: string;
  recaptcha?: RecaptchaConfig;
}

/**
 * Per-form rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  maxSubmissions: number;
  windowMs: number;
}

/**
 * Form settings configuration
 */
export interface FormSettings {
  submitButtonText: string;
  resetButtonText: string;
  showResetButton: boolean;
  layout: 'single' | 'multi-step';
  steps?: FormStep[];
  emailNotifications: EmailNotification[];
  webhooks: WebhookConfig[];
  spam: SpamSettings;
  rateLimit?: RateLimitConfig;
  customCss?: string;
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
 * Form submission with form relation (returned by detail endpoint)
 */
export interface FormSubmissionDetail extends FormSubmission {
  form?: {
    documentId: string;
    title: string;
    fields: FormField[];
  };
}

/**
 * Field type definition for the form builder (returned by GET /field-types).
 *
 * NOTE: this is exported as `FieldType` for backward compatibility — existing
 * hooks/components consume `FieldType` as this object shape. Use
 * {@link FieldTypeName} for the string-literal union of the 18 type names.
 */
export interface FieldType {
  type: FieldTypeName;
  label: string;
  icon: string;
  category: FieldTypeCategory;
}

/**
 * @deprecated Alias of {@link FieldType}. Prefer `FieldType` for the definition shape.
 */
export type FieldTypeDefinition = FieldType;

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
}

/**
 * Pagination metadata returned by paginated endpoints
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

/**
 * Paginated API response wrapper (data + meta.pagination)
 */
export interface PaginatedResponse<T> {
  data: T;
  meta: {
    pagination: PaginationMeta;
  };
}

/**
 * Paginated forms list response (matches the server contract)
 */
export type PaginatedForms = PaginatedResponse<Form[]>;

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
  _q?: string;
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

/**
 * Export format options for submissions
 */
export type ExportFormat = 'csv' | 'json';

/**
 * Options for exporting submissions
 */
export interface ExportOptions {
  format?: ExportFormat;
  status?: SubmissionStatus;
  includeIp?: boolean;
}
