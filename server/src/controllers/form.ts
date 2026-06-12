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

const formController = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * GET /strapi-forms/forms
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

      const formService = strapi.plugin('strapi-forms').service('form');

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
   * GET /strapi-forms/forms/:id
   * Get a single form by documentId
   */
  async findOne(ctx: Context) {
    const { id } = ctx.params;

    if (!id) {
      return ctx.throw(400, new Error('Form ID is required'));
    }

    try {
      const form = await strapi.plugin('strapi-forms').service('form').findOne(id);

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
   * POST /strapi-forms/forms
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

    try {
      const form = await strapi.plugin('strapi-forms').service('form').create(data);

      ctx.status = 201;
      return { data: form };
    } catch (error) {
      strapi.log.error('Error creating form:', error);
      ctx.throw(500, error);
    }
  },

  /**
   * PUT /strapi-forms/forms/:id
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
      const existing = await strapi.plugin('strapi-forms').service('form').findOne(id);

      if (!existing) {
        return ctx.notFound('Form not found');
      }

      const form = await strapi.plugin('strapi-forms').service('form').update(id, data);

      return { data: form };
    } catch (error) {
      strapi.log.error(`Error updating form ${id}:`, error);
      ctx.throw(500, error);
    }
  },

  /**
   * DELETE /strapi-forms/forms/:id
   * Delete a form and all its submissions
   */
  async delete(ctx: Context) {
    const { id } = ctx.params;

    if (!id) {
      return ctx.throw(400, new Error('Form ID is required'));
    }

    try {
      // First check if form exists
      const existing = await strapi.plugin('strapi-forms').service('form').findOne(id);

      if (!existing) {
        return ctx.notFound('Form not found');
      }

      await strapi.plugin('strapi-forms').service('form').delete(id);

      return { data: { success: true } };
    } catch (error) {
      strapi.log.error(`Error deleting form ${id}:`, error);
      ctx.throw(500, error);
    }
  },

  /**
   * POST /strapi-forms/forms/:id/duplicate
   * Duplicate an existing form
   */
  async duplicate(ctx: Context) {
    const { id } = ctx.params;

    if (!id) {
      return ctx.throw(400, new Error('Form ID is required'));
    }

    try {
      const form = await strapi.plugin('strapi-forms').service('form').duplicate(id);

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
   * GET /strapi-forms/field-types
   * Get all available field types for the form builder
   */
  async getFieldTypes() {
    const fieldTypes = strapi.plugin('strapi-forms').service('form').getFieldTypes();

    return { data: fieldTypes };
  },

  /**
   * GET /strapi-forms/forms/count
   * Count total forms with optional filtering
   */
  async count(ctx: Context) {
    try {
      const count = await strapi
        .plugin('strapi-forms')
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
