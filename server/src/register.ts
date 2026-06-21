import type { Core } from '@strapi/strapi';

/**
 * RBAC permission actions for the plugin.
 *
 * Registered with the admin permission `actionProvider`, which computes each
 * action UID as `plugin::<pluginName>.<uid>` — so these become
 * `plugin::strapi-forms.form.read`, `plugin::strapi-forms.submission.export`,
 * etc. `section: 'plugins'` groups them under the "Forms" entry in
 * Settings → Roles → (role) → Plugins. These UIDs MUST stay in sync with the
 * route policies in `routes/admin/index.ts` and the admin permission constants
 * in `admin/src/permissions.ts`.
 */
export const RBAC_ACTIONS = [
  {
    section: 'plugins',
    displayName: 'Read forms',
    uid: 'form.read',
    pluginName: 'strapi-forms',
  },
  {
    section: 'plugins',
    displayName: 'Create forms',
    uid: 'form.create',
    pluginName: 'strapi-forms',
  },
  {
    section: 'plugins',
    displayName: 'Update forms',
    uid: 'form.update',
    pluginName: 'strapi-forms',
  },
  {
    section: 'plugins',
    displayName: 'Delete forms',
    uid: 'form.delete',
    pluginName: 'strapi-forms',
  },
  {
    section: 'plugins',
    displayName: 'Read submissions',
    uid: 'submission.read',
    pluginName: 'strapi-forms',
  },
  {
    section: 'plugins',
    displayName: 'Update submissions',
    uid: 'submission.update',
    pluginName: 'strapi-forms',
  },
  {
    section: 'plugins',
    displayName: 'Delete submissions',
    uid: 'submission.delete',
    pluginName: 'strapi-forms',
  },
  {
    section: 'plugins',
    displayName: 'Export submissions',
    uid: 'submission.export',
    pluginName: 'strapi-forms',
  },
];

/**
 * OpenAPI fragment describing the plugin's public (content-api) endpoints.
 *
 * Note the plugin prefix: Strapi mounts plugin content-api routes under
 * `{api.rest.prefix}/{pluginName}`, so the live paths are
 * `/api/strapi-forms/...`. The `/api` prefix is already part of the generated
 * spec's `servers[].url`, so the path keys below are written WITHOUT `/api`
 * but WITH the `strapi-forms` plugin segment.
 *
 * These three paths are declared explicitly because the documentation plugin's
 * auto-scanner is content-type-name driven and would mis-type the slug param
 * (as number), drop the index route, and reference the wrong request body for
 * the dynamic submit payload.
 */
const PUBLIC_API_OVERRIDE = {
  tags: [
    {
      name: 'Strapi Forms (Public)',
      description: 'Public, headless endpoints for retrieving form schemas and submitting forms.',
    },
  ],
  paths: {
    '/strapi-forms': {
      get: {
        tags: ['Strapi Forms (Public)'],
        summary: 'Plugin index / health check',
        description: 'Returns a simple welcome payload confirming the plugin is mounted.',
        operationId: 'strapiFormsIndex',
        responses: {
          '200': {
            description: 'Plugin is available.',
          },
        },
      },
    },
    '/strapi-forms/forms/{slug}': {
      get: {
        tags: ['Strapi Forms (Public)'],
        summary: "Get a form's public schema by slug",
        description:
          'Returns the sanitized, public-safe schema (fields, settings) for an active form. Sensitive settings (e.g. reCAPTCHA secret) are never exposed.',
        operationId: 'getFormSchema',
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            description: 'The unique slug of the form.',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'The public form schema.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FormSchemaResponse' },
              },
            },
          },
          '403': {
            description: 'Form is inactive, unknown, or otherwise not publicly available.',
          },
        },
      },
    },
    '/strapi-forms/forms/{slug}/submit': {
      post: {
        tags: ['Strapi Forms (Public)'],
        summary: 'Submit a form',
        description:
          'Submits values for the form identified by slug. The request body is an arbitrary map of the form field names to their submitted values.',
        operationId: 'submitForm',
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            description: 'The unique slug of the form.',
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          description: 'A map of form field names to their submitted values.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FormSubmissionRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Submission accepted.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FormSubmitSuccessResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failed.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FormSubmitValidationErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Form is inactive, rate-limited, or rejected as spam.',
          },
        },
      },
    },
  },
  components: {
    schemas: {
      FormSchemaResponse: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          slug: { type: 'string' },
          fields: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
          },
          settings: { type: 'object', additionalProperties: true },
        },
      },
      FormSubmissionRequest: {
        type: 'object',
        description: 'Arbitrary map of form field names to their submitted values.',
        additionalProperties: true,
      },
      FormSubmitSuccessResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              redirectUrl: { type: 'string', nullable: true },
            },
          },
        },
      },
      FormSubmitValidationErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              status: { type: 'integer', example: 400 },
              name: { type: 'string', example: 'BadRequestError' },
              message: { type: 'string' },
              details: {
                type: 'object',
                properties: {
                  errors: {
                    type: 'object',
                    description: 'Map of field name to an array of error messages.',
                    additionalProperties: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const register = async ({ strapi }: { strapi: Core.Strapi }) => {
  // Register the plugin's RBAC permission actions so they appear in
  // Settings → Roles → Plugins → Forms and can gate the admin routes/UI.
  // Wrapped defensively so a host/admin-service edge case never blocks plugin
  // load (super-admins always pass `hasPermissions` regardless).
  try {
    await strapi.service('admin::permission').actionProvider.registerMany(RBAC_ACTIONS);
  } catch (error) {
    strapi.log.warn(
      `[Strapi Forms] Failed to register RBAC permission actions: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }

  // Register an OpenAPI override with @strapi/plugin-documentation (if present)
  // so the plugin's public endpoints appear in the host's generated spec with
  // correct paths/params/schemas. No-ops cleanly when the documentation plugin
  // is not installed, so the plugin still loads in any host.
  try {
    const documentationPlugin = strapi.plugin('documentation');

    if (!documentationPlugin) {
      return;
    }

    const overrideService = documentationPlugin.service('override');

    if (!overrideService || typeof overrideService.registerOverride !== 'function') {
      return;
    }

    overrideService.registerOverride(PUBLIC_API_OVERRIDE, {
      // Only applied when the host has opted strapi-forms into documentation.
      pluginOrigin: 'strapi-forms',
      // Suppress the unreliable auto-scanner for this plugin so it doesn't emit
      // mis-typed/duplicate paths alongside our explicit override.
      excludeFromGeneration: ['strapi-forms'],
    });
  } catch (error) {
    strapi.log.warn(
      `[Strapi Forms] Failed to register documentation override: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
};

export default register;
