# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Strapi Forms is a Strapi v5 plugin for creating dynamic, configurable forms through the admin panel. It follows a headless CMS architecture where forms are managed in Strapi and consumed via REST API by any frontend.

**Key Reference**: See `architecture.md` for detailed implementation plans, data models, and API designs.

## Commands

```bash
# Build the plugin
npm run build

# Development with file watching
npm run watch

# Watch with linking (for local Strapi project development)
npm run watch:link

# Verify plugin structure
npm run verify

# TypeScript type checking
npm run test:ts:front    # Admin panel (frontend)
npm run test:ts:back     # Server (backend)
```

## Architecture

This is a Strapi v5 plugin built with `@strapi/sdk-plugin`. It has two distinct parts:

### Server (`server/src/`)
Backend plugin code running in Node.js:
- **content-types/**: Define `Form` and `FormSubmission` collection types (schema.json files)
- **controllers/**: Request handlers (form CRUD, submission handling, public API)
- **services/**: Business logic (form, submission, validation, export services)
- **routes/**: Two route types:
  - `admin/`: Protected routes for admin panel (`/strapi-forms/*`)
  - `content-api/`: Public routes for frontend (`/api/forms/*`)
- **policies/**: Route guards (is-form-active, rate-limit)
- **middlewares/**: Request processing (spam-check)

### Admin (`admin/src/`)
React frontend for Strapi admin panel:
- **pages/**: Route components (FormsListPage, FormEditPage, SubmissionsListPage)
- **components/**: Reusable UI (FormBuilder, FieldEditor, SubmissionViewer)
- **hooks/**: Data fetching hooks (useForms, useForm, useSubmissions)
- **translations/**: i18n JSON files

## Key Patterns

### Strapi Document Service (v5)
Use `strapi.documents()` for database operations:
```typescript
// Find
await strapi.documents('plugin::strapi-forms.form').findMany({ filters: { slug } });

// Create
await strapi.documents('plugin::strapi-forms.form').create({ data: {...} });

// Update
await strapi.documents('plugin::strapi-forms.form').update({ documentId, data: {...} });
```

### Admin API Calls
Use `useFetchClient` from `@strapi/strapi/admin` for authenticated requests:
```typescript
import { useFetchClient } from '@strapi/strapi/admin';
const { get, post, put, del } = useFetchClient();
```

### UI Components
Use `@strapi/design-system` v2 components (Field, Modal, Tabs, Table, Card, Button, etc.).

## Content Types

Plugin defines two collection types hidden from Content Manager:
- `plugin::strapi-forms.form`: Form definitions with JSON fields for `fields` and `settings`
- `plugin::strapi-forms.form-submission`: Submission data with relation to form

## Route Structure

| Type | Base Path | Auth | Purpose |
|------|-----------|------|---------|
| Admin | `/strapi-forms/` | Admin session | Form/submission management |
| Content API | `/api/forms/` | Public (configurable) | Schema retrieval, form submission |