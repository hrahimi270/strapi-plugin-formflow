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
      method: 'POST',
      path: '/forms/:slug/submit',
      handler: 'public.submitForm',
      config: {
        auth: false,
        policies: ['plugin::strapi-forms.is-form-active'],
      },
    },
  ],
};
