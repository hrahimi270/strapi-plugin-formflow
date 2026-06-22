import type { Core } from '@strapi/strapi';

/**
 * Guarded action verb. Maps to the per-form action UIDs registered in
 * `register.ts` (`form.read|create|update|delete.${documentId}`).
 */
export type PerFormRBACAction = 'read' | 'create' | 'update' | 'delete';

/**
 * Policy configuration: which action verb this route guards. The verb selects
 * both the per-form UID (`plugin::formflow.form.<action>.<documentId>`) and the
 * global fallback UID (`plugin::formflow.form.<action>`).
 */
export interface PerFormRBACConfig {
  action: PerFormRBACAction;
}

/**
 * CASL-style ability exposed on `ctx.state.userAbility` (same object
 * `admin::hasPermissions` evaluates). Super-admins carry an unconditional
 * ability whose `can()` returns true for every action.
 */
interface UserAbility {
  can(action: string, subject?: unknown): boolean;
}

/**
 * Policy context for the per-form RBAC evaluator. Mirrors the `PolicyContext`
 * shape used by `is-form-active.ts`, plus the `userAbility` Strapi's admin
 * policies read from `ctx.state`.
 */
export interface PolicyContext {
  params: Record<string, string>;
  state: {
    userAbility?: UserAbility;
    [key: string]: unknown;
  };
}

/**
 * per-form-rbac policy
 *
 * Enforces the per-form RBAC actions registered behind the Business
 * `compliance.rbac` feature. It runs AFTER the global `admin::hasPermissions`
 * gate in each route's policy chain and can only further restrict access; it
 * never replaces the global check.
 *
 * Behaviour:
 *   - Unentitled (`!can('compliance.rbac')`): pass-through. Free / Pro installs
 *     keep global-only behaviour — no per-form scoping, no new 403s.
 *   - Entitled: the requesting admin passes when they hold EITHER the per-form
 *     UID `plugin::formflow.form.<action>.<documentId>` OR the global UID
 *     `plugin::formflow.form.<action>` (global grant is a superset).
 *     Super-admins always pass (their ability allows every action).
 *   - The route param (`:id` for `/forms/:id`, `:formId` for submission routes)
 *     IS the form documentId, so the UID is built directly from it.
 *   - Fail open: any unexpected error (or a missing ability/param) returns
 *     `true`, falling back to the authoritative global `protectedBy` chain that
 *     already ran first. The policy can never harden into a lockout.
 *
 * Usage in routes:
 * ```
 * policies: protectedBy([...]).concat({
 *   name: 'plugin::formflow.per-form-rbac',
 *   config: { action: 'read' },
 * })
 * ```
 *
 * @param policyContext - Context with route params and the user ability
 * @param config - `{ action }` the verb this route guards
 * @param strapi - Strapi instance
 * @returns true to allow, false to deny (403)
 */
const perFormRbacPolicy = (
  policyContext: PolicyContext,
  config: PerFormRBACConfig,
  { strapi }: { strapi: Core.Strapi }
): boolean => {
  try {
    const action = config?.action;
    if (!action) {
      // Misconfigured route — fall back to the global chain rather than deny.
      return true;
    }

    // Lazy license lookup (never a static `ee/` import). When the feature is
    // not entitled (free / Pro / stripped fork) the policy is pass-through.
    const license = strapi.plugin('formflow').service('license');
    if (!license?.can('compliance.rbac')) {
      return true;
    }

    // The admin route param IS the form documentId.
    const documentId = policyContext.params.id ?? policyContext.params.formId;
    if (!documentId) {
      // No form scope on this route — nothing per-form to enforce.
      return true;
    }

    const ability = policyContext.state.userAbility;
    if (!ability) {
      // No ability resolved (should not happen after isAuthenticatedAdmin) —
      // defer to the global chain.
      return true;
    }

    const globalUid = `plugin::formflow.form.${action}`;
    const perFormUid = `plugin::formflow.form.${action}.${documentId}`;

    // Global grant is a superset; super-admins pass via the same ability.can.
    return ability.can(globalUid) || ability.can(perFormUid);
  } catch (error) {
    strapi.log.warn(
      `[FormFlow] per-form-rbac policy error (failing open to global behaviour): ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
    return true;
  }
};

export default perFormRbacPolicy;
