import type { Permission } from '@strapi/strapi/admin';

/**
 * RBAC permission groups for the Strapi Forms plugin.
 *
 * Each entry is a list of admin `Permission` objects (the shape the admin RBAC
 * APIs expect: `addMenuLink({ permissions })`, `<Page.Protect permissions>` and
 * `useRBAC(permissions)`). The server registers the matching action UIDs via
 * `actionProvider.registerMany` (see `server/src/register.ts`), so these action
 * strings must stay in sync with the `plugin::strapi-forms.*` UIDs there.
 *
 * `useRBAC` derives an allowed-action flag from the LAST dot-segment of each
 * action, hyphen-camelCased, e.g.
 *   - `plugin::strapi-forms.form.read`        -> `canRead`
 *   - `plugin::strapi-forms.form.create`      -> `canCreate`
 *   - `plugin::strapi-forms.submission.export`-> `canExport`
 * Because `form.read` and `submission.read` both collapse to `canRead`, only
 * pass the group relevant to the current page to `useRBAC` to avoid collisions.
 */

const buildPermission = (action: string): Permission => ({
  action,
  subject: null,
  id: '',
  actionParameters: {},
  properties: {},
  conditions: [],
});

/**
 * Form-management permissions. `main`/`read` gates access to the plugin (the
 * menu link and the protected app shell).
 */
export const FORM_PERMISSIONS = {
  main: [buildPermission('plugin::strapi-forms.form.read')],
  read: [buildPermission('plugin::strapi-forms.form.read')],
  create: [buildPermission('plugin::strapi-forms.form.create')],
  update: [buildPermission('plugin::strapi-forms.form.update')],
  delete: [buildPermission('plugin::strapi-forms.form.delete')],
} satisfies Record<string, Permission[]>;

/**
 * Submission-management permissions.
 */
export const SUBMISSION_PERMISSIONS = {
  read: [buildPermission('plugin::strapi-forms.submission.read')],
  update: [buildPermission('plugin::strapi-forms.submission.update')],
  delete: [buildPermission('plugin::strapi-forms.submission.delete')],
  export: [buildPermission('plugin::strapi-forms.submission.export')],
} satisfies Record<string, Permission[]>;

/**
 * Top-level permission groups. `main` gates the menu link and the protected app
 * shell (form read); `form` / `submission` expose the per-action groups for
 * `useRBAC` on the individual pages.
 */
export const PERMISSIONS: {
  main: Permission[];
  form: typeof FORM_PERMISSIONS;
  submission: typeof SUBMISSION_PERMISSIONS;
} = {
  // Menu/app access requires form read (the landing page lists forms).
  main: FORM_PERMISSIONS.main,
  form: FORM_PERMISSIONS,
  submission: SUBMISSION_PERMISSIONS,
};
