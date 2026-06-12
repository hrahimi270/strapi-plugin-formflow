import type { Core } from '@strapi/strapi';

/**
 * Koa context interface for public controller methods
 */
export interface PublicContext {
  params: { slug?: string };
  query: Record<string, unknown>;
  request: {
    body: Record<string, unknown>;
    ip: string;
    headers: Record<string, string | string[] | undefined>;
  };
  status: number;
  notFound: (message?: string) => void;
  throw: (status: number, message: string) => never;
}

/**
 * Metadata collected from the submission request
 */
interface SubmissionMetadata {
  ipAddress: string;
  userAgent: string | undefined;
  referrer: string | undefined;
  submittedAt: string;
}

/**
 * Custom validation error with details
 */
interface ValidationError extends Error {
  name: 'ValidationError';
  details: Record<string, string[]>;
}

/**
 * Type guard to check if error is a ValidationError
 */
const isValidationError = (error: unknown): error is ValidationError => {
  return error instanceof Error && error.name === 'ValidationError';
};

/**
 * Public controller for form schema and submission endpoints
 * These endpoints are exposed via content-api routes (public access)
 */
const publicController = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Get form schema for frontend rendering
   * GET /api/forms/:slug
   *
   * Returns the public-safe portions of a form configuration
   * for frontend applications to dynamically render forms.
   *
   * @param ctx - Koa context
   * @returns Form schema or 404 if not found/inactive
   */
  async getFormSchema(ctx: PublicContext) {
    const { slug } = ctx.params;

    if (!slug || typeof slug !== 'string') {
      ctx.status = 400;
      return {
        error: {
          status: 400,
          name: 'BadRequestError',
          message: 'Form slug is required',
        },
      };
    }

    try {
      const schema = await strapi.plugin('strapi-forms').service('form').getPublicSchema(slug);

      if (!schema) {
        return ctx.notFound('Form not found or not available');
      }

      return { data: schema };
    } catch (error) {
      strapi.log.error('Error fetching form schema:', error);
      ctx.throw(500, 'Internal server error');
    }
  },

  /**
   * Submit form data
   * POST /api/forms/:slug/submit
   *
   * Validates and processes form submissions, storing them in the database.
   * Handles spam detection, validation errors, and returns appropriate responses.
   *
   * @param ctx - Koa context with form data in request body
   * @returns Success response with message/redirect or validation errors
   */
  async submitForm(ctx: PublicContext) {
    const { slug } = ctx.params;
    const submissionData = ctx.request.body as Record<string, unknown>;

    if (!slug || typeof slug !== 'string') {
      ctx.status = 400;
      return {
        error: {
          status: 400,
          name: 'BadRequestError',
          message: 'Form slug is required',
        },
      };
    }

    if (!submissionData || typeof submissionData !== 'object') {
      ctx.status = 400;
      return {
        error: {
          status: 400,
          name: 'BadRequestError',
          message: 'Request body is required',
        },
      };
    }

    // Collect client metadata for submission record
    const userAgentHeader = ctx.request.headers['user-agent'];
    const refererHeader = ctx.request.headers['referer'] || ctx.request.headers['referrer'];

    const metadata: SubmissionMetadata = {
      ipAddress: ctx.request.ip,
      userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
      referrer: Array.isArray(refererHeader) ? refererHeader[0] : refererHeader,
      submittedAt: new Date().toISOString(),
    };

    try {
      const result = await strapi
        .plugin('strapi-forms')
        .service('submission')
        .submit(slug, submissionData, metadata);

      return {
        data: {
          success: true,
          message: result.successMessage,
          redirectUrl: result.redirectUrl,
        },
      };
    } catch (error) {
      // Handle validation errors with detailed field-level messages
      if (isValidationError(error)) {
        ctx.status = 400;
        return {
          error: {
            status: 400,
            name: 'ValidationError',
            message: 'Validation failed',
            details: {
              errors: error.details,
            },
          },
        };
      }

      // Handle known error messages with appropriate status codes
      if (error instanceof Error) {
        if (error.message === 'Form not found') {
          return ctx.notFound('Form not found');
        }

        if (error.message === 'Form is not accepting submissions') {
          ctx.status = 403;
          return {
            error: {
              status: 403,
              name: 'ForbiddenError',
              message: 'Form is not accepting submissions',
            },
          };
        }
      }

      // Log and throw generic error for unexpected issues
      strapi.log.error('Error submitting form:', error);
      ctx.throw(500, 'Internal server error');
    }
  },

  /**
   * Health check endpoint for form API
   * GET /api/forms
   *
   * Returns a simple status response to verify the API is running.
   */
  async index(_ctx: PublicContext) {
    return {
      data: {
        status: 'ok',
        message: 'Strapi Forms API is running',
      },
    };
  },
});

export default publicController;
