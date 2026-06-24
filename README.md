# FormFlow

**The dynamic, headless form builder for Strapi v5.**

[![npm version](https://img.shields.io/npm/v/strapi-plugin-formflow.svg)](https://www.npmjs.com/package/strapi-plugin-formflow)
[![npm downloads](https://img.shields.io/npm/dm/strapi-plugin-formflow.svg)](https://www.npmjs.com/package/strapi-plugin-formflow)
[![license](https://img.shields.io/npm/l/strapi-plugin-formflow.svg)](./LICENSE)
[![Strapi v5](https://img.shields.io/badge/Strapi-v5-4945FF.svg)](https://strapi.io)

FormFlow lets you build configurable forms visually in the Strapi admin panel and consume them over a clean REST API from **any** frontend. Forms, fields, validation, spam protection, notifications, and submissions all live in Strapi — your frontend just fetches the schema and posts the values. Truly headless: bring your own framework, your own styling, your own UX.

---

## Features

### Form builder & field types

A drag-and-drop form builder with a rich field registry:

- **Basic inputs** — text, textarea, email, number, phone, url, password
- **Choice** — select (dropdown), radio, checkbox, boolean (yes/no toggle)
- **Date & time** — date, time, datetime
- **Advanced** — file upload, hidden, signature, rating / NPS, address + map, rich text, calculated, payment, consent
- **Layout elements** — heading, paragraph, divider
- Per-field options: label, placeholder, description, default value, required flag, half/full width, and custom HTML attributes
- Live field preview and duplicate-form support

### Validation & logic

- Per-field validation rules with custom error messages
- Conditional visibility (show/hide fields based on another field's value)
- Multi-step / wizard forms with per-step grouping and validation

### Submissions

- Submission inbox with list and detail views
- Status management (new, read, processed, archived, spam) and bulk actions
- Export to **CSV, JSON, Excel (XLSX), and PDF**, with optional scheduled exports
- Approval workflow (pending / approved / rejected) for forms that require manual review
- Submission count tracking per form

### Anti-spam

- Honeypot field (configurable field name)
- Google reCAPTCHA **v2 and v3** (with score threshold)
- Cloudflare **Turnstile**
- **hCaptcha**
- IP blocklist
- Per-form rate limiting

### Notifications & integrations

- Email notifications on submission (configurable recipients, subject, reply-to, and templates)
- Outgoing webhooks (POST/PUT, custom headers, `submission.created` / `submission.updated` events)
- Pre-built integrations: **Slack, Google Sheets, Mailchimp, HubSpot, Notion, Zapier, and Make**

### Internationalization

- Per-form locale content overrides (localized labels, placeholders, descriptions, option labels, and success messages) served through the public API by locale

### Save & resume

- Persist partial submissions and return a resume token so users can continue a long form later

### Analytics

- Per-form metrics: views, starts, completions, and drop-off

### Compliance

- Consent capture field
- Configurable data retention
- IP anonymization
- Per-subject data export and deletion with an audit log

### Access control

- Role-based access control (RBAC) integrated with Strapi's Settings → Roles → Plugins, with granular actions for reading, creating, updating, deleting, and exporting forms and submissions

### Headless content API + official SDKs

- Public, configurable REST API under `/api/formflow` for fetching schemas and submitting values
- Sanitized public schema (server-only secrets such as the reCAPTCHA secret key are never exposed)
- Official headless frontend renderers for React and Vue (see below)

---

## Installation

```bash
# npm
npm install strapi-plugin-formflow

# yarn
yarn add strapi-plugin-formflow
```

Enable the plugin in `config/plugins.ts` (or `config/plugins.js`):

```ts
export default {
  formflow: {
    enabled: true,
  },
};
```

> **Requires Strapi v5.** FormFlow creates its own content types automatically on startup — no manual migration is needed.

Rebuild the admin panel so the FormFlow UI is bundled in:

```bash
npm run build
npm run develop
```

---

## Quick start

1. **Create a form.** In the Strapi admin, open **FormFlow** from the main left sidebar (the FormFlow icon), create a form, add fields in the builder, configure validation and settings, and activate it. Note the form's **slug**.

2. **Fetch the schema** from your frontend:

   ```bash
   curl https://your-strapi.example.com/api/formflow/forms/contact
   ```

   Returns the sanitized schema — `title`, `description`, `slug`, `fields`, and public `settings`.

3. **Submit values.** The request body is a flat map of field names to values:

   ```bash
   curl -X POST https://your-strapi.example.com/api/formflow/forms/contact/submit \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Ada Lovelace",
       "email": "ada@example.com",
       "message": "Hello from FormFlow!"
     }'
   ```

   On success you receive `{ "data": { "success": true, "message": "...", "redirectUrl": null } }`. Validation failures return HTTP `400` with a per-field error map.

> For `file` fields, send the request as `multipart/form-data` instead of JSON.

---

## Frontend SDKs

You don't have to wire up fetch calls and rendering by hand. The official **headless** SDKs fetch the schema, render the fields, run validation, and submit for you — framework-agnostic and **bring-your-own-styling** (no CSS shipped, works with Next.js, Astro, Vite, Nuxt, and more). They're built on the shared `@formflowjs/core` engine.

```bash
# React
npm i @formflowjs/react

# Vue
npm i @formflowjs/vue
```

Repository and docs: **https://github.com/hrahimi270/formflow-sdk**

---

## Content API

All public endpoints are mounted under `/api/formflow` and are unauthenticated by default (configurable via Strapi route policies).

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/formflow` | Plugin index / health check |
| `GET`  | `/api/formflow/forms/:slug` | Get a form's sanitized public schema (optionally per `locale`) |
| `POST` | `/api/formflow/forms/:slug/submit` | Submit values for the form |
| `POST` | `/api/formflow/forms/:slug/partial` | Save a partial submission and receive a resume token |
| `GET`  | `/api/formflow/forms/:slug/partial/:resumeToken` | Resume a saved partial submission by token |

---

## Links

- **Repository & issues:** https://github.com/hrahimi270/strapi-plugin-formflow
- **Frontend SDKs:** https://github.com/hrahimi270/formflow-sdk (`@formflowjs/react`, `@formflowjs/vue`)

## License

MIT — see [`LICENSE`](./LICENSE).
