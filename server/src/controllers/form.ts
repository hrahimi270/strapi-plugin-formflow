import type { Core } from '@strapi/strapi';

/**
 * Koa context interface for controller methods
 */
export interface Context {
  params: { id?: string };
  query: Record<string, unknown>;
  request: {
    body: Record<string, unknown>;
  };
  status: number;
  notFound: (message?: string) => void;
  throw: (status: number, error: unknown) => never;
}

/**
 * Saved-form baseline passed to the CONFIG entitlement helper. `null` on create.
 */
export interface OldForm {
  settings?: {
    layout?: string;
    steps?: unknown[];
    customCss?: string;
  };
  fields?: Array<{ type?: string; conditional?: unknown }>;
  requiresApproval?: boolean;
  locales?: Record<string, unknown>;
}

/**
 * Incoming form payload (create/update body) checked by the entitlement helper.
 */
export interface NewFormData {
  settings?: {
    layout?: string;
    steps?: unknown[];
    customCss?: string;
  };
  fields?: Array<{ type?: string; conditional?: unknown }>;
  requiresApproval?: boolean;
  locales?: Record<string, unknown>;
}

/**
 * CONFIG entitlement gate. Diffs the saved form (old) against the incoming
 * payload (new) and blocks only *newly added* Pro configuration — existing
 * multi-step layouts, conditional rules, Pro fields, and custom CSS always
 * persist regardless of entitlement.
 *
 * Returns `null` when the save is allowed, or `{ entitled: false, feature }`
 * describing the first blocked feature. Never throws: the license lookup is a
 * synchronous, lazy stub that degrades to free-only when EE is absent.
 */
async function assertSettingsEntitled(
  strapi: Core.Strapi,
  oldForm: OldForm | null,
  newData: NewFormData
): Promise<{ entitled: boolean; feature: string } | null> {
  try {
    // Lazy lookup — never a top-level import of ee/; falls back to free-only stub.
    const license = strapi.plugin('formflow').service('license');

    const oldSettings = oldForm?.settings ?? {};
    const newSettings = newData?.settings ?? {};
    const oldFields = oldForm?.fields ?? [];
    const newFields = newData?.fields ?? [];

    // Gate #10 — multi-step: switching TO multi-step OR adding new steps
    if (!license.can('multistep')) {
      const switchingToMultiStep =
        newSettings.layout === 'multi-step' && oldSettings.layout !== 'multi-step';
      const addingSteps =
        Array.isArray(newSettings.steps) &&
        (newSettings.steps.length ?? 0) > (oldSettings.steps?.length ?? 0);
      if (switchingToMultiStep || addingSteps) {
        return { entitled: false, feature: 'multistep' };
      }
    }

    // Gate #11 — conditional logic: newly-added field.conditional on any field
    if (!license.can('conditionalLogic')) {
      const oldConditionalCount = oldFields.filter((f) => f.conditional != null).length;
      const newConditionalCount = newFields.filter((f) => f.conditional != null).length;
      if (newConditionalCount > oldConditionalCount) {
        return { entitled: false, feature: 'conditionalLogic' };
      }
    }

    // Gate #12 — Pro field types: block fields whose type CHANGES to an
    //   unlicensed Pro type — both newly-added fields AND existing fields flipped
    //   to a Pro type. A field that was ALREADY this Pro type persists (never
    //   re-blocked / stripped — premium-plan.md §10 "existing preserved").
    //   file is FREE (locked decision); only the 6 Pro types are gated.
    const PRO_FIELD_TYPES = new Set([
      'signature',
      'rating',
      'address',
      'richtext',
      'calculated',
      'payment',
    ]);
    const oldFieldTypeById = new Map<string | undefined, string | undefined>(
      oldFields.map((f: { id?: string; type?: string }) => [f.id, f.type] as const)
    );
    for (const field of newFields) {
      if (!PRO_FIELD_TYPES.has(field.type ?? '')) continue;
      // `existingType` is the field's saved type, or undefined when newly added.
      const id = (field as { id?: string }).id;
      const existingType = id ? oldFieldTypeById.get(id) : undefined;
      // Block when the type is newly this Pro type (added OR changed to it).
      // `existingType === field.type` means it was already this Pro type → persist.
      if (existingType !== field.type && !license.can(`fields.${field.type}`)) {
        return { entitled: false, feature: `fields.${field.type}` };
      }
    }

    // Gate #17 — consent field (Business): block newly-added `consent`-type
    // fields when not entitled. Existing consent fields persist (never stripped).
    if (!license.can('compliance.consent')) {
      for (const field of newFields) {
        if (field.type !== 'consent') continue;
        const id = (field as { id?: string }).id;
        const existingType = id ? oldFieldTypeById.get(id) : undefined;
        if (existingType !== 'consent') {
          return { entitled: false, feature: 'compliance.consent' };
        }
      }
    }

    // Gate #13 — custom CSS: saving NEW non-empty customCss when not entitled
    if (!license.can('whiteLabel')) {
      const oldCss = oldSettings.customCss ?? '';
      const newCss = newSettings.customCss ?? '';
      if (newCss.trim() !== '' && oldCss.trim() === '') {
        return { entitled: false, feature: 'whiteLabel' };
      }
    }

    // Gate #17 — approval workflows (Business): enabling requiresApproval on a
    // form that did not previously require it. Turning it OFF is always allowed.
    if (!license.can('approval')) {
      if (newData.requiresApproval === true && oldForm?.requiresApproval !== true) {
        return { entitled: false, feature: 'approval' };
      }
    }

    // Gate #17 — multi-language (Business): saving NEW locale content on a form
    // that previously had none. Existing locales are never stripped on lapse.
    if (!license.can('multiLanguage')) {
      const oldHasLocales = Object.keys(oldForm?.locales ?? {}).length > 0;
      const newHasLocales =
        newData.locales != null && Object.keys(newData.locales).length > 0;
      if (newHasLocales && !oldHasLocales) {
        return { entitled: false, feature: 'multiLanguage' };
      }
    }

    return null;
  } catch {
    // License lookup must never block a save — default to allow.
    return null;
  }
}

const formController = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * GET /formflow/forms
   * List all forms with pagination, sorting, and optional search.
   *
   * Query params:
   * - page: Page number (default: 1)
   * - pageSize: Items per page (default: 100)
   * - sort: Sort string "field:direction" (default: createdAt:desc)
   * - _q: Optional search term matched against title/slug ($containsi)
   *
   * Returns a paginated envelope:
   * { data: Form[], meta: { pagination: { page, pageSize, pageCount, total } } }
   */
  async find(ctx: Context) {
    try {
      const query = ctx.query as Record<string, unknown>;

      const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
      const pageSize = Math.min(
        500,
        Math.max(1, parseInt(String(query.pageSize ?? '100'), 10) || 100)
      );

      // Parse sort "field:direction" -> { field: direction }
      const sortParam = typeof query.sort === 'string' ? query.sort : 'createdAt:desc';
      const [sortField, sortDir] = sortParam.split(':');
      const sort: Record<string, 'asc' | 'desc'> = {
        [sortField || 'createdAt']: sortDir === 'asc' ? 'asc' : 'desc',
      };

      // Optional search across title and slug
      const search = typeof query._q === 'string' ? query._q.trim() : '';
      const filters: Record<string, unknown> = search
        ? {
            $or: [{ title: { $containsi: search } }, { slug: { $containsi: search } }],
          }
        : {};

      const formService = strapi.plugin('formflow').service('form');

      const [forms, total] = await Promise.all([
        formService.find({
          filters,
          sort,
          start: (page - 1) * pageSize,
          limit: pageSize,
        }),
        formService.count(filters),
      ]);

      return {
        data: forms,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount: Math.ceil(total / pageSize),
            total,
          },
        },
      };
    } catch (error) {
      strapi.log.error('Error fetching forms:', error);
      ctx.throw(500, error);
    }
  },

  /**
   * GET /formflow/forms/:id
   * Get a single form by documentId
   */
  async findOne(ctx: Context) {
    const { id } = ctx.params;

    if (!id) {
      return ctx.throw(400, new Error('Form ID is required'));
    }

    try {
      const form = await strapi.plugin('formflow').service('form').findOne(id);

      if (!form) {
        return ctx.notFound('Form not found');
      }

      return { data: form };
    } catch (error) {
      strapi.log.error(`Error fetching form ${id}:`, error);
      ctx.throw(500, error);
    }
  },

  /**
   * POST /formflow/forms
   * Create a new form
   */
  async create(ctx: Context) {
    const data = ctx.request.body;

    if (!data || typeof data !== 'object') {
      return ctx.throw(400, new Error('Request body is required'));
    }

    if (!data.title) {
      return ctx.throw(400, new Error('Form title is required'));
    }

    const entitlementBlock = await assertSettingsEntitled(strapi, null, data as NewFormData);
    if (entitlementBlock) {
      ctx.status = 402;
      return {
        error: {
          status: 402,
          name: 'PaymentRequired',
          message: `Upgrade to Pro to use feature: ${entitlementBlock.feature}`,
          details: { feature: entitlementBlock.feature, upgradeUrl: 'https://hrahimi270.github.io/formflow-website/#pricing' },
        },
      };
    }

    try {
      const form = await strapi.plugin('formflow').service('form').create(data);

      ctx.status = 201;
      return { data: form };
    } catch (error) {
      strapi.log.error('Error creating form:', error);
      ctx.throw(500, error);
    }
  },

  /**
   * PUT /formflow/forms/:id
   * Update an existing form
   */
  async update(ctx: Context) {
    const { id } = ctx.params;
    const data = ctx.request.body;

    if (!id) {
      return ctx.throw(400, new Error('Form ID is required'));
    }

    if (!data || typeof data !== 'object') {
      return ctx.throw(400, new Error('Request body is required'));
    }

    try {
      // First check if form exists
      const existing = await strapi.plugin('formflow').service('form').findOne(id);

      if (!existing) {
        return ctx.notFound('Form not found');
      }

      const entitlementBlock = await assertSettingsEntitled(
        strapi,
        existing as OldForm,
        data as NewFormData
      );
      if (entitlementBlock) {
        ctx.status = 402;
        return {
          error: {
            status: 402,
            name: 'PaymentRequired',
            message: `Upgrade to Pro to use feature: ${entitlementBlock.feature}`,
            details: {
              feature: entitlementBlock.feature,
              upgradeUrl: 'https://hrahimi270.github.io/formflow-website/#pricing',
            },
          },
        };
      }

      const form = await strapi.plugin('formflow').service('form').update(id, data);

      return { data: form };
    } catch (error) {
      strapi.log.error(`Error updating form ${id}:`, error);
      ctx.throw(500, error);
    }
  },

  /**
   * DELETE /formflow/forms/:id
   * Delete a form and all its submissions
   */
  async delete(ctx: Context) {
    const { id } = ctx.params;

    if (!id) {
      return ctx.throw(400, new Error('Form ID is required'));
    }

    try {
      // First check if form exists
      const existing = await strapi.plugin('formflow').service('form').findOne(id);

      if (!existing) {
        return ctx.notFound('Form not found');
      }

      await strapi.plugin('formflow').service('form').delete(id);

      return { data: { success: true } };
    } catch (error) {
      strapi.log.error(`Error deleting form ${id}:`, error);
      ctx.throw(500, error);
    }
  },

  /**
   * POST /formflow/forms/:id/duplicate
   * Duplicate an existing form
   */
  async duplicate(ctx: Context) {
    const { id } = ctx.params;

    if (!id) {
      return ctx.throw(400, new Error('Form ID is required'));
    }

    try {
      const form = await strapi.plugin('formflow').service('form').duplicate(id);

      ctx.status = 201;
      return { data: form };
    } catch (error) {
      if (error instanceof Error && error.message === 'Form not found') {
        return ctx.notFound('Form not found');
      }
      strapi.log.error(`Error duplicating form ${id}:`, error);
      ctx.throw(500, error);
    }
  },

  /**
   * GET /formflow/field-types
   * Get all available field types for the form builder
   */
  async getFieldTypes() {
    const fieldTypes = strapi.plugin('formflow').service('form').getFieldTypes();

    return { data: fieldTypes };
  },

  /**
   * GET /formflow/forms/count
   * Count total forms with optional filtering
   */
  async count(ctx: Context) {
    try {
      const count = await strapi
        .plugin('formflow')
        .service('form')
        .count(ctx.query.filters as Record<string, unknown>);

      return { data: { count } };
    } catch (error) {
      strapi.log.error('Error counting forms:', error);
      ctx.throw(500, error);
    }
  },
});

export default formController;
