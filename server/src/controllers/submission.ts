import type { Core } from '@strapi/strapi';

/**
 * Koa context interface for submission controller methods
 */
export interface SubmissionContext {
  params: { id?: string; formId?: string };
  query: Record<string, string | undefined>;
  request: {
    body: Record<string, unknown>;
  };
  status: number;
  body: unknown;
  notFound: (message?: string) => void;
  badRequest: (message?: string) => void;
  throw: (status: number, message: string) => never;
  set: (header: string, value: string) => void;
}

/**
 * Valid submission statuses for updates
 */
const VALID_STATUSES = ['new', 'read', 'processed', 'archived', 'spam'] as const;

/**
 * Parse sort string into Strapi sort object
 * @param sort - Sort string in format "field:direction"
 * @returns Sort object for Strapi query
 */
const parseSort = (sort: string): Record<string, 'asc' | 'desc'> => {
  const [field, direction] = sort.split(':');
  return { [field || 'createdAt']: (direction as 'asc' | 'desc') || 'desc' };
};

/**
 * Submission controller for admin panel management
 * Provides CRUD operations for form submissions
 */
const submissionController = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * List submissions for a form with pagination and filtering
   * GET /strapi-forms/forms/:formId/submissions
   *
   * Query params:
   * - page: Page number (default: 1)
   * - pageSize: Items per page (default: 25, max: 100)
   * - status: Filter by status (new, read, processed, archived, spam)
   * - sort: Sort field and direction (default: createdAt:desc)
   */
  async find(ctx: SubmissionContext) {
    const { formId } = ctx.params;

    if (!formId) {
      return ctx.badRequest('Form ID is required');
    }

    const { page = '1', pageSize = '25', status, sort = 'createdAt:desc' } = ctx.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

    try {
      const filters: Record<string, unknown> = {};
      if (status && VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        filters.status = status;
      }

      const submissionService = strapi.plugin('strapi-forms').service('submission');

      const [submissions, total] = await Promise.all([
        submissionService.find(formId, {
          filters,
          sort: parseSort(sort),
          limit: pageSizeNum,
          offset: (pageNum - 1) * pageSizeNum,
        }),
        submissionService.count(formId, filters),
      ]);

      return {
        data: submissions,
        meta: {
          pagination: {
            page: pageNum,
            pageSize: pageSizeNum,
            pageCount: Math.ceil(total / pageSizeNum),
            total,
          },
        },
      };
    } catch (error) {
      strapi.log.error('[Strapi Forms] Error fetching submissions:', error);
      ctx.throw(500, 'Failed to fetch submissions');
    }
  },

  /**
   * Get a single submission by ID
   * GET /strapi-forms/submissions/:id
   *
   * Automatically marks the submission as "read" if it was "new"
   */
  async findOne(ctx: SubmissionContext) {
    const { id } = ctx.params;

    if (!id) {
      return ctx.badRequest('Submission ID is required');
    }

    try {
      const submissionService = strapi.plugin('strapi-forms').service('submission');
      const submission = await submissionService.findOne(id);

      if (!submission) {
        return ctx.notFound('Submission not found');
      }

      // Auto-mark as read when viewing a new submission
      if (submission.status === 'new') {
        await submissionService.markAsRead(id);
        submission.status = 'read';
      }

      return { data: submission };
    } catch (error) {
      strapi.log.error('[Strapi Forms] Error fetching submission:', error);
      ctx.throw(500, 'Failed to fetch submission');
    }
  },

  /**
   * Update submission status
   * PUT /strapi-forms/submissions/:id
   *
   * Body: { status: 'new' | 'read' | 'processed' | 'archived' | 'spam' }
   */
  async update(ctx: SubmissionContext) {
    const { id } = ctx.params;
    const { status } = ctx.request.body;

    if (!id) {
      return ctx.badRequest('Submission ID is required');
    }

    if (!status || typeof status !== 'string') {
      return ctx.badRequest('Status is required');
    }

    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return ctx.badRequest(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    try {
      const submissionService = strapi.plugin('strapi-forms').service('submission');

      // Verify submission exists
      const existing = await submissionService.findOne(id);
      if (!existing) {
        return ctx.notFound('Submission not found');
      }

      const submission = await submissionService.update(id, { status });

      return { data: submission };
    } catch (error) {
      strapi.log.error('[Strapi Forms] Error updating submission:', error);
      ctx.throw(500, 'Failed to update submission');
    }
  },

  /**
   * Delete a single submission
   * DELETE /strapi-forms/submissions/:id
   */
  async delete(ctx: SubmissionContext) {
    const { id } = ctx.params;

    if (!id) {
      return ctx.badRequest('Submission ID is required');
    }

    try {
      const submissionService = strapi.plugin('strapi-forms').service('submission');

      // Verify submission exists
      const existing = await submissionService.findOne(id);
      if (!existing) {
        return ctx.notFound('Submission not found');
      }

      await submissionService.delete(id);

      return { data: { success: true } };
    } catch (error) {
      strapi.log.error('[Strapi Forms] Error deleting submission:', error);
      ctx.throw(500, 'Failed to delete submission');
    }
  },

  /**
   * Delete multiple submissions for a form
   * DELETE /strapi-forms/forms/:formId/submissions
   *
   * Body: { ids: string[] }
   */
  async deleteMany(ctx: SubmissionContext) {
    const { formId } = ctx.params;
    const { ids } = ctx.request.body;

    if (!formId) {
      return ctx.badRequest('Form ID is required');
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return ctx.badRequest('No submission IDs provided');
    }

    // Validate all IDs are strings
    if (!ids.every((id) => typeof id === 'string')) {
      return ctx.badRequest('Invalid submission IDs');
    }

    try {
      const deleted = await strapi
        .plugin('strapi-forms')
        .service('submission')
        .deleteMany(formId, ids as string[]);

      return {
        data: {
          success: true,
          deleted: deleted.length,
        },
      };
    } catch (error) {
      strapi.log.error('[Strapi Forms] Error deleting submissions:', error);
      ctx.throw(500, 'Failed to delete submissions');
    }
  },

  /**
   * Get submission statistics for a form
   * GET /strapi-forms/forms/:formId/submissions/stats
   */
  async stats(ctx: SubmissionContext) {
    const { formId } = ctx.params;

    if (!formId) {
      return ctx.badRequest('Form ID is required');
    }

    try {
      const stats = await strapi.plugin('strapi-forms').service('submission').getStats(formId);

      return { data: stats };
    } catch (error) {
      strapi.log.error('[Strapi Forms] Error fetching submission stats:', error);
      ctx.throw(500, 'Failed to fetch submission statistics');
    }
  },

  /**
   * Export submissions as CSV
   * GET /strapi-forms/forms/:formId/submissions/export
   *
   * Query params:
   * - status: Filter by status
   */
  async export(ctx: SubmissionContext) {
    const { formId } = ctx.params;
    const { status } = ctx.query;

    if (!formId) {
      return ctx.badRequest('Form ID is required');
    }

    try {
      const filters: Record<string, unknown> = {};
      if (status && VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        filters.status = status;
      }

      const csv = await strapi
        .plugin('strapi-forms')
        .service('submission')
        .exportToCsv(formId, filters);

      // Get form for filename
      const form = await strapi.plugin('strapi-forms').service('form').findOne(formId);

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${form?.slug || 'submissions'}-${dateStr}.csv`;

      ctx.set('Content-Type', 'text/csv; charset=utf-8');
      ctx.set('Content-Disposition', `attachment; filename="${filename}"`);
      ctx.body = csv;
    } catch (error) {
      strapi.log.error('[Strapi Forms] Error exporting submissions:', error);
      ctx.throw(500, 'Failed to export submissions');
    }
  },
});

export default submissionController;
