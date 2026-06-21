import type { Core } from '@strapi/strapi';

import { startRateLimitCleanup } from './policies/rate-limit';

/**
 * Plugin config id used to read the data-retention setting.
 */
const PLUGIN_CONFIG_ID = 'plugin::strapi-forms';

/**
 * Named cron task that purges submissions past the retention window. The name is
 * reused in destroy.ts to remove the job on plugin teardown.
 */
export const RETENTION_CRON_NAME = 'strapiFormsDataRetention';

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  // Start the rate-limit store cleanup timer. Its lifecycle is tied to the
  // Strapi instance and is cleared in the destroy hook.
  startRateLimitCleanup();

  // Data retention: when `dataRetentionDays` > 0, register a daily cron job that
  // deletes submissions older than the configured window. When it is 0/unset
  // (the default) nothing is registered, so behavior is unchanged for existing
  // installs. The whole block is guarded so the plugin always loads cleanly even
  // if the cron service is unavailable in some runtime.
  try {
    const config = strapi.config.get(PLUGIN_CONFIG_ID, {}) as {
      dataRetentionDays?: number;
    };
    const retentionDays = Number(config?.dataRetentionDays) || 0;

    if (retentionDays > 0 && strapi.cron && typeof strapi.cron.add === 'function') {
      strapi.cron.add({
        [RETENTION_CRON_NAME]: {
          // Daily at midnight (server time): 'minute hour day month weekday'.
          options: '0 0 * * *',
          async task() {
            try {
              await strapi
                .plugin('strapi-forms')
                .service('submission')
                .deleteOlderThan(retentionDays);
            } catch (error) {
              strapi.log.error('[Strapi Forms] Data retention purge failed:', error);
            }
          },
        },
      });

      strapi.log.info(
        `[Strapi Forms] Data retention enabled: submissions older than ${retentionDays} day(s) are purged daily.`
      );
    }
  } catch (error) {
    strapi.log.error(
      '[Strapi Forms] Failed to register the data-retention cron job:',
      error
    );
  }
};

export default bootstrap;
