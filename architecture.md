# FormFlow Plugin - Architecture Document

## Table of Contents

1. [Overview](#overview)
2. [Plugin Goals](#plugin-goals)
3. [Technology Stack](#technology-stack)
4. [Data Models](#data-models)
5. [Server Architecture](#server-architecture)
6. [Admin Panel Architecture](#admin-panel-architecture)
7. [API Design](#api-design)
8. [Field Types](#field-types)
9. [Validation System](#validation-system)
10. [Security Considerations](#security-considerations)
11. [File Structure](#file-structure)
12. [Implementation Phases](#implementation-phases)

---

## Overview

**FormFlow** is a Strapi v5 plugin that enables administrators to create dynamic, configurable forms through the admin panel. Unlike traditional form builders, this plugin is designed for headless CMS architectures where:

- Forms are defined and managed in Strapi admin
- Form schemas are exposed via API endpoints for frontend consumption
- Form submissions are received, validated, and stored via API endpoints
- All submissions are viewable and exportable from the admin panel

This approach allows frontend developers to dynamically render forms using any framework (React, Vue, Next.js, etc.) while maintaining full control over form logic and data in Strapi.

---

## Plugin Goals

### Primary Goals

1. **Form Builder**: Allow admins to create forms with various field types, labels, placeholders, and validation rules
2. **Schema API**: Expose form schemas via REST API for frontend dynamic rendering
3. **Submission Handler**: Receive and validate form submissions securely
4. **Submission Management**: View, filter, and manage submissions in admin panel
5. **Data Export**: Export submissions to CSV format

### Secondary Goals

1. **Conditional Logic**: Fields that show/hide based on other field values
2. **Multi-step Forms**: Support for wizard-style multi-page forms
3. **Email Notifications**: Send email on form submission
4. **Webhook Integration**: Trigger webhooks on form events
5. **Spam Protection**: Honeypot fields, rate limiting, reCAPTCHA support

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| CMS | Strapi v5.33+ |
| Plugin SDK | @strapi/sdk-plugin v5.4+ |
| UI Components | @strapi/design-system v2.0+ |
| Icons | @strapi/icons v2.0+ |
| Frontend State | React 18 with hooks |
| Routing | react-router-dom v6 |
| Internationalization | react-intl |
| Validation | Zod (recommended) or Yup |
| Styling | styled-components v6 |

---

## Data Models

### Content Type: `Form`

The main entity representing a form configuration.

```typescript
// server/src/content-types/form/schema.json
{
  "kind": "collectionType",
  "collectionName": "forms",
  "info": {
    "singularName": "form",
    "pluralName": "forms",
    "displayName": "Form"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {
    "content-manager": {
      "visible": false
    },
    "content-type-builder": {
      "visible": false
    }
  },
  "attributes": {
    "title": {
      "type": "string",
      "required": true,
      "maxLength": 255
    },
    "slug": {
      "type": "uid",
      "targetField": "title",
      "required": true
    },
    "description": {
      "type": "text"
    },
    "fields": {
      "type": "json",
      "required": true,
      "default": []
    },
    "settings": {
      "type": "json",
      "default": {}
    },
    "successMessage": {
      "type": "text",
      "default": "Thank you for your submission!"
    },
    "redirectUrl": {
      "type": "string"
    },
    "isActive": {
      "type": "boolean",
      "default": true
    },
    "submissionCount": {
      "type": "integer",
      "default": 0
    }
  }
}
```

### Content Type: `FormSubmission`

Stores individual form submissions.

```typescript
// server/src/content-types/form-submission/schema.json
{
  "kind": "collectionType",
  "collectionName": "form_submissions",
  "info": {
    "singularName": "form-submission",
    "pluralName": "form-submissions",
    "displayName": "Form Submission"
  },
  "options": {
    "draftAndPublish": false
  },
  "pluginOptions": {
    "content-manager": {
      "visible": false
    },
    "content-type-builder": {
      "visible": false
    }
  },
  "attributes": {
    "form": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "plugin::formflow.form",
      "inversedBy": "submissions"
    },
    "data": {
      "type": "json",
      "required": true
    },
    "metadata": {
      "type": "json",
      "default": {}
    },
    "status": {
      "type": "enumeration",
      "enum": ["new", "read", "archived"],
      "default": "new"
    },
    "ipAddress": {
      "type": "string"
    },
    "userAgent": {
      "type": "text"
    }
  }
}
```

### Field Schema Structure (JSON)

Each field in the `fields` array follows this structure:

```typescript
interface FormField {
  id: string;                    // Unique identifier (UUID)
  type: FieldType;               // Field type enum
  name: string;                  // Field name (used as key in submissions)
  label: string;                 // Display label
  placeholder?: string;          // Placeholder text
  description?: string;          // Help text below field
  required: boolean;             // Is field required
  validation: ValidationRule[];  // Validation rules array
  options?: FieldOption[];       // For select/radio/checkbox fields
  defaultValue?: any;            // Default value
  order: number;                 // Display order
  width?: 'full' | 'half';       // Layout width
  conditional?: ConditionalRule; // Conditional display logic
  attributes?: Record<string, any>; // Additional HTML attributes
}

interface FieldOption {
  label: string;
  value: string;
}

interface ValidationRule {
  type: ValidationType;
  value?: any;
  message: string;
}

interface ConditionalRule {
  field: string;         // Name of field to check
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
  value?: any;
}
```

### Form Settings Structure

```typescript
interface FormSettings {
  submitButtonText: string;
  resetButtonText?: string;
  showResetButton: boolean;
  layout: 'single' | 'multi-step';
  steps?: FormStep[];                    // For multi-step forms
  emailNotifications: EmailNotification[];
  webhooks: WebhookConfig[];
  spam: SpamProtectionConfig;
  rateLimit?: RateLimitConfig;
  customCss?: string;
}

interface FormStep {
  id: string;
  title: string;
  description?: string;
  fields: string[];  // Field IDs in this step
}

interface EmailNotification {
  enabled: boolean;
  to: string[];
  subject: string;
  template?: string;
  replyTo?: string;
}

interface WebhookConfig {
  enabled: boolean;
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  events: ('submission.created' | 'submission.updated')[];
}

interface SpamProtectionConfig {
  honeypot: boolean;
  honeypotFieldName: string;
  recaptcha?: {
    enabled: boolean;
    siteKey: string;
    secretKey: string;
    version: 'v2' | 'v3';
    threshold?: number;  // For v3
  };
}

interface RateLimitConfig {
  enabled: boolean;
  maxSubmissions: number;
  windowMs: number;  // Time window in milliseconds
}
```

---

## Server Architecture

### Directory Structure

```
server/src/
├── index.ts                 # Main plugin entry
├── register.ts              # Plugin registration hook
├── bootstrap.ts             # Bootstrap hook (runs on startup)
├── destroy.ts               # Cleanup hook
├── config/
│   └── index.ts             # Plugin configuration schema
├── content-types/
│   ├── index.ts
│   ├── form/
│   │   ├── index.ts
│   │   └── schema.json
│   └── form-submission/
│       ├── index.ts
│       └── schema.json
├── controllers/
│   ├── index.ts
│   ├── form.ts              # Form CRUD controller
│   ├── submission.ts        # Submission controller
│   └── public.ts            # Public API controller
├── services/
│   ├── index.ts
│   ├── form.ts              # Form business logic
│   ├── submission.ts        # Submission business logic
│   ├── validation.ts        # Validation service
│   └── export.ts            # CSV export service
├── routes/
│   ├── index.ts
│   ├── admin/
│   │   └── index.ts         # Admin routes
│   └── content-api/
│       └── index.ts         # Public API routes
├── policies/
│   ├── index.ts
│   ├── is-form-active.ts    # Check if form accepts submissions
│   └── rate-limit.ts        # Rate limiting policy
├── middlewares/
│   ├── index.ts
│   └── spam-check.ts        # Spam protection middleware
└── utils/
    ├── validation-rules.ts  # Validation rule definitions
    └── sanitize.ts          # Input sanitization utilities
```

### Routes

#### Admin Routes (`/formflow/`)

```typescript
// server/src/routes/admin/index.ts
export default {
  type: 'admin',
  routes: [
    // Form Management
    {
      method: 'GET',
      path: '/forms',
      handler: 'form.find',
      config: { policies: [] }
    },
    {
      method: 'GET',
      path: '/forms/:id',
      handler: 'form.findOne',
      config: { policies: [] }
    },
    {
      method: 'POST',
      path: '/forms',
      handler: 'form.create',
      config: { policies: [] }
    },
    {
      method: 'PUT',
      path: '/forms/:id',
      handler: 'form.update',
      config: { policies: [] }
    },
    {
      method: 'DELETE',
      path: '/forms/:id',
      handler: 'form.delete',
      config: { policies: [] }
    },
    {
      method: 'POST',
      path: '/forms/:id/duplicate',
      handler: 'form.duplicate',
      config: { policies: [] }
    },

    // Submission Management
    {
      method: 'GET',
      path: '/forms/:formId/submissions',
      handler: 'submission.find',
      config: { policies: [] }
    },
    {
      method: 'GET',
      path: '/submissions/:id',
      handler: 'submission.findOne',
      config: { policies: [] }
    },
    {
      method: 'PUT',
      path: '/submissions/:id',
      handler: 'submission.update',
      config: { policies: [] }
    },
    {
      method: 'DELETE',
      path: '/submissions/:id',
      handler: 'submission.delete',
      config: { policies: [] }
    },
    {
      method: 'DELETE',
      path: '/forms/:formId/submissions',
      handler: 'submission.deleteMany',
      config: { policies: [] }
    },

    // Export
    {
      method: 'GET',
      path: '/forms/:formId/export',
      handler: 'submission.export',
      config: { policies: [] }
    },

    // Field Types
    {
      method: 'GET',
      path: '/field-types',
      handler: 'form.getFieldTypes',
      config: { policies: [] }
    }
  ]
};
```

#### Content API Routes (`/api/formflow/forms/`)

```typescript
// server/src/routes/content-api/index.ts
export default {
  type: 'content-api',
  routes: [
    // Get form schema for rendering
    {
      method: 'GET',
      path: '/forms/:slug',
      handler: 'public.getFormSchema',
      config: {
        policies: ['plugin::formflow.is-form-active'],
        auth: false  // Public by default, can be configured
      }
    },

    // Submit form
    {
      method: 'POST',
      path: '/forms/:slug/submit',
      handler: 'public.submitForm',
      config: {
        policies: [
          'plugin::formflow.is-form-active',
          'plugin::formflow.rate-limit'
        ],
        middlewares: ['plugin::formflow.spam-check'],
        auth: false
      }
    }
  ]
};
```

### Controllers

#### Form Controller

```typescript
// server/src/controllers/form.ts
import type { Core } from '@strapi/strapi';

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx) {
    const forms = await strapi
      .plugin('formflow')
      .service('form')
      .find(ctx.query);

    return { data: forms };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const form = await strapi
      .plugin('formflow')
      .service('form')
      .findOne(id);

    if (!form) {
      return ctx.notFound('Form not found');
    }

    return { data: form };
  },

  async create(ctx) {
    const data = ctx.request.body;
    const form = await strapi
      .plugin('formflow')
      .service('form')
      .create(data);

    return { data: form };
  },

  async update(ctx) {
    const { id } = ctx.params;
    const data = ctx.request.body;
    const form = await strapi
      .plugin('formflow')
      .service('form')
      .update(id, data);

    return { data: form };
  },

  async delete(ctx) {
    const { id } = ctx.params;
    await strapi
      .plugin('formflow')
      .service('form')
      .delete(id);

    return { data: { success: true } };
  },

  async duplicate(ctx) {
    const { id } = ctx.params;
    const form = await strapi
      .plugin('formflow')
      .service('form')
      .duplicate(id);

    return { data: form };
  },

  async getFieldTypes(ctx) {
    const fieldTypes = strapi
      .plugin('formflow')
      .service('form')
      .getFieldTypes();

    return { data: fieldTypes };
  }
});

export default controller;
```

#### Public Controller

```typescript
// server/src/controllers/public.ts
import type { Core } from '@strapi/strapi';

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  async getFormSchema(ctx) {
    const { slug } = ctx.params;

    const schema = await strapi
      .plugin('formflow')
      .service('form')
      .getPublicSchema(slug);

    if (!schema) {
      return ctx.notFound('Form not found');
    }

    return { data: schema };
  },

  async submitForm(ctx) {
    const { slug } = ctx.params;
    const submissionData = ctx.request.body;

    // Get client metadata
    const metadata = {
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.headers['user-agent'],
      referrer: ctx.request.headers['referer'],
      submittedAt: new Date().toISOString()
    };

    try {
      const result = await strapi
        .plugin('formflow')
        .service('submission')
        .submit(slug, submissionData, metadata);

      return {
        data: {
          success: true,
          message: result.successMessage,
          redirectUrl: result.redirectUrl
        }
      };
    } catch (error) {
      if (error.name === 'ValidationError') {
        return ctx.badRequest(error.message, { errors: error.details });
      }
      throw error;
    }
  }
});

export default controller;
```

### Services

#### Form Service

```typescript
// server/src/services/form.ts
import type { Core } from '@strapi/strapi';
import { v4 as uuidv4 } from 'uuid';

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(query = {}) {
    return strapi.documents('plugin::formflow.form').findMany({
      ...query,
      populate: ['submissions']
    });
  },

  async findOne(documentId: string) {
    return strapi.documents('plugin::formflow.form').findOne({
      documentId
    });
  },

  async findBySlug(slug: string) {
    const forms = await strapi.documents('plugin::formflow.form').findMany({
      filters: { slug }
    });
    return forms[0] || null;
  },

  async create(data: any) {
    // Generate UUIDs for fields if not provided
    if (data.fields) {
      data.fields = data.fields.map((field: any, index: number) => ({
        ...field,
        id: field.id || uuidv4(),
        order: field.order ?? index
      }));
    }

    return strapi.documents('plugin::formflow.form').create({
      data: {
        ...data,
        settings: data.settings || this.getDefaultSettings()
      }
    });
  },

  async update(documentId: string, data: any) {
    return strapi.documents('plugin::formflow.form').update({
      documentId,
      data
    });
  },

  async delete(documentId: string) {
    // Delete all associated submissions first
    const submissions = await strapi.documents('plugin::formflow.form-submission').findMany({
      filters: { form: { documentId } }
    });

    for (const submission of submissions) {
      await strapi.documents('plugin::formflow.form-submission').delete({
        documentId: submission.documentId
      });
    }

    return strapi.documents('plugin::formflow.form').delete({
      documentId
    });
  },

  async duplicate(documentId: string) {
    const original = await this.findOne(documentId);
    if (!original) {
      throw new Error('Form not found');
    }

    const { id, documentId: _, slug, submissionCount, ...formData } = original;

    return this.create({
      ...formData,
      title: `${formData.title} (Copy)`,
      slug: `${slug}-copy-${Date.now()}`,
      submissionCount: 0
    });
  },

  async getPublicSchema(slug: string) {
    const form = await this.findBySlug(slug);

    if (!form || !form.isActive) {
      return null;
    }

    // Return only public-safe data
    return {
      title: form.title,
      description: form.description,
      slug: form.slug,
      fields: form.fields.map((field: any) => ({
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
        validation: field.validation.map((v: any) => ({
          type: v.type,
          value: v.value,
          message: v.message
        }))
      })),
      settings: {
        submitButtonText: form.settings?.submitButtonText || 'Submit',
        showResetButton: form.settings?.showResetButton || false,
        resetButtonText: form.settings?.resetButtonText || 'Reset',
        layout: form.settings?.layout || 'single',
        steps: form.settings?.steps,
        spam: {
          honeypot: form.settings?.spam?.honeypot || false,
          honeypotFieldName: form.settings?.spam?.honeypotFieldName,
          recaptcha: form.settings?.spam?.recaptcha?.enabled ? {
            siteKey: form.settings.spam.recaptcha.siteKey,
            version: form.settings.spam.recaptcha.version
          } : undefined
        }
      }
    };
  },

  getFieldTypes() {
    return [
      { type: 'text', label: 'Text', icon: 'text', category: 'basic' },
      { type: 'textarea', label: 'Text Area', icon: 'text', category: 'basic' },
      { type: 'email', label: 'Email', icon: 'mail', category: 'basic' },
      { type: 'number', label: 'Number', icon: 'number', category: 'basic' },
      { type: 'phone', label: 'Phone', icon: 'phone', category: 'basic' },
      { type: 'url', label: 'URL', icon: 'link', category: 'basic' },
      { type: 'password', label: 'Password', icon: 'lock', category: 'basic' },
      { type: 'select', label: 'Dropdown', icon: 'chevron-down', category: 'choice' },
      { type: 'radio', label: 'Radio Buttons', icon: 'circle', category: 'choice' },
      { type: 'checkbox', label: 'Checkboxes', icon: 'check-square', category: 'choice' },
      { type: 'boolean', label: 'Yes/No Toggle', icon: 'toggle', category: 'choice' },
      { type: 'date', label: 'Date', icon: 'calendar', category: 'datetime' },
      { type: 'time', label: 'Time', icon: 'clock', category: 'datetime' },
      { type: 'datetime', label: 'Date & Time', icon: 'calendar', category: 'datetime' },
      { type: 'file', label: 'File Upload', icon: 'upload', category: 'advanced' },
      { type: 'hidden', label: 'Hidden Field', icon: 'eye-off', category: 'advanced' },
      { type: 'heading', label: 'Heading', icon: 'type', category: 'layout' },
      { type: 'paragraph', label: 'Paragraph', icon: 'align-left', category: 'layout' },
      { type: 'divider', label: 'Divider', icon: 'minus', category: 'layout' }
    ];
  },

  getDefaultSettings() {
    return {
      submitButtonText: 'Submit',
      showResetButton: false,
      resetButtonText: 'Reset',
      layout: 'single',
      emailNotifications: [],
      webhooks: [],
      spam: {
        honeypot: true,
        honeypotFieldName: '_gotcha'
      }
    };
  }
});

export default service;
```

#### Validation Service

```typescript
// server/src/services/validation.ts
import type { Core } from '@strapi/strapi';

interface ValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
}

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  validate(fields: any[], data: Record<string, any>): ValidationResult {
    const errors: Record<string, string[]> = {};

    for (const field of fields) {
      // Skip layout fields (heading, paragraph, divider)
      if (['heading', 'paragraph', 'divider'].includes(field.type)) {
        continue;
      }

      const value = data[field.name];
      const fieldErrors: string[] = [];

      // Check required
      if (field.required && this.isEmpty(value)) {
        fieldErrors.push(field.requiredMessage || `${field.label} is required`);
      }

      // Skip other validations if value is empty and not required
      if (this.isEmpty(value) && !field.required) {
        continue;
      }

      // Run validation rules
      for (const rule of field.validation || []) {
        const error = this.runValidationRule(rule, value, field);
        if (error) {
          fieldErrors.push(error);
        }
      }

      // Type-specific validation
      const typeError = this.validateFieldType(field.type, value);
      if (typeError) {
        fieldErrors.push(typeError);
      }

      if (fieldErrors.length > 0) {
        errors[field.name] = fieldErrors;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  },

  isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  },

  runValidationRule(rule: any, value: any, field: any): string | null {
    switch (rule.type) {
      case 'minLength':
        if (typeof value === 'string' && value.length < rule.value) {
          return rule.message || `Must be at least ${rule.value} characters`;
        }
        break;

      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.value) {
          return rule.message || `Must be no more than ${rule.value} characters`;
        }
        break;

      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          return rule.message || `Must be at least ${rule.value}`;
        }
        break;

      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          return rule.message || `Must be no more than ${rule.value}`;
        }
        break;

      case 'pattern':
        const regex = new RegExp(rule.value);
        if (typeof value === 'string' && !regex.test(value)) {
          return rule.message || 'Invalid format';
        }
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof value === 'string' && !emailRegex.test(value)) {
          return rule.message || 'Invalid email address';
        }
        break;

      case 'url':
        try {
          new URL(value);
        } catch {
          return rule.message || 'Invalid URL';
        }
        break;

      case 'matches':
        // For password confirmation, etc.
        // rule.value should be the field name to match
        break;

      case 'custom':
        // For custom validation functions
        // This would require safe evaluation
        break;
    }

    return null;
  },

  validateFieldType(type: string, value: any): string | null {
    switch (type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof value === 'string' && !emailRegex.test(value)) {
          return 'Invalid email address';
        }
        break;

      case 'url':
        try {
          new URL(value);
        } catch {
          return 'Invalid URL';
        }
        break;

      case 'number':
        if (isNaN(Number(value))) {
          return 'Must be a valid number';
        }
        break;

      case 'phone':
        const phoneRegex = /^[\d\s\-+()]+$/;
        if (typeof value === 'string' && !phoneRegex.test(value)) {
          return 'Invalid phone number';
        }
        break;

      case 'date':
      case 'datetime':
        if (isNaN(Date.parse(value))) {
          return 'Invalid date';
        }
        break;
    }

    return null;
  },

  sanitize(fields: any[], data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const field of fields) {
      // Skip layout fields
      if (['heading', 'paragraph', 'divider'].includes(field.type)) {
        continue;
      }

      const value = data[field.name];

      if (value !== undefined) {
        sanitized[field.name] = this.sanitizeValue(field.type, value);
      }
    }

    return sanitized;
  },

  sanitizeValue(type: string, value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    switch (type) {
      case 'text':
      case 'textarea':
      case 'email':
      case 'url':
      case 'phone':
        // Trim and sanitize strings
        if (typeof value === 'string') {
          return value.trim()
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        }
        return String(value);

      case 'number':
        return Number(value) || 0;

      case 'boolean':
        return Boolean(value);

      case 'checkbox':
        if (Array.isArray(value)) {
          return value.map(v => String(v).trim());
        }
        return [String(value)];

      default:
        return value;
    }
  }
});

export default service;
```

#### Submission Service

```typescript
// server/src/services/submission.ts
import type { Core } from '@strapi/strapi';

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  async submit(slug: string, data: Record<string, any>, metadata: any) {
    const formService = strapi.plugin('formflow').service('form');
    const validationService = strapi.plugin('formflow').service('validation');

    // Get form
    const form = await formService.findBySlug(slug);
    if (!form) {
      throw new Error('Form not found');
    }

    if (!form.isActive) {
      throw new Error('Form is not accepting submissions');
    }

    // Validate
    const validationResult = validationService.validate(form.fields, data);
    if (!validationResult.valid) {
      const error: any = new Error('Validation failed');
      error.name = 'ValidationError';
      error.details = validationResult.errors;
      throw error;
    }

    // Sanitize
    const sanitizedData = validationService.sanitize(form.fields, data);

    // Create submission
    const submission = await strapi.documents('plugin::formflow.form-submission').create({
      data: {
        form: form.documentId,
        data: sanitizedData,
        metadata: {
          ...metadata,
          formVersion: form.updatedAt  // Track which version of form was used
        },
        status: 'new',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent
      }
    });

    // Update submission count
    await formService.update(form.documentId, {
      submissionCount: (form.submissionCount || 0) + 1
    });

    // Trigger post-submission hooks
    await this.triggerPostSubmissionHooks(form, submission, sanitizedData);

    return {
      submission,
      successMessage: form.successMessage,
      redirectUrl: form.redirectUrl
    };
  },

  async find(formId: string, query: any = {}) {
    return strapi.documents('plugin::formflow.form-submission').findMany({
      ...query,
      filters: {
        ...query.filters,
        form: { documentId: formId }
      },
      sort: query.sort || { createdAt: 'desc' }
    });
  },

  async findOne(documentId: string) {
    return strapi.documents('plugin::formflow.form-submission').findOne({
      documentId,
      populate: ['form']
    });
  },

  async update(documentId: string, data: any) {
    return strapi.documents('plugin::formflow.form-submission').update({
      documentId,
      data
    });
  },

  async delete(documentId: string) {
    return strapi.documents('plugin::formflow.form-submission').delete({
      documentId
    });
  },

  async deleteMany(formId: string, submissionIds: string[]) {
    const results = [];
    for (const id of submissionIds) {
      results.push(await this.delete(id));
    }
    return results;
  },

  async triggerPostSubmissionHooks(form: any, submission: any, data: any) {
    const settings = form.settings || {};

    // Email notifications
    if (settings.emailNotifications?.length > 0) {
      for (const notification of settings.emailNotifications) {
        if (notification.enabled) {
          await this.sendEmailNotification(notification, form, data);
        }
      }
    }

    // Webhooks
    if (settings.webhooks?.length > 0) {
      for (const webhook of settings.webhooks) {
        if (webhook.enabled && webhook.events.includes('submission.created')) {
          await this.triggerWebhook(webhook, form, submission, data);
        }
      }
    }
  },

  async sendEmailNotification(config: any, form: any, data: any) {
    // Email implementation would go here
    // Using Strapi's email plugin or custom implementation
    strapi.log.info(`Email notification would be sent to: ${config.to.join(', ')}`);
  },

  async triggerWebhook(config: any, form: any, submission: any, data: any) {
    try {
      const response = await fetch(config.url, {
        method: config.method,
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify({
          event: 'submission.created',
          form: {
            id: form.documentId,
            title: form.title,
            slug: form.slug
          },
          submission: {
            id: submission.documentId,
            data,
            createdAt: submission.createdAt
          }
        })
      });

      strapi.log.info(`Webhook triggered: ${config.url} - Status: ${response.status}`);
    } catch (error) {
      strapi.log.error(`Webhook failed: ${config.url}`, error);
    }
  }
});

export default service;
```

#### Export Service

```typescript
// server/src/services/export.ts
import type { Core } from '@strapi/strapi';

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  async exportToCSV(formId: string, options: any = {}): Promise<string> {
    const form = await strapi.plugin('formflow').service('form').findOne(formId);
    if (!form) {
      throw new Error('Form not found');
    }

    const submissions = await strapi.plugin('formflow').service('submission').find(formId, {
      filters: options.filters,
      sort: { createdAt: 'asc' }
    });

    // Get field names for headers
    const fields = form.fields.filter((f: any) =>
      !['heading', 'paragraph', 'divider'].includes(f.type)
    );

    const headers = [
      'Submission ID',
      'Submitted At',
      'Status',
      ...fields.map((f: any) => f.label || f.name),
      'IP Address'
    ];

    // Build CSV rows
    const rows = submissions.map((sub: any) => {
      const row = [
        sub.documentId,
        sub.createdAt,
        sub.status,
        ...fields.map((f: any) => {
          const value = sub.data[f.name];
          if (Array.isArray(value)) {
            return value.join('; ');
          }
          return value ?? '';
        }),
        options.includeIp ? sub.ipAddress : ''
      ];

      return row.map(cell => this.escapeCSVValue(String(cell)));
    });

    // Combine headers and rows
    const csv = [
      headers.map(h => this.escapeCSVValue(h)).join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csv;
  },

  escapeCSVValue(value: string): string {
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
});

export default service;
```

### Policies

```typescript
// server/src/policies/is-form-active.ts
export default async (policyContext, config, { strapi }) => {
  const { slug } = policyContext.params;

  const form = await strapi
    .plugin('formflow')
    .service('form')
    .findBySlug(slug);

  if (!form) {
    return false;
  }

  if (!form.isActive) {
    return false;
  }

  // Check if form is published (if draft/publish is enabled)
  if (form.publishedAt === null) {
    return false;
  }

  return true;
};
```

```typescript
// server/src/policies/rate-limit.ts
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export default async (policyContext, config, { strapi }) => {
  const { slug } = policyContext.params;
  const ip = policyContext.request.ip;

  const form = await strapi
    .plugin('formflow')
    .service('form')
    .findBySlug(slug);

  if (!form?.settings?.rateLimit?.enabled) {
    return true;
  }

  const { maxSubmissions, windowMs } = form.settings.rateLimit;
  const key = `${slug}:${ip}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
    rateLimitStore.set(key, record);
  }

  record.count++;

  if (record.count > maxSubmissions) {
    policyContext.status = 429;
    policyContext.body = {
      error: 'Too many submissions. Please try again later.'
    };
    return false;
  }

  return true;
};
```

---

## Admin Panel Architecture

### Directory Structure

```
admin/src/
├── index.ts                    # Plugin registration
├── pluginId.ts                 # Plugin ID constant
├── translations/
│   └── en.json                 # i18n translations
├── utils/
│   ├── getTranslation.ts
│   ├── api.ts                  # API client utilities
│   └── fieldTypes.ts           # Field type definitions
├── hooks/
│   ├── useForms.ts             # Forms data hook
│   ├── useForm.ts              # Single form hook
│   ├── useSubmissions.ts       # Submissions hook
│   └── useFieldTypes.ts        # Field types hook
├── components/
│   ├── Initializer.tsx         # Plugin initializer
│   ├── PluginIcon.tsx          # Menu icon
│   ├── FormBuilder/
│   │   ├── index.tsx           # Main form builder
│   │   ├── FieldList.tsx       # Draggable field list
│   │   ├── FieldEditor.tsx     # Field configuration panel
│   │   ├── FieldPreview.tsx    # Field preview component
│   │   └── FieldTypeSelector.tsx
│   ├── FormSettings/
│   │   ├── index.tsx           # Settings tabs container
│   │   ├── GeneralSettings.tsx
│   │   ├── EmailSettings.tsx
│   │   ├── SpamSettings.tsx
│   │   └── WebhookSettings.tsx
│   ├── SubmissionViewer/
│   │   ├── index.tsx           # Submission detail view
│   │   └── SubmissionData.tsx
│   └── shared/
│       ├── ConfirmDialog.tsx
│       ├── EmptyState.tsx
│       └── StatusBadge.tsx
├── pages/
│   ├── App.tsx                 # Router setup
│   ├── FormsListPage.tsx       # List all forms
│   ├── FormEditPage.tsx        # Create/edit form
│   ├── SubmissionsListPage.tsx # List submissions
│   └── SubmissionDetailPage.tsx
└── permissions.ts              # Plugin permissions
```

### Page Components

#### Forms List Page

```tsx
// admin/src/pages/FormsListPage.tsx
import React from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import {
  Main,
  Box,
  Flex,
  Typography,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Badge,
  Searchbar,
  SearchForm
} from '@strapi/design-system';
import { Plus, Pencil, Trash, Eye, Copy } from '@strapi/icons';
import { Page } from '@strapi/strapi/admin';
import { useForms } from '../hooks/useForms';
import { PLUGIN_ID } from '../pluginId';
import { getTranslation } from '../utils/getTranslation';
import { EmptyState } from '../components/shared/EmptyState';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';

export const FormsListPage = () => {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { forms, isLoading, deleteForm, duplicateForm, refetch } = useForms();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [formToDelete, setFormToDelete] = React.useState(null);

  const filteredForms = React.useMemo(() => {
    if (!searchQuery) return forms;
    return forms.filter(form =>
      form.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [forms, searchQuery]);

  const handleDelete = async () => {
    if (formToDelete) {
      await deleteForm(formToDelete.documentId);
      setDeleteDialogOpen(false);
      setFormToDelete(null);
      refetch();
    }
  };

  const handleDuplicate = async (form) => {
    await duplicateForm(form.documentId);
    refetch();
  };

  return (
    <Main>
      <Box padding={8} background="neutral100">
        <Flex justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="alpha" fontWeight="bold">
              {formatMessage({ id: getTranslation('pages.forms.title'), defaultMessage: 'Forms' })}
            </Typography>
            <Typography variant="epsilon" textColor="neutral600">
              {formatMessage({ id: getTranslation('pages.forms.subtitle'), defaultMessage: 'Create and manage your forms' })}
            </Typography>
          </Box>
          <Button
            startIcon={<Plus />}
            onClick={() => navigate(`/plugins/${PLUGIN_ID}/forms/create`)}
          >
            {formatMessage({ id: getTranslation('actions.createForm'), defaultMessage: 'Create Form' })}
          </Button>
        </Flex>
      </Box>

      <Box padding={8}>
        <Box marginBottom={4}>
          <SearchForm>
            <Searchbar
              name="search"
              placeholder={formatMessage({ id: getTranslation('actions.searchForms'), defaultMessage: 'Search forms...' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              clearLabel="Clear"
            />
          </SearchForm>
        </Box>

        {filteredForms.length === 0 ? (
          <EmptyState
            title={formatMessage({ id: getTranslation('empty.forms.title'), defaultMessage: 'No forms yet' })}
            description={formatMessage({ id: getTranslation('empty.forms.description'), defaultMessage: 'Create your first form to get started' })}
            action={
              <Button startIcon={<Plus />} onClick={() => navigate(`/plugins/${PLUGIN_ID}/forms/create`)}>
                {formatMessage({ id: getTranslation('actions.createForm'), defaultMessage: 'Create Form' })}
              </Button>
            }
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th><Typography variant="sigma">Title</Typography></Th>
                <Th><Typography variant="sigma">Slug</Typography></Th>
                <Th><Typography variant="sigma">Submissions</Typography></Th>
                <Th><Typography variant="sigma">Status</Typography></Th>
                <Th><Typography variant="sigma">Actions</Typography></Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredForms.map((form) => (
                <Tr key={form.documentId}>
                  <Td>
                    <Typography fontWeight="bold">{form.title}</Typography>
                  </Td>
                  <Td>
                    <Typography textColor="neutral600">{form.slug}</Typography>
                  </Td>
                  <Td>
                    <Badge>{form.submissionCount || 0}</Badge>
                  </Td>
                  <Td>
                    <Badge active={form.isActive}>
                      {form.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <Flex gap={1}>
                      <IconButton
                        label="View submissions"
                        onClick={() => navigate(`/plugins/${PLUGIN_ID}/forms/${form.documentId}/submissions`)}
                      >
                        <Eye />
                      </IconButton>
                      <IconButton
                        label="Edit"
                        onClick={() => navigate(`/plugins/${PLUGIN_ID}/forms/${form.documentId}/edit`)}
                      >
                        <Pencil />
                      </IconButton>
                      <IconButton
                        label="Duplicate"
                        onClick={() => handleDuplicate(form)}
                      >
                        <Copy />
                      </IconButton>
                      <IconButton
                        label="Delete"
                        onClick={() => {
                          setFormToDelete(form);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash />
                      </IconButton>
                    </Flex>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Form"
        message={`Are you sure you want to delete "${formToDelete?.title}"? This will also delete all submissions.`}
      />
    </Main>
  );
};
```

#### Form Builder Page

```tsx
// admin/src/pages/FormEditPage.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  Main,
  Box,
  Flex,
  Typography,
  Button,
  Tabs,
  Grid,
  Field,
  TextInput,
  Textarea,
  Toggle
} from '@strapi/design-system';
import { ArrowLeft, Check } from '@strapi/icons';
import { useForm } from '../hooks/useForm';
import { FormBuilder } from '../components/FormBuilder';
import { FormSettings } from '../components/FormSettings';
import { PLUGIN_ID } from '../pluginId';

export const FormEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const isCreating = id === 'create';

  const { form, isLoading, save, isSaving } = useForm(isCreating ? null : id);

  const [formData, setFormData] = React.useState({
    title: '',
    slug: '',
    description: '',
    fields: [],
    settings: {},
    successMessage: 'Thank you for your submission!',
    redirectUrl: '',
    isActive: true
  });

  React.useEffect(() => {
    if (form && !isCreating) {
      setFormData(form);
    }
  }, [form, isCreating]);

  const handleSave = async () => {
    await save(formData);
    if (isCreating) {
      navigate(`/plugins/${PLUGIN_ID}/forms`);
    }
  };

  const updateField = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Main>
      {/* Header */}
      <Box padding={8} background="neutral100">
        <Flex justifyContent="space-between" alignItems="center">
          <Flex gap={4} alignItems="center">
            <Button
              variant="tertiary"
              startIcon={<ArrowLeft />}
              onClick={() => navigate(`/plugins/${PLUGIN_ID}/forms`)}
            >
              Back
            </Button>
            <Box>
              <Typography variant="alpha" fontWeight="bold">
                {isCreating ? 'Create Form' : 'Edit Form'}
              </Typography>
            </Box>
          </Flex>
          <Flex gap={2}>
            <Button
              variant="secondary"
              onClick={() => navigate(`/plugins/${PLUGIN_ID}/forms`)}
            >
              Cancel
            </Button>
            <Button
              startIcon={<Check />}
              onClick={handleSave}
              loading={isSaving}
            >
              {isCreating ? 'Create' : 'Save'}
            </Button>
          </Flex>
        </Flex>
      </Box>

      {/* Content */}
      <Box padding={8}>
        <Tabs.Root defaultValue="builder">
          <Tabs.List>
            <Tabs.Trigger value="builder">Form Builder</Tabs.Trigger>
            <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
            <Tabs.Trigger value="notifications">Notifications</Tabs.Trigger>
          </Tabs.List>

          <Box marginTop={6}>
            <Tabs.Content value="builder">
              {/* Basic Info */}
              <Box marginBottom={6}>
                <Grid.Root gap={4} gridCols={12}>
                  <Grid.Item col={6}>
                    <Field.Root name="title" required>
                      <Field.Label>Form Title</Field.Label>
                      <TextInput
                        value={formData.title}
                        onChange={(e) => updateField('title', e.target.value)}
                        placeholder="Contact Form"
                      />
                    </Field.Root>
                  </Grid.Item>
                  <Grid.Item col={6}>
                    <Field.Root name="slug" required>
                      <Field.Label>Slug</Field.Label>
                      <TextInput
                        value={formData.slug}
                        onChange={(e) => updateField('slug', e.target.value)}
                        placeholder="contact-form"
                      />
                      <Field.Hint>Used in API endpoint: /api/formflow/forms/{formData.slug || 'slug'}</Field.Hint>
                    </Field.Root>
                  </Grid.Item>
                  <Grid.Item col={12}>
                    <Field.Root name="description">
                      <Field.Label>Description</Field.Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => updateField('description', e.target.value)}
                        placeholder="Optional description for this form"
                      />
                    </Field.Root>
                  </Grid.Item>
                  <Grid.Item col={6}>
                    <Field.Root name="isActive">
                      <Flex gap={2} alignItems="center">
                        <Toggle
                          checked={formData.isActive}
                          onCheckedChange={(checked) => updateField('isActive', checked)}
                        />
                        <Field.Label>Form is Active</Field.Label>
                      </Flex>
                      <Field.Hint>Inactive forms won't accept submissions</Field.Hint>
                    </Field.Root>
                  </Grid.Item>
                </Grid.Root>
              </Box>

              {/* Form Builder */}
              <FormBuilder
                fields={formData.fields}
                onChange={(fields) => updateField('fields', fields)}
              />
            </Tabs.Content>

            <Tabs.Content value="settings">
              <FormSettings
                settings={formData.settings}
                successMessage={formData.successMessage}
                redirectUrl={formData.redirectUrl}
                onChange={(key, value) => updateField(key, value)}
              />
            </Tabs.Content>

            <Tabs.Content value="notifications">
              {/* Email and webhook configuration */}
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Box>
    </Main>
  );
};
```

### Form Builder Component

```tsx
// admin/src/components/FormBuilder/index.tsx
import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Flex,
  Typography,
  Button,
  Card,
  CardBody,
  IconButton
} from '@strapi/design-system';
import { Plus, Trash, Drag, Pencil } from '@strapi/icons';
import { useFieldTypes } from '../../hooks/useFieldTypes';
import { FieldTypeSelector } from './FieldTypeSelector';
import { FieldEditor } from './FieldEditor';
import { FieldPreview } from './FieldPreview';

interface FormBuilderProps {
  fields: any[];
  onChange: (fields: any[]) => void;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({ fields, onChange }) => {
  const { fieldTypes } = useFieldTypes();
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  const [showFieldSelector, setShowFieldSelector] = React.useState(false);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

  const selectedField = fields.find(f => f.id === selectedFieldId);

  const addField = (type: string) => {
    const fieldType = fieldTypes.find(ft => ft.type === type);
    const newField = {
      id: uuidv4(),
      type,
      name: `field_${fields.length + 1}`,
      label: fieldType?.label || type,
      placeholder: '',
      description: '',
      required: false,
      validation: [],
      options: type === 'select' || type === 'radio' || type === 'checkbox'
        ? [{ label: 'Option 1', value: 'option1' }]
        : undefined,
      order: fields.length,
      width: 'full'
    };

    onChange([...fields, newField]);
    setSelectedFieldId(newField.id);
    setShowFieldSelector(false);
  };

  const updateField = (id: string, updates: any) => {
    onChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const deleteField = (id: string) => {
    onChange(fields.filter(f => f.id !== id));
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    const newFields = [...fields];
    const [movedField] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, movedField);

    // Update order property
    const reorderedFields = newFields.map((f, i) => ({ ...f, order: i }));
    onChange(reorderedFields);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      moveField(draggedIndex, index);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <Grid.Root gap={6} gridCols={12}>
      {/* Field List */}
      <Grid.Item col={7}>
        <Box background="neutral0" padding={4} hasRadius shadow="tableShadow">
          <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
            <Typography variant="delta" fontWeight="bold">
              Form Fields
            </Typography>
            <Button
              size="S"
              startIcon={<Plus />}
              onClick={() => setShowFieldSelector(true)}
            >
              Add Field
            </Button>
          </Flex>

          {fields.length === 0 ? (
            <Box padding={8} textAlign="center" background="neutral100" hasRadius>
              <Typography textColor="neutral600">
                No fields yet. Click "Add Field" to start building your form.
              </Typography>
            </Box>
          ) : (
            <Flex direction="column" gap={2}>
              {fields
                .sort((a, b) => a.order - b.order)
                .map((field, index) => (
                  <Card
                    key={field.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    style={{
                      cursor: 'grab',
                      opacity: draggedIndex === index ? 0.5 : 1,
                      border: selectedFieldId === field.id ? '2px solid #4945FF' : undefined
                    }}
                    onClick={() => setSelectedFieldId(field.id)}
                  >
                    <CardBody>
                      <Flex justifyContent="space-between" alignItems="center">
                        <Flex gap={3} alignItems="center">
                          <IconButton label="Drag to reorder" variant="ghost">
                            <Drag />
                          </IconButton>
                          <Box>
                            <Typography fontWeight="bold">{field.label}</Typography>
                            <Typography variant="pi" textColor="neutral600">
                              {field.type} {field.required && '(required)'}
                            </Typography>
                          </Box>
                        </Flex>
                        <Flex gap={1}>
                          <IconButton
                            label="Edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFieldId(field.id);
                            }}
                          >
                            <Pencil />
                          </IconButton>
                          <IconButton
                            label="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteField(field.id);
                            }}
                          >
                            <Trash />
                          </IconButton>
                        </Flex>
                      </Flex>
                    </CardBody>
                  </Card>
                ))}
            </Flex>
          )}
        </Box>
      </Grid.Item>

      {/* Field Editor Panel */}
      <Grid.Item col={5}>
        <Box background="neutral0" padding={4} hasRadius shadow="tableShadow" style={{ position: 'sticky', top: 20 }}>
          {selectedField ? (
            <FieldEditor
              field={selectedField}
              onChange={(updates) => updateField(selectedField.id, updates)}
              onClose={() => setSelectedFieldId(null)}
            />
          ) : (
            <Box padding={8} textAlign="center">
              <Typography textColor="neutral600">
                Select a field to edit its properties
              </Typography>
            </Box>
          )}
        </Box>
      </Grid.Item>

      {/* Field Type Selector Modal */}
      <FieldTypeSelector
        isOpen={showFieldSelector}
        onClose={() => setShowFieldSelector(false)}
        onSelect={addField}
        fieldTypes={fieldTypes}
      />
    </Grid.Root>
  );
};
```

---

## API Design

### Public API Endpoints

#### Get Form Schema

```
GET /api/formflow/forms/:slug
```

**Response:**
```json
{
  "data": {
    "title": "Contact Form",
    "description": "Get in touch with us",
    "slug": "contact-form",
    "fields": [
      {
        "id": "uuid-1",
        "type": "text",
        "name": "fullName",
        "label": "Full Name",
        "placeholder": "John Doe",
        "required": true,
        "validation": [
          { "type": "minLength", "value": 2, "message": "Name must be at least 2 characters" }
        ],
        "order": 0,
        "width": "full"
      },
      {
        "id": "uuid-2",
        "type": "email",
        "name": "email",
        "label": "Email Address",
        "placeholder": "john@example.com",
        "required": true,
        "validation": [],
        "order": 1,
        "width": "half"
      },
      {
        "id": "uuid-3",
        "type": "select",
        "name": "subject",
        "label": "Subject",
        "required": true,
        "options": [
          { "label": "General Inquiry", "value": "general" },
          { "label": "Support", "value": "support" },
          { "label": "Feedback", "value": "feedback" }
        ],
        "order": 2,
        "width": "half"
      },
      {
        "id": "uuid-4",
        "type": "textarea",
        "name": "message",
        "label": "Message",
        "placeholder": "Your message...",
        "required": true,
        "validation": [
          { "type": "minLength", "value": 10, "message": "Message must be at least 10 characters" },
          { "type": "maxLength", "value": 1000, "message": "Message cannot exceed 1000 characters" }
        ],
        "order": 3,
        "width": "full"
      }
    ],
    "settings": {
      "submitButtonText": "Send Message",
      "showResetButton": false,
      "layout": "single",
      "spam": {
        "honeypot": true,
        "honeypotFieldName": "_gotcha"
      }
    }
  }
}
```

#### Submit Form

```
POST /api/formflow/forms/:slug/submit
Content-Type: application/json
```

**Request:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "subject": "general",
  "message": "This is my message...",
  "_gotcha": ""
}
```

**Success Response (200):**
```json
{
  "data": {
    "success": true,
    "message": "Thank you for your submission!",
    "redirectUrl": null
  }
}
```

**Validation Error Response (400):**
```json
{
  "error": {
    "status": 400,
    "name": "ValidationError",
    "message": "Validation failed",
    "details": {
      "errors": {
        "email": ["Invalid email address"],
        "message": ["Message must be at least 10 characters"]
      }
    }
  }
}
```

---

## Field Types

### Supported Field Types

| Type | Description | Validation Options |
|------|-------------|-------------------|
| `text` | Single-line text input | minLength, maxLength, pattern |
| `textarea` | Multi-line text input | minLength, maxLength |
| `email` | Email input with validation | Built-in email validation |
| `number` | Numeric input | min, max, step |
| `phone` | Phone number input | pattern |
| `url` | URL input with validation | Built-in URL validation |
| `password` | Password input | minLength, pattern |
| `select` | Dropdown select | options (required) |
| `radio` | Radio button group | options (required) |
| `checkbox` | Checkbox group | options (required), minSelected, maxSelected |
| `boolean` | Single toggle/checkbox | - |
| `date` | Date picker | minDate, maxDate |
| `time` | Time picker | minTime, maxTime |
| `datetime` | Date and time picker | minDate, maxDate |
| `file` | File upload | maxSize, allowedTypes |
| `hidden` | Hidden field | - |
| `heading` | Section heading (no input) | - |
| `paragraph` | Descriptive text (no input) | - |
| `divider` | Visual separator (no input) | - |

### Field Type Categories

1. **Basic**: text, textarea, email, number, phone, url, password
2. **Choice**: select, radio, checkbox, boolean
3. **DateTime**: date, time, datetime
4. **Advanced**: file, hidden
5. **Layout**: heading, paragraph, divider

---

## Validation System

### Validation Rules

| Rule | Applicable To | Value Type | Description |
|------|---------------|------------|-------------|
| `required` | All | boolean | Field must have a value |
| `minLength` | text, textarea, password | number | Minimum character count |
| `maxLength` | text, textarea, password | number | Maximum character count |
| `min` | number | number | Minimum value |
| `max` | number | number | Maximum value |
| `pattern` | text, phone | string (regex) | Must match pattern |
| `email` | email | boolean | Must be valid email |
| `url` | url | boolean | Must be valid URL |
| `minDate` | date, datetime | string (date) | Earliest allowed date |
| `maxDate` | date, datetime | string (date) | Latest allowed date |
| `minSelected` | checkbox | number | Minimum selections |
| `maxSelected` | checkbox | number | Maximum selections |
| `maxSize` | file | number (bytes) | Maximum file size |
| `allowedTypes` | file | string[] | Allowed MIME types |

### Server-Side Validation Flow

```
1. Receive submission request
2. Check honeypot field (if enabled)
3. Verify reCAPTCHA (if enabled)
4. Check rate limiting
5. Load form configuration
6. For each field:
   a. Check if required and empty
   b. Validate field type constraints
   c. Run custom validation rules
7. Sanitize all input values
8. If valid: create submission, trigger hooks
9. If invalid: return detailed error response
```

---

## Security Considerations

### Input Validation & Sanitization

1. **XSS Prevention**: All string inputs are HTML-escaped before storage
2. **SQL Injection**: Strapi's Document Service API handles parameterized queries
3. **Validation**: Both client and server-side validation
4. **Type Coercion**: Inputs are coerced to expected types

### Spam Protection

1. **Honeypot Fields**: Hidden fields that should remain empty
2. **Rate Limiting**: Configurable per-form submission limits
3. **reCAPTCHA**: Support for Google reCAPTCHA v2/v3 (optional)
4. **IP Tracking**: Store submitter IP for abuse detection

### Access Control

1. **Admin Routes**: Protected by Strapi admin authentication
2. **Public Routes**: Configurable authentication requirements
3. **RBAC**: Strapi role-based permissions for form management
4. **Form-Level**: Active/inactive toggle per form

### Data Protection

1. **Sensitive Data**: Option to exclude fields from export
2. **IP Anonymization**: Configurable IP storage/anonymization
3. **Data Retention**: Configurable auto-deletion of old submissions
4. **Export Controls**: Admin-only CSV export functionality

---

## File Structure

```
strapi-forms/
├── admin/
│   ├── src/
│   │   ├── index.ts
│   │   ├── pluginId.ts
│   │   ├── translations/
│   │   │   ├── en.json
│   │   │   └── ...
│   │   ├── utils/
│   │   │   ├── getTranslation.ts
│   │   │   ├── api.ts
│   │   │   └── fieldTypes.ts
│   │   ├── hooks/
│   │   │   ├── useForms.ts
│   │   │   ├── useForm.ts
│   │   │   ├── useSubmissions.ts
│   │   │   └── useFieldTypes.ts
│   │   ├── components/
│   │   │   ├── Initializer.tsx
│   │   │   ├── PluginIcon.tsx
│   │   │   ├── FormBuilder/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── FieldList.tsx
│   │   │   │   ├── FieldEditor.tsx
│   │   │   │   ├── FieldPreview.tsx
│   │   │   │   ├── FieldTypeSelector.tsx
│   │   │   │   └── ValidationRulesEditor.tsx
│   │   │   ├── FormSettings/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── GeneralSettings.tsx
│   │   │   │   ├── EmailSettings.tsx
│   │   │   │   ├── SpamSettings.tsx
│   │   │   │   └── WebhookSettings.tsx
│   │   │   ├── SubmissionViewer/
│   │   │   │   ├── index.tsx
│   │   │   │   └── SubmissionData.tsx
│   │   │   └── shared/
│   │   │       ├── ConfirmDialog.tsx
│   │   │       ├── EmptyState.tsx
│   │   │       └── StatusBadge.tsx
│   │   └── pages/
│   │       ├── App.tsx
│   │       ├── FormsListPage.tsx
│   │       ├── FormEditPage.tsx
│   │       ├── SubmissionsListPage.tsx
│   │       └── SubmissionDetailPage.tsx
│   ├── tsconfig.json
│   └── tsconfig.build.json
├── server/
│   ├── src/
│   │   ├── index.ts
│   │   ├── register.ts
│   │   ├── bootstrap.ts
│   │   ├── destroy.ts
│   │   ├── config/
│   │   │   └── index.ts
│   │   ├── content-types/
│   │   │   ├── index.ts
│   │   │   ├── form/
│   │   │   │   ├── index.ts
│   │   │   │   └── schema.json
│   │   │   └── form-submission/
│   │   │       ├── index.ts
│   │   │       └── schema.json
│   │   ├── controllers/
│   │   │   ├── index.ts
│   │   │   ├── form.ts
│   │   │   ├── submission.ts
│   │   │   └── public.ts
│   │   ├── services/
│   │   │   ├── index.ts
│   │   │   ├── form.ts
│   │   │   ├── submission.ts
│   │   │   ├── validation.ts
│   │   │   └── export.ts
│   │   ├── routes/
│   │   │   ├── index.ts
│   │   │   ├── admin/
│   │   │   │   └── index.ts
│   │   │   └── content-api/
│   │   │       └── index.ts
│   │   ├── policies/
│   │   │   ├── index.ts
│   │   │   ├── is-form-active.ts
│   │   │   └── rate-limit.ts
│   │   ├── middlewares/
│   │   │   ├── index.ts
│   │   │   └── spam-check.ts
│   │   └── utils/
│   │       ├── validation-rules.ts
│   │       └── sanitize.ts
│   ├── tsconfig.json
│   └── tsconfig.build.json
├── package.json
├── README.md
└── architecture.md
```

---

## Implementation Phases

### Phase 1: Core Foundation
- [ ] Set up content types (Form, FormSubmission)
- [ ] Implement basic CRUD services for forms
- [ ] Create admin routes for form management
- [ ] Build basic admin UI for listing forms

### Phase 2: Form Builder
- [ ] Implement field types system
- [ ] Build drag-and-drop form builder UI
- [ ] Create field configuration panel
- [ ] Add field validation rules editor

### Phase 3: Public API
- [ ] Implement public form schema endpoint
- [ ] Create submission handler with validation
- [ ] Add spam protection (honeypot)
- [ ] Implement rate limiting

### Phase 4: Submission Management
- [ ] Build submissions list page
- [ ] Create submission detail view
- [ ] Implement CSV export
- [ ] Add bulk actions (delete, mark as read)

### Phase 5: Advanced Features
- [ ] Email notifications
- [ ] Webhook integration
- [ ] reCAPTCHA support
- [ ] Conditional field logic

### Phase 6: Polish & Documentation
- [ ] Comprehensive i18n support
- [ ] API documentation
- [ ] User guide
- [ ] Performance optimization

---

## Appendix

### Example Frontend Integration (React)

```tsx
// Example React component for rendering a form
import React from 'react';

const DynamicForm = ({ formSlug }) => {
  const [schema, setSchema] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/formflow/forms/${formSlug}`)
      .then(res => res.json())
      .then(data => {
        setSchema(data.data);
        // Initialize values with defaults
        const defaults = {};
        data.data.fields.forEach(field => {
          if (field.defaultValue !== undefined) {
            defaults[field.name] = field.defaultValue;
          }
        });
        setValues(defaults);
      });
  }, [formSlug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch(`/api/formflow/forms/${formSlug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });

      const result = await response.json();

      if (!response.ok) {
        setErrors(result.error?.details?.errors || {});
      } else if (result.data.redirectUrl) {
        window.location.href = result.data.redirectUrl;
      } else {
        alert(result.data.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!schema) return <div>Loading...</div>;

  return (
    <form onSubmit={handleSubmit}>
      <h2>{schema.title}</h2>
      {schema.description && <p>{schema.description}</p>}

      {schema.fields
        .sort((a, b) => a.order - b.order)
        .map(field => (
          <FormField
            key={field.id}
            field={field}
            value={values[field.name]}
            onChange={(value) => setValues(prev => ({ ...prev, [field.name]: value }))}
            error={errors[field.name]}
          />
        ))}

      {/* Honeypot field */}
      {schema.settings.spam?.honeypot && (
        <input
          type="text"
          name={schema.settings.spam.honeypotFieldName}
          style={{ display: 'none' }}
          value={values[schema.settings.spam.honeypotFieldName] || ''}
          onChange={(e) => setValues(prev => ({
            ...prev,
            [schema.settings.spam.honeypotFieldName]: e.target.value
          }))}
        />
      )}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : schema.settings.submitButtonText}
      </button>
    </form>
  );
};
```

---

*This architecture document serves as the foundational blueprint for the FormFlow plugin. It should be updated as the implementation progresses and requirements evolve.*
