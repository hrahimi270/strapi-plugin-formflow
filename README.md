# FormFlow — Strapi Forms Plugin

[![npm version](https://img.shields.io/npm/v/strapi-plugin-formflow.svg)](https://www.npmjs.com/package/strapi-plugin-formflow) <!-- TBD-before-launch -->
[![Strapi Marketplace](https://img.shields.io/badge/Strapi-Marketplace-blueviolet)](https://market.strapi.io/plugins/strapi-plugin-formflow) <!-- TBD-before-launch -->

FormFlow is a flexible Strapi v5 plugin for creating dynamic, configurable forms through the admin panel. It follows a headless CMS architecture — forms are managed in Strapi and consumed via REST API by any frontend.

---

## Install & Usage

```bash
npm install strapi-plugin-formflow
```

Register the plugin in your Strapi project's `config/plugins.js` (or `config/plugins.ts`):

```js
module.exports = {
  'strapi-plugin-formflow': {
    enabled: true,
  },
};
```

No extra database migration is needed — FormFlow creates its own content types (`plugin::formflow.form` and `plugin::formflow.form-submission`) automatically on startup.

---

## Free vs Pro vs Business

| Capability | Free | Pro | Business |
|---|:---:|:---:|:---:|
| Unlimited forms & submissions | ✅ | ✅ | ✅ |
| Core field types (text, textarea, email, number, phone, url, password, select, radio, checkbox, boolean, date, time, datetime, hidden, layout: heading/paragraph/divider) | ✅ | ✅ | ✅ |
| ALL validation rules | ✅ | ✅ | ✅ |
| Submission inbox (list/detail/status/bulk delete) | ✅ | ✅ | ✅ |
| CSV export (+ JSON) | ✅ | ✅ | ✅ |
| Spam basics: honeypot + rate limiting + reCAPTCHA v2 | ✅ | ✅ | ✅ |
| ONE basic admin email notification | ✅ | ✅ | ✅ |
| Public REST API · single-step forms | ✅ | ✅ | ✅ |
| File upload field | ✅ | ✅ | ✅ |
| **Advanced field types** (signature, rating/NPS, address+map, rich text, calculated, Stripe payment) | | ✅ | ✅ |
| **Conditional-logic visual builder** | | ✅ | ✅ |
| **Multi-step / wizard forms** (UI + per-step validation) | | ✅ | ✅ |
| **Advanced email** (multiple notifications, autoresponder, branded/custom templates, conditional routing) | | ✅ | ✅ |
| **Webhooks** (HMAC, multiple, retries) | | ✅ | ✅ |
| **Pre-built integrations** (Slack, Google Sheets, Mailchimp, HubSpot, Notion, Zapier/Make) | | ✅ | ✅ |
| **Advanced spam** (reCAPTCHA v3, Turnstile, hCaptcha, IP/country blocklist) | | ✅ | ✅ |
| **Analytics dashboard** (views/starts/completions/drop-off) | | ✅ | ✅ |
| **Advanced export** (Excel, PDF, scheduled/emailed) | | ✅ | ✅ |
| **Save & resume / partial submissions** | | ✅ | ✅ |
| **White-label / remove branding** (custom CSS) | | ✅ | ✅ |
| **GDPR/compliance** (auto-retention purge, anonymization, consent fields, per-subject export/delete, audit log) | | | ✅ |
| **Approval workflows** | | | ✅ |
| **Multi-language forms** | | | ✅ |
| **Priority support / SLA** | | | ✅ |

> **Note:** The `file` upload field is available on the Free tier and will never be gated.

---

## Setting up your license key

After purchasing a Pro or Business license from [FormFlow on Lemon Squeezy](https://lemon.squeezy.com/formflow) <!-- TBD-before-launch: replace with real store URL once live -->, set the license key in your Strapi project's `.env` file:

```
STRAPI_FORMS_LICENSE_KEY=your_key_here
```

Optionally, override the connectivity-failure grace period (default: 14 days):

```
STRAPI_FORMS_LICENSE_GRACE_DAYS=14
```

**Behavior notes:**

- The server reads the license key at startup via the config system. **Restart Strapi** after changing the key.
- **No key set** = Free tier only. All Free features work normally; Pro/Business features are paused.
- **Invalid or revoked key** = The license service logs a warning at startup and falls back to Free tier. Submission capture and form rendering are never interrupted.
- **Connectivity failure** (can't reach the license validation API) = A 14-day grace period keeps Pro/Business running. Grace applies to network failures only.
- **Revoked or expired key** = Hard-expires immediately with no grace period. After expiry, Pro/Business enhancements pause but all submissions still land (zero data loss). Creating new Pro configuration is blocked with an upsell notice until a valid key is set.

---

## Get a Pro or Business license

Purchase a license at: **[https://lemon.squeezy.com/formflow](https://lemon.squeezy.com/formflow)** <!-- TBD-before-launch: confirm URL once Lemon Squeezy store is live -->

| Tier | Price | Billing | What's included |
|---|---|---|---|
| Free | $0 | — | Core form builder, submission inbox, CSV/JSON export, spam basics, 1 email notification |
| Pro | ~$99–149 / project / year | Annual | All Free features + advanced field types, conditional logic, multi-step forms, advanced email (autoresponder, custom templates, multiple notifications), webhooks, pre-built integrations, advanced spam, analytics dashboard, advanced export (Excel/PDF/scheduled), save & resume, white-label/custom CSS |
| Business | ~$399–699 / year | Annual | All Pro features + GDPR/compliance (auto-retention purge, IP anonymization, consent fields, per-subject export/delete, audit log), approval workflows, multi-language forms, priority support & SLA |

**Billing model:**
- Per-project annual billing. No per-seat pricing, no submission-volume metering.
- Optional launch lifetime deal (Pro–Lifetime variant) may be available — check the store.

---

## Priority support & SLA (Business)

<!-- NOT A BUILDABLE CODE FEATURE — do not add validation gates or missing-code checks for this row -->

Business tier subscribers receive **priority support** from the maintainer:

- **Response target:** next business day for plugin bugs and compatibility questions.
- **SLA scope:** covers confirmed FormFlow plugin bugs, compatibility issues with supported Strapi v5 versions, and configuration questions.
- **Contact channel:** dedicated support email (TBD-before-launch — to be set up before the Business tier goes live) or a private GitHub issue label.
- **Delivery:** priority support is provided manually by the maintainer. It is **not implemented as in-plugin code** — there is no dashboard, ticketing UI, or automated routing. This section is the complete deliverable for the "Priority support / SLA" Business capability.

---

## License

FormFlow uses a dual-license model:

- **Free core** (all files outside any `ee/` directory) — MIT. See [`LICENSE`](./LICENSE).
- **Premium EE code** (all files under `server/src/ee/` and `admin/src/ee/`) — Commercial / all-rights-reserved. See [`LICENSE-EE`](./LICENSE-EE).

The `package.json` `"license"` field is `"MIT"`, which accurately describes the free core. The EE carve-out is documented in `LICENSE`, `LICENSE-EE`, and per-file SPDX headers on every `ee/` file.

Production use of any EE file without a valid FormFlow license key is prohibited under `LICENSE-EE`.

### Open-core safety property

- **Server** (`server/src/ee/`) — *runtime-strip-safe*. The published npm package always ships `ee/`. At runtime, MIT server files (including the license and webhook services) load the EE engine via lazy dynamic imports (`await import('../ee/...')`) guarded by try/catch, so if the `ee/` tree is absent each feature degrades to its free/no-op (`can()===false`) behaviour and **plugin load does not crash** with `MODULE_NOT_FOUND`. A from-source rebuild with `ee/` deleted additionally requires removing the static `import './ee';` barrel line in `server/src/index.ts` and accepts ~20 `TS2307` type-resolution errors (dynamic-import types + webhook type re-exports) — `tsc` resolves those types regardless of the runtime guards. A stripped server runs fully as a free install.
- **Admin panel** (`admin/src/ee/`) — *runtime-degrade-to-free only, NOT build-strip-safe*. The admin bundle contains ~15 MIT files that statically import from `admin/src/ee/` (gating primitives, `LicenseProvider`, `useLicense` hook). ESM static imports cannot be guarded by try/catch, so stripping the `admin/src/ee/` tree requires rebuilding the admin panel — this is intentional and out of scope for v1. The admin degrades to free at **runtime**: `admin/src/ee/context/LicenseContext.ts` defines a free sentinel default where `can()` always returns `false` and tier/state collapse to `'free'`. The panel renders free whenever the license fetch fails or the provider is absent; no component crashes; all gated controls show locked/upsell UI.
