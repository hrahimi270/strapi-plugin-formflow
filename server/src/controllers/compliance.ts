import type { Core } from '@strapi/strapi';

/**
 * Koa context for the compliance controller. Exported per the TS4082 rule (any
 * type used in an exported function signature must itself be exported). Carries
 * the email query param, the admin session (for the audit actor), and the
 * writable `status`/`body` used for the 402 gate response.
 */
export interface ComplianceContext {
  query: { email?: string };
  state?: { auth?: { credentials?: { email?: string } } };
  status: number;
  body: unknown;
}

/**
 * Build the 402 (Payment Required) gate body for an unentitled compliance op.
 */
const paymentRequired = (feature: string) => ({
  error: {
    status: 402,
    name: 'PaymentRequired',
    message: 'Business tier required',
    feature,
  },
});

/**
 * Resolve the audit actor from the admin session, defaulting to 'unknown' when
 * the credentials are not present on the context.
 */
const actorFrom = (ctx: ComplianceContext): string =>
  ctx.state?.auth?.credentials?.email ?? 'unknown';

/**
 * Compliance controller — Business-tier GDPR operations (subject export/delete
 * and audit log). Auth-only routes; the entitlement gate is enforced here and
 * returns 402 when the license is not on the Business tier.
 */
const complianceController = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * GET /formflow/compliance/subject?email=...
   * Export all submissions associated with a subject email (GDPR right of
   * access). Gated on `compliance.consent`; returns 402 when unentitled.
   */
  async findSubject(ctx: ComplianceContext) {
    const licenseService = strapi.plugin('formflow').service('license');
    if (!licenseService.can('compliance.consent')) {
      ctx.status = 402;
      ctx.body = paymentRequired('compliance.consent');
      return;
    }

    // The 402 gate above guarantees entitlement, which is only possible when the
    // `ee/` tree is present — so this lazy import is only reached with EE present
    // (in a stripped fork `can(...)` is false and the gate already returned 402).
    const { findByEmail, appendAuditEntry } = await import('../ee/compliance');

    const email = (ctx.query.email ?? '').trim();
    const result = await findByEmail(strapi, email);

    await appendAuditEntry(strapi, {
      action: 'subject.export',
      actor: actorFrom(ctx),
      target: email,
      count: result.totalCount,
      timestamp: new Date().toISOString(),
    });

    ctx.body = { data: result };
  },

  /**
   * DELETE /formflow/compliance/subject?email=...
   * Delete all submissions associated with a subject email (GDPR right to
   * erasure). Gated on `compliance.consent`; returns 402 when unentitled.
   */
  async deleteSubject(ctx: ComplianceContext) {
    const licenseService = strapi.plugin('formflow').service('license');
    if (!licenseService.can('compliance.consent')) {
      ctx.status = 402;
      ctx.body = paymentRequired('compliance.consent');
      return;
    }

    // Lazy import reached only after the 402 gate passes (EE present); see findSubject.
    const { deleteBySubject, appendAuditEntry } = await import('../ee/compliance');

    const email = (ctx.query.email ?? '').trim();
    const { deleted } = await deleteBySubject(strapi, email);

    await appendAuditEntry(strapi, {
      action: 'subject.delete',
      actor: actorFrom(ctx),
      target: email,
      count: deleted,
      timestamp: new Date().toISOString(),
    });

    ctx.body = { data: { deleted } };
  },

  /**
   * GET /formflow/compliance/audit
   * Return the compliance audit log (most recent first). Gated on
   * `compliance.audit`; returns 402 when unentitled.
   */
  async getAuditLog(ctx: ComplianceContext) {
    const licenseService = strapi.plugin('formflow').service('license');
    if (!licenseService.can('compliance.audit')) {
      ctx.status = 402;
      ctx.body = paymentRequired('compliance.audit');
      return;
    }

    // Lazy import reached only after the 402 gate passes (EE present); see findSubject.
    const { getAuditLog: getAuditLogEE } = await import('../ee/compliance');

    const entries = await getAuditLogEE(strapi);
    ctx.body = { data: entries };
  },
});

export default complianceController;
