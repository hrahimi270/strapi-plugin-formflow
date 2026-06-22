/**
 * Helper to build the standard admin policy chain: require an authenticated
 * admin session, then check the user's ability for the given RBAC action(s).
 *
 * The action UIDs map 1:1 to the actions registered in `register.ts`
 * (`plugin::formflow.*`) and the admin constants in
 * `admin/src/permissions.ts`. Super-admins always pass `admin::hasPermissions`.
 */
const protectedBy = (actions: string[]) => [
  'admin::isAuthenticatedAdmin',
  {
    name: 'admin::hasPermissions',
    config: { actions },
  },
];

/**
 * Per-form RBAC enforcement entry, appended AFTER the global `protectedBy`
 * chain on form-scoped routes (those carrying `:id`/`:formId`). The global UID
 * check stays the first, authoritative gate; this policy adds per-form scoping
 * only when the Business `compliance.rbac` feature is entitled (pass-through
 * otherwise — see `policies/per-form-rbac.ts`). `action` is the `form.*` verb
 * this route maps to (read for GETs, update/delete for mutations).
 */
const perForm = (action: 'read' | 'update' | 'delete') => ({
  name: 'plugin::formflow.per-form-rbac',
  config: { action },
});

export default {
  type: 'admin',
  routes: [
    // Form CRUD operations
    {
      method: 'GET',
      path: '/forms',
      handler: 'form.find',
      config: {
        policies: protectedBy(['plugin::formflow.form.read']),
      },
    },
    {
      method: 'GET',
      path: '/forms/count',
      handler: 'form.count',
      config: {
        policies: protectedBy(['plugin::formflow.form.read']),
      },
    },
    {
      method: 'GET',
      path: '/forms/:id',
      handler: 'form.findOne',
      config: {
        policies: [...protectedBy(['plugin::formflow.form.read']), perForm('read')],
      },
    },
    {
      method: 'POST',
      path: '/forms',
      handler: 'form.create',
      config: {
        policies: protectedBy(['plugin::formflow.form.create']),
      },
    },
    {
      method: 'PUT',
      path: '/forms/:id',
      handler: 'form.update',
      config: {
        policies: [...protectedBy(['plugin::formflow.form.update']), perForm('update')],
      },
    },
    {
      method: 'DELETE',
      path: '/forms/:id',
      handler: 'form.delete',
      config: {
        policies: [...protectedBy(['plugin::formflow.form.delete']), perForm('delete')],
      },
    },
    {
      // Duplicating creates a new form, so it requires the create permission.
      method: 'POST',
      path: '/forms/:id/duplicate',
      handler: 'form.duplicate',
      config: {
        policies: protectedBy(['plugin::formflow.form.create']),
      },
    },
    // Field types for form builder — needed by anyone who can read/build forms.
    {
      method: 'GET',
      path: '/field-types',
      handler: 'form.getFieldTypes',
      config: {
        policies: protectedBy(['plugin::formflow.form.read']),
      },
    },

    // Submission management
    {
      method: 'GET',
      path: '/forms/:formId/submissions',
      handler: 'submission.find',
      config: {
        policies: [...protectedBy(['plugin::formflow.submission.read']), perForm('read')],
      },
    },
    {
      method: 'GET',
      path: '/forms/:formId/submissions/stats',
      handler: 'submission.stats',
      config: {
        policies: [...protectedBy(['plugin::formflow.submission.read']), perForm('read')],
      },
    },
    {
      method: 'GET',
      path: '/forms/:formId/submissions/export',
      handler: 'submission.export',
      config: {
        policies: [...protectedBy(['plugin::formflow.submission.export']), perForm('read')],
      },
    },
    {
      // Bulk delete uses POST (not DELETE) because Koa/Strapi does not parse a
      // request body on DELETE, so the { ids } payload would never reach the
      // controller. Contract: POST /formflow/forms/:formId/submissions/bulk-delete
      // with body { ids: string[] } -> { data: { success, deleted } }.
      method: 'POST',
      path: '/forms/:formId/submissions/bulk-delete',
      handler: 'submission.deleteMany',
      config: {
        policies: [...protectedBy(['plugin::formflow.submission.delete']), perForm('delete')],
      },
    },
    {
      method: 'GET',
      path: '/submissions/:id',
      handler: 'submission.findOne',
      config: {
        policies: protectedBy(['plugin::formflow.submission.read']),
      },
    },
    {
      method: 'PUT',
      path: '/submissions/:id',
      handler: 'submission.update',
      config: {
        policies: protectedBy(['plugin::formflow.submission.update']),
      },
    },
    {
      // Approval workflow transition (Business feature; gated 402 in the
      // controller). Reuses submission.update — actioning an approval implies
      // the right to update the submission.
      method: 'PUT',
      path: '/submissions/:id/approve',
      handler: 'submission.approve',
      config: {
        policies: protectedBy(['plugin::formflow.submission.update']),
      },
    },
    {
      method: 'DELETE',
      path: '/submissions/:id',
      handler: 'submission.delete',
      config: {
        policies: protectedBy(['plugin::formflow.submission.delete']),
      },
    },
    {
      // Test-send a webhook config (Pro feature; gated 402 in the controller).
      // Reuses form.update permission: configuring a form's webhooks implies the
      // right to test them. formId scopes RBAC and matches the admin client path.
      method: 'POST',
      path: '/forms/:formId/webhooks/test',
      handler: 'submission.testWebhook',
      config: {
        policies: [...protectedBy(['plugin::formflow.form.update']), perForm('update')],
      },
    },

    // Scheduled export CRUD (Pro feature; gated 402 in the controller). Reuses
    // the submission.export permission — scheduling an export implies the right
    // to export. GET reads the saved schedule (not gated); POST/DELETE manage it.
    {
      method: 'GET',
      path: '/forms/:formId/submissions/schedule-export',
      handler: 'submission.getScheduledExport',
      config: {
        policies: [...protectedBy(['plugin::formflow.submission.export']), perForm('read')],
      },
    },
    {
      method: 'POST',
      path: '/forms/:formId/submissions/schedule-export',
      handler: 'submission.createScheduledExport',
      config: {
        policies: [...protectedBy(['plugin::formflow.submission.export']), perForm('update')],
      },
    },
    {
      method: 'DELETE',
      path: '/forms/:formId/submissions/schedule-export',
      handler: 'submission.removeScheduledExport',
      config: {
        policies: [...protectedBy(['plugin::formflow.submission.export']), perForm('update')],
      },
    },

    // License status — auth-only, no RBAC action (read-only, non-sensitive snapshot)
    {
      method: 'GET',
      path: '/license',
      handler: 'license.state',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },

    // Form analytics dashboard (Pro feature; gated 402 in the controller).
    // Reuses form.read — viewing a form's analytics implies the right to read it.
    {
      method: 'GET',
      path: '/forms/:formId/analytics',
      handler: 'license.analytics',
      config: {
        policies: [...protectedBy(['plugin::formflow.form.read']), perForm('read')],
      },
    },

    // GDPR/compliance operations (Business feature; gated 402 in the controller).
    // Auth-only, no RBAC action — these are super-admin level compliance ops.
    {
      method: 'GET',
      path: '/compliance/subject',
      handler: 'compliance.findSubject',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'DELETE',
      path: '/compliance/subject',
      handler: 'compliance.deleteSubject',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
    {
      method: 'GET',
      path: '/compliance/audit',
      handler: 'compliance.getAuditLog',
      config: {
        policies: ['admin::isAuthenticatedAdmin'],
      },
    },
  ],
};
