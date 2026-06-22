import type { Core } from '@strapi/strapi';

/**
 * Analytics event content type UID. Append-only, admin-invisible (see the
 * schema's pluginOptions).
 */
const ANALYTICS_CONTENT_TYPE_UID = 'plugin::formflow.form-analytics-event';

/** The four captured event kinds. */
export type AnalyticsEventType = 'view' | 'start' | 'completion' | 'drop_off';

/**
 * Aggregated, all-time (or since-filtered) counts for a single form, plus the
 * derived conversion rate. Returned by {@link AnalyticsService.getStats} and
 * forwarded verbatim to the admin analytics dashboard.
 */
export interface AnalyticsStats {
  views: number;
  starts: number;
  completions: number;
  drop_offs: number;
  /** completions / views, in [0, 1]. 0 when views === 0. */
  conversionRate: number;
}

export interface AnalyticsService {
  recordEvent(formDocumentId: string, eventType: AnalyticsEventType, stepId?: string): void;
  getStats(formDocumentId: string, since?: Date): Promise<AnalyticsStats>;
}

/**
 * Analytics capture + aggregation. This is an MIT file by design: the capture
 * path is NEVER gated (plan §6.7 — submission capture end-to-end stays free in
 * any license state). The Pro gate lives entirely on the read side (the admin
 * controller returns 402 when unentitled), never here.
 */
const analyticsService = ({ strapi }: { strapi: Core.Strapi }): AnalyticsService => ({
  /**
   * Persist a single analytics event. ALWAYS fire-and-forget: callers never
   * `await` it, and it never throws. A failure to record an event must never
   * affect a form view, step validation, or submission — so the write is wrapped
   * in a try/catch that only logs at warn level.
   */
  recordEvent(formDocumentId: string, eventType: AnalyticsEventType, stepId?: string): void {
    strapi
      .documents(ANALYTICS_CONTENT_TYPE_UID)
      .create({
        data: {
          formDocumentId,
          eventType,
          ...(stepId ? { stepId } : {}),
        },
      })
      .catch((error: unknown) => {
        strapi.log.warn(`[FormFlow] Failed to record analytics event (${eventType}): ${error}`);
      });
  },

  /**
   * Aggregate the four event counts for a form and derive the conversion rate.
   * Counts each event type with a scoped `count` query (no row loading), so it
   * scales with the number of events without materializing them.
   */
  async getStats(formDocumentId: string, since?: Date): Promise<AnalyticsStats> {
    const baseFilters: Record<string, unknown> = { formDocumentId };
    if (since) {
      baseFilters.createdAt = { $gte: since };
    }

    const countFor = (eventType: AnalyticsEventType) =>
      strapi.documents(ANALYTICS_CONTENT_TYPE_UID).count({
        filters: { ...baseFilters, eventType },
      });

    const [views, starts, completions, drop_offs] = await Promise.all([
      countFor('view'),
      countFor('start'),
      countFor('completion'),
      countFor('drop_off'),
    ]);

    return {
      views,
      starts,
      completions,
      drop_offs,
      conversionRate: views === 0 ? 0 : completions / views,
    };
  },
});

export default analyticsService;
