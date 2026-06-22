import type { Core } from '@strapi/strapi';

/**
 * Options for exporting submissions
 */
export interface ExportOptions {
  filters?: Record<string, unknown>;
  includeIp?: boolean;
  includeUserAgent?: boolean;
  includeMetadata?: boolean;
}

/**
 * Form field definition for export
 */
interface FormField {
  type: string;
  name: string;
  label: string;
  /**
   * When true, the field is omitted from CSV/JSON exports (e.g. sensitive data
   * such as passwords or tokens). Read loosely so forms saved without this flag
   * behave exactly as before. Defaults to false/absent.
   */
  excludeFromExport?: boolean;
}

/**
 * Submission record for export
 */
interface SubmissionRecord {
  documentId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Form record for export
 */
interface FormRecord {
  documentId: string;
  title: string;
  slug: string;
  fields: FormField[];
}

/**
 * Layout field types that should be excluded from export
 */
const LAYOUT_FIELD_TYPES = ['heading', 'paragraph', 'divider'];

/**
 * Whether a field should appear in exports.
 *
 * Layout fields (heading/paragraph/divider) never carry submission data and so
 * are always excluded, as before. Additionally, any field explicitly flagged
 * with `excludeFromExport` is dropped so sensitive values can be kept out of
 * generated CSV/JSON. Reads the flag loosely (defaults to included) so forms
 * authored before the flag existed are unaffected.
 */
const isExportableField = (field: FormField): boolean =>
  !LAYOUT_FIELD_TYPES.includes(field.type) && field.excludeFromExport !== true;

/**
 * Export service for generating CSV and JSON exports of form submissions
 * Provides properly formatted exports with field labels as headers
 */
const exportService = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Export submissions to CSV format
   *
   * @param formId - Form documentId
   * @param options - Export options (filters, includeIp, etc.)
   * @returns CSV string with proper escaping
   */
  async exportToCSV(formId: string, options: ExportOptions = {}): Promise<string> {
    // Get form to get field definitions
    const form = (await strapi
      .plugin('formflow')
      .service('form')
      .findOne(formId)) as FormRecord | null;

    if (!form) {
      throw new Error('Form not found');
    }

    // Get submissions
    const submissions = (await strapi
      .plugin('formflow')
      .service('submission')
      .find(formId, {
        filters: options.filters,
        sort: { createdAt: 'asc' },
      })) as SubmissionRecord[];

    if (submissions.length === 0) {
      return '';
    }

    // Get field definitions (exclude layout fields and export-excluded fields)
    const fields = (form.fields || []).filter(isExportableField);

    // Build headers
    const headers = [
      'Submission ID',
      'Submitted At',
      'Status',
      ...fields.map((f) => f.label || f.name),
    ];

    if (options.includeIp) {
      headers.push('IP Address');
    }

    if (options.includeUserAgent) {
      headers.push('User Agent');
    }

    // Build rows
    const rows = submissions.map((sub) => {
      const row: string[] = [
        sub.documentId,
        this.formatDate(sub.createdAt),
        sub.status,
        ...fields.map((f) => {
          const value = sub.data?.[f.name];
          return this.formatValue(value, f.type);
        }),
      ];

      if (options.includeIp) {
        row.push(sub.ipAddress || '');
      }

      if (options.includeUserAgent) {
        row.push(sub.userAgent || '');
      }

      return row.map((cell) => this.escapeCSVValue(String(cell ?? '')));
    });

    // Combine headers and rows with BOM for Excel compatibility
    const BOM = '\uFEFF';
    const csv = [
      headers.map((h) => this.escapeCSVValue(h)).join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    return BOM + csv;
  },

  /**
   * Format a value for CSV based on field type
   *
   * @param value - Raw field value
   * @param type - Field type
   * @returns Formatted string value
   */
  formatValue(value: unknown, type: string): string {
    if (value === null || value === undefined) {
      return '';
    }

    switch (type) {
      case 'checkbox':
        // Array of selected values
        if (Array.isArray(value)) {
          return value.join('; ');
        }
        return String(value);

      case 'boolean':
        return value === true || value === 'true' ? 'Yes' : 'No';

      case 'date':
        return this.formatDate(String(value), false);

      case 'datetime':
        return this.formatDate(String(value), true);

      case 'time':
        return String(value);

      case 'number':
        return String(value);

      case 'select':
      case 'radio':
        return String(value);

      case 'file':
        // File values might be objects or URLs
        if (typeof value === 'object' && value !== null) {
          return (value as { url?: string }).url || JSON.stringify(value);
        }
        return String(value);

      default:
        // Handle arrays (shouldn't happen often for other types)
        if (Array.isArray(value)) {
          return value.join('; ');
        }
        return String(value);
    }
  },

  /**
   * Format date for CSV output
   *
   * @param dateStr - ISO date string
   * @param includeTime - Whether to include time component
   * @returns Formatted date string
   */
  formatDate(dateStr: string, includeTime: boolean = true): string {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return dateStr;
      }

      if (includeTime) {
        // Format: YYYY-MM-DD HH:MM:SS
        return date
          .toISOString()
          .replace('T', ' ')
          .replace(/\.\d{3}Z$/, '');
      }
      // Format: YYYY-MM-DD
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  },

  /**
   * Neutralize CSV formula injection.
   *
   * Spreadsheet applications (Excel, Google Sheets, LibreOffice) treat cells
   * beginning with =, +, -, @, tab (\t), or carriage return (\r) as formulas.
   * A malicious submission value like `=cmd|...` could execute on the
   * reviewer's machine. Prefixing such values with a single quote forces them
   * to be treated as literal text.
   *
   * @param value - Raw string value
   * @returns Value safe from formula interpretation
   */
  sanitizeForFormulaInjection(value: string): string {
    if (value.length === 0) {
      return value;
    }

    const firstChar = value.charAt(0);
    if (['=', '+', '-', '@', '\t', '\r'].includes(firstChar)) {
      return `'${value}`;
    }

    return value;
  },

  /**
   * Escape a value for CSV (handles formula injection, quotes, commas, newlines)
   *
   * @param value - Raw string value
   * @returns Properly escaped CSV value
   */
  escapeCSVValue(value: string): string {
    // Neutralize formula injection BEFORE quote-escaping so the guard quote is
    // also wrapped/escaped correctly.
    const guarded = this.sanitizeForFormulaInjection(value);

    // If value contains comma, quote, newline, or carriage return, wrap in quotes
    if (
      guarded.includes(',') ||
      guarded.includes('"') ||
      guarded.includes('\n') ||
      guarded.includes('\r')
    ) {
      // Double up any existing quotes and wrap in quotes
      return `"${guarded.replace(/"/g, '""')}"`;
    }
    return guarded;
  },

  /**
   * Export submissions to JSON format
   *
   * @param formId - Form documentId
   * @param options - Export options
   * @returns JSON string with pretty formatting
   */
  async exportToJSON(formId: string, options: ExportOptions = {}): Promise<string> {
    // Get form for metadata
    const form = (await strapi
      .plugin('formflow')
      .service('form')
      .findOne(formId)) as FormRecord | null;

    if (!form) {
      throw new Error('Form not found');
    }

    // Get submissions
    const submissions = (await strapi
      .plugin('formflow')
      .service('submission')
      .find(formId, {
        filters: options.filters,
        sort: { createdAt: 'asc' },
      })) as SubmissionRecord[];

    // Names of fields explicitly excluded from export. When empty (the common
    // case), each submission's data is emitted verbatim as before.
    const excludedFieldNames = new Set(
      (form.fields || []).filter((f) => f.excludeFromExport === true).map((f) => f.name)
    );

    // Drop excluded keys from a submission's data without mutating the source.
    const stripExcludedData = (data: Record<string, unknown>): Record<string, unknown> => {
      if (excludedFieldNames.size === 0 || !data) {
        return data;
      }
      const filtered: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (!excludedFieldNames.has(key)) {
          filtered[key] = value;
        }
      }
      return filtered;
    };

    // Build export data structure
    const exportData = {
      form: {
        id: form.documentId,
        title: form.title,
        slug: form.slug,
        exportedAt: new Date().toISOString(),
      },
      totalSubmissions: submissions.length,
      submissions: submissions.map((sub) => {
        const entry: Record<string, unknown> = {
          id: sub.documentId,
          status: sub.status,
          submittedAt: sub.createdAt,
          data: stripExcludedData(sub.data),
        };

        if (options.includeIp) {
          entry.ipAddress = sub.ipAddress;
        }

        if (options.includeUserAgent) {
          entry.userAgent = sub.userAgent;
        }

        if (options.includeMetadata) {
          entry.metadata = sub.metadata;
        }

        return entry;
      }),
    };

    return JSON.stringify(exportData, null, 2);
  },

  /**
   * Get export statistics without generating full export
   *
   * @param formId - Form documentId
   * @param filters - Optional filters
   * @returns Export statistics
   */
  async getExportStats(
    formId: string,
    filters: Record<string, unknown> = {}
  ): Promise<{
    totalSubmissions: number;
    fieldCount: number;
    estimatedRows: number;
  }> {
    const form = (await strapi
      .plugin('formflow')
      .service('form')
      .findOne(formId)) as FormRecord | null;

    if (!form) {
      throw new Error('Form not found');
    }

    const totalSubmissions = await strapi
      .plugin('formflow')
      .service('submission')
      .count(formId, filters);

    const fields = (form.fields || []).filter(isExportableField);

    return {
      totalSubmissions,
      fieldCount: fields.length,
      estimatedRows: totalSubmissions + 1, // +1 for header row
    };
  },
});

export default exportService;
