import type { Core } from '@strapi/strapi';

import { startRateLimitCleanup } from './policies/rate-limit';

/**
 * Plugin config id used to read the data-retention setting.
 */
const PLUGIN_CONFIG_ID = 'plugin::formflow';

/**
 * Named cron task that purges submissions past the retention window. The name is
 * reused in destroy.ts to remove the job on plugin teardown.
 */
export const RETENTION_CRON_NAME = 'formflowDataRetention';

/**
 * Named cron task that re-validates the license against the MoR daily. The name
 * is reused in destroy.ts to remove the job on plugin teardown.
 */
export const LICENSE_CRON_NAME = 'formflowLicenseRefresh';

/**
 * Named cron task that sends the daily anonymous telemetry heartbeat. The name
 * is reused in destroy.ts to remove the job on plugin teardown.
 */
export const TELEMETRY_CRON_NAME = 'formflowTelemetryHeartbeat';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  // Start the rate-limit store cleanup timer. Its lifecycle is tied to the
  // Strapi instance and is cleared in the destroy hook.
  startRateLimitCleanup();

  // License: initialize the license service (validate key against MoR, restore
  // persisted grace cache). Non-blocking — plugin must always load even if the
  // MoR endpoint is unreachable or the key is absent.
  try {
    await strapi.plugin('formflow').service('license').init();
  } catch (error) {
    strapi.log.error('[FormFlow] License init failed:', error);
  }

  // Telemetry: anonymous, opt-out usage ping (install event + throttled
  // heartbeat). Deliberately NOT awaited so a slow/unreachable endpoint can
  // never delay boot — init() handles its own errors and respects every
  // opt-out signal (see services/telemetry.ts).
  strapi
    .plugin('formflow')
    .service('telemetry')
    .init()
    .catch((error: unknown) => {
      strapi.log.debug('[FormFlow] Telemetry init failed (non-fatal):', error);
    });

  // Data retention: when `dataRetentionDays` > 0, register a daily cron job that
  // deletes submissions older than the configured window. When it is 0/unset
  // (the default) nothing is registered, so behavior is unchanged for existing
  // installs. Auto-purge is a Business-tier feature, so registration is gated on
  // the `compliance.retention` entitlement — unentitled installs never schedule
  // the destructive purge (prefer not-running over deleting under any lapse).
  // The whole block is guarded so the plugin always loads cleanly even if the
  // cron service or license lookup is unavailable in some runtime.
  try {
    const licenseService = strapi.plugin('formflow').service('license');
    const entitled = licenseService.can('compliance.retention');

    const config = strapi.config.get(PLUGIN_CONFIG_ID, {}) as {
      dataRetentionDays?: number;
    };
    const retentionDays = Number(config?.dataRetentionDays) || 0;

    if (entitled && retentionDays > 0 && strapi.cron && typeof strapi.cron.add === 'function') {
      strapi.cron.add({
        [RETENTION_CRON_NAME]: {
          // Daily at midnight (server time): 'minute hour day month weekday'.
          options: '0 0 * * *',
          async task() {
            try {
              await strapi
                .plugin('formflow')
                .service('submission')
                .deleteOlderThan(retentionDays);
            } catch (error) {
              strapi.log.error('[FormFlow] Data retention purge failed:', error);
            }
          },
        },
      });

      strapi.log.info(
        `[FormFlow] Data retention enabled: submissions older than ${retentionDays} day(s) are purged daily.`
      );
    }
  } catch (error) {
    strapi.log.error(
      '[FormFlow] Failed to register the data-retention cron job:',
      error
    );
  }

  // License: register a daily re-validation cron so the cached state is refreshed
  // even for long-running Strapi instances. Mirrors the retention cron pattern.
  try {
    if (strapi.cron && typeof strapi.cron.add === 'function') {
      strapi.cron.add({
        [LICENSE_CRON_NAME]: {
          // 01:00 daily (offset from midnight to avoid retention cron collision).
          options: '0 1 * * *',
          async task() {
            try {
              await strapi.plugin('formflow').service('license').refresh();
            } catch (error) {
              strapi.log.error('[FormFlow] License refresh cron failed:', error);
            }
          },
        },
      });
    }
  } catch (error) {
    strapi.log.error(
      '[FormFlow] Failed to register the license refresh cron:',
      error
    );
  }

  // Telemetry: daily anonymous heartbeat so long-running instances keep
  // registering as active installs. Mirrors the license/retention cron pattern;
  // 02:00 is offset from the other jobs (00:00 retention, 01:00 license). The
  // heartbeat service no-ops on any opt-out and never throws.
  try {
    if (strapi.cron && typeof strapi.cron.add === 'function') {
      strapi.cron.add({
        [TELEMETRY_CRON_NAME]: {
          options: '0 2 * * *',
          async task() {
            try {
              await strapi.plugin('formflow').service('telemetry').heartbeat();
            } catch (error) {
              strapi.log.debug(
                '[FormFlow] Telemetry heartbeat cron failed (non-fatal):',
                error
              );
            }
          },
        },
      });
    }
  } catch (error) {
    strapi.log.debug(
      '[FormFlow] Failed to register the telemetry heartbeat cron:',
      error
    );
  }

  // Scheduled exports: re-register persisted scheduled-export configs after a
  // restart. The controller persists each config to `strapi.store` under
  // `scheduled-export-<formId>` and registers an in-memory cron, but the cron is
  // lost on restart — so without this rehydration every scheduled export silently
  // stops firing until an admin re-saves. Gated on `export.advanced` (a Pro
  // feature): unentitled installs never schedule. Strapi's core store has no
  // prefix-scan, so candidate form ids are derived from the forms collection and
  // each candidate store key is probed. The whole block is guarded so the plugin
  // always loads cleanly even if the store, cron, or `./ee/export` module is
  // unavailable (a stripped MIT fork has no scheduled export).
  try {
    const licenseService = strapi.plugin('formflow').service('license');

    if (licenseService.can('export.advanced')) {
      // Lazy guarded import: a missing `ee/export` (stripped fork) throws
      // MODULE_NOT_FOUND, which is swallowed to skip rehydration silently.
      const { registerScheduledExport } = await import('./ee/export/index');

      const store = strapi.store({ type: 'plugin', name: 'formflow' });
      const forms = await strapi
        .documents('plugin::formflow.form')
        .findMany({ fields: ['documentId'] });

      let count = 0;
      for (const form of forms) {
        const config = await store.get({
          key: `scheduled-export-${form.documentId}`,
        });
        if (config) {
          // `config` is the shape persisted by the controller; the EE function
          // re-validates entitlement and cron availability internally.
          await registerScheduledExport(strapi, config as Parameters<typeof registerScheduledExport>[1]);
          count += 1;
        }
      }

      if (count > 0) {
        strapi.log.info(
          `[FormFlow] Re-registered ${count} scheduled export(s) on bootstrap.`
        );
      }
    }
  } catch (error) {
    strapi.log.error(
      '[FormFlow] Failed to rehydrate scheduled exports:',
      error
    );
  }
};

export default bootstrap;
