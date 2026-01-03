export default {
  type: 'admin',
  routes: [
    // Form CRUD operations
    {
      method: 'GET',
      path: '/forms',
      handler: 'form.find',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/forms/count',
      handler: 'form.count',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/forms/:id',
      handler: 'form.findOne',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/forms',
      handler: 'form.create',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/forms/:id',
      handler: 'form.update',
      config: {
        policies: [],
      },
    },
    {
      method: 'DELETE',
      path: '/forms/:id',
      handler: 'form.delete',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/forms/:id/duplicate',
      handler: 'form.duplicate',
      config: {
        policies: [],
      },
    },
    // Field types for form builder
    {
      method: 'GET',
      path: '/field-types',
      handler: 'form.getFieldTypes',
      config: {
        policies: [],
      },
    },

    // Submission management
    {
      method: 'GET',
      path: '/forms/:formId/submissions',
      handler: 'submission.find',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/forms/:formId/submissions/stats',
      handler: 'submission.stats',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/forms/:formId/submissions/export',
      handler: 'submission.export',
      config: {
        policies: [],
      },
    },
    {
      method: 'DELETE',
      path: '/forms/:formId/submissions',
      handler: 'submission.deleteMany',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/submissions/:id',
      handler: 'submission.findOne',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/submissions/:id',
      handler: 'submission.update',
      config: {
        policies: [],
      },
    },
    {
      method: 'DELETE',
      path: '/submissions/:id',
      handler: 'submission.delete',
      config: {
        policies: [],
      },
    },
  ],
};
