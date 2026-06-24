/* SPDX-License-Identifier: LicenseRef-FormFlow-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
export * from './feature-map';

// EE sentinel — T18 greps dist/ for this string to verify the barrel bundled.
export const EE_SENTINEL = 'formflow-ee';

// DCE-guard (mirrors admin LicenseContext.displayName = '__EE_ADMIN__'): a
// top-level side-effect that mutates globalThis. The bundler cannot prove this
// statement is side-effect-free, so it cannot tree-shake EE_SENTINEL out of the
// runtime bundle. check-ee-bundled.mjs greps dist/server for 'formflow-ee'.
(globalThis as Record<string, unknown>).__FORMFLOW_EE__ ??= EE_SENTINEL;

// EE license service factory (produced by T04 at server/src/ee/license/service.ts).
export { createLicenseService as eeLicenseService } from './license/service';

// Premium engine sub-packages (appended by T11)
export * from './webhooks';
export * from './email';
export * from './spam';
export * from './compliance';

// Advanced export engine (xlsx/pdf/scheduled — T22)
export * from './export';

// Pre-built integrations dispatcher (Slack/Sheets/Mailchimp/HubSpot/Notion/Zapier/Make — T25)
export { default as integrationsServiceFactory } from './integrations/index';
