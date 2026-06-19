/**
 * Helper to build the standard admin policy chain: require an authenticated
 * admin session, then check the user's ability for the given RBAC action(s).
 *
 * The action UIDs map 1:1 to the actions registered in `register.ts`
 * (`plugin::strapi-forms.*`) and the admin constants in
 * `admin/src/permissions.ts`. Super-admins always pass `admin::hasPermissions`.
 */
const protectedBy = (actions: string[]) => [
  'admin::isAuthenticatedAdmin',
  {
    name: 'admin::hasPermissions',
    config: { actions },
  },
];

export default {
  type: 'admin',
  routes: [
    // Form CRUD operations
    {
      method: 'GET',
      path: '/forms',
      handler: 'form.find',
      config: {
        policies: protectedBy(['plugin::strapi-forms.form.read']),
      },
    },
    {
      method: 'GET',
      path: '/forms/count',
      handler: 'form.count',
      config: {
        policies: protectedBy(['plugin::strapi-forms.form.read']),
      },
    },
    {
      method: 'GET',
      path: '/forms/:id',
      handler: 'form.findOne',
      config: {
        policies: protectedBy(['plugin::strapi-forms.form.read']),
      },
    },
    {
      method: 'POST',
      path: '/forms',
      handler: 'form.create',
      config: {
        policies: protectedBy(['plugin::strapi-forms.form.create']),
      },
    },
    {
      method: 'PUT',
      path: '/forms/:id',
      handler: 'form.update',
      config: {
        policies: protectedBy(['plugin::strapi-forms.form.update']),
      },
    },
    {
      method: 'DELETE',
      path: '/forms/:id',
      handler: 'form.delete',
      config: {
        policies: protectedBy(['plugin::strapi-forms.form.delete']),
      },
    },
    {
      // Duplicating creates a new form, so it requires the create permission.
      method: 'POST',
      path: '/forms/:id/duplicate',
      handler: 'form.duplicate',
      config: {
        policies: protectedBy(['plugin::strapi-forms.form.create']),
      },
    },
    // Field types for form builder — needed by anyone who can read/build forms.
    {
      method: 'GET',
      path: '/field-types',
      handler: 'form.getFieldTypes',
      config: {
        policies: protectedBy(['plugin::strapi-forms.form.read']),
      },
    },

    // Submission management
    {
      method: 'GET',
      path: '/forms/:formId/submissions',
      handler: 'submission.find',
      config: {
        policies: protectedBy(['plugin::strapi-forms.submission.read']),
      },
    },
    {
      method: 'GET',
      path: '/forms/:formId/submissions/stats',
      handler: 'submission.stats',
      config: {
        policies: protectedBy(['plugin::strapi-forms.submission.read']),
      },
    },
    {
      method: 'GET',
      path: '/forms/:formId/submissions/export',
      handler: 'submission.export',
      config: {
        policies: protectedBy(['plugin::strapi-forms.submission.export']),
      },
    },
    {
      // Bulk delete uses POST (not DELETE) because Koa/Strapi does not parse a
      // request body on DELETE, so the { ids } payload would never reach the
      // controller. Contract: POST /strapi-forms/forms/:formId/submissions/bulk-delete
      // with body { ids: string[] } -> { data: { success, deleted } }.
      method: 'POST',
      path: '/forms/:formId/submissions/bulk-delete',
      handler: 'submission.deleteMany',
      config: {
        policies: protectedBy(['plugin::strapi-forms.submission.delete']),
      },
    },
    {
      method: 'GET',
      path: '/submissions/:id',
      handler: 'submission.findOne',
      config: {
        policies: protectedBy(['plugin::strapi-forms.submission.read']),
      },
    },
    {
      method: 'PUT',
      path: '/submissions/:id',
      handler: 'submission.update',
      config: {
        policies: protectedBy(['plugin::strapi-forms.submission.update']),
      },
    },
    {
      method: 'DELETE',
      path: '/submissions/:id',
      handler: 'submission.delete',
      config: {
        policies: protectedBy(['plugin::strapi-forms.submission.delete']),
      },
    },
  ],
};
