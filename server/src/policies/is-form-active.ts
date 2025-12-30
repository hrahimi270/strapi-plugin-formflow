import type { Core } from '@strapi/strapi';

/**
 * Policy context interface for route policies
 */
export interface PolicyContext {
  params: Record<string, string>;
  state: Record<string, unknown>;
  request: {
    body: unknown;
    query: Record<string, unknown>;
  };
}

/**
 * Form structure returned from service
 */
interface FormRecord {
  documentId: string;
  slug: string;
  isActive: boolean;
  publishedAt: string | null;
}

/**
 * is-form-active policy
 *
 * Checks if a form exists, is active, and is published before allowing access.
 * This policy should be applied to public routes that require a valid form.
 *
 * Usage in routes:
 * ```
 * policies: ['plugin::strapi-forms.is-form-active']
 * ```
 *
 * @param policyContext - Context containing route params
 * @param _config - Policy configuration (unused)
 * @param strapi - Strapi instance
 * @returns true if form is valid and active, false otherwise
 */
const isFormActivePolicy = async (
  policyContext: PolicyContext,
  _config: unknown,
  { strapi }: { strapi: Core.Strapi }
): Promise<boolean> => {
  const { slug } = policyContext.params;

  // Check if slug parameter is provided
  if (!slug) {
    strapi.log.warn('[Strapi Forms] is-form-active policy: No slug provided in route params');
    return false;
  }

  try {
    // Fetch form by slug using the form service
    const form = (await strapi
      .plugin('strapi-forms')
      .service('form')
      .findBySlug(slug)) as FormRecord | null;

    // Form not found
    if (!form) {
      strapi.log.debug(`[Strapi Forms] is-form-active policy: Form not found: ${slug}`);
      return false;
    }

    // Form is inactive
    if (!form.isActive) {
      strapi.log.debug(`[Strapi Forms] is-form-active policy: Form is inactive: ${slug}`);
      return false;
    }

    // Form is not published (draft/publish workflow)
    // Note: publishedAt being null means the form is in draft state
    if (form.publishedAt === null) {
      strapi.log.debug(`[Strapi Forms] is-form-active policy: Form is not published: ${slug}`);
      return false;
    }

    // All checks passed - form is valid, active, and published
    strapi.log.debug(`[Strapi Forms] is-form-active policy: Access granted for form: ${slug}`);
    return true;
  } catch (error) {
    // Log error and deny access on any unexpected errors
    strapi.log.error('[Strapi Forms] is-form-active policy error:', error);
    return false;
  }
};

export default isFormActivePolicy;
