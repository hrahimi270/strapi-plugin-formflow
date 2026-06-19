export default {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/',
      handler: 'public.index',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/forms/:slug',
      handler: 'public.getFormSchema',
      config: {
        auth: false,
        policies: ['plugin::strapi-forms.is-form-active'],
      },
    },
    {
      // Accepts BOTH application/json and multipart/form-data. Multipart is
      // required for `file` fields: the global `strapi::body` middleware
      // (koa-body, multipart + patchKoa enabled by default) parses uploads into
      // `ctx.request.files` (keyed by field name) and text fields into
      // `ctx.request.body`. No route-level body config is needed; oversize
      // uploads beyond koa-body's limit are rejected by core with HTTP 413.
      method: 'POST',
      path: '/forms/:slug/submit',
      handler: 'public.submitForm',
      config: {
        auth: false,
        policies: ['plugin::strapi-forms.is-form-active', 'plugin::strapi-forms.rate-limit'],
        middlewares: ['plugin::strapi-forms.spam-check'],
      },
    },
  ],
};
