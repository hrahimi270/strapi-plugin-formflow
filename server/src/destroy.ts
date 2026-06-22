import type { Core } from '@strapi/strapi';

import { RETENTION_CRON_NAME, LICENSE_CRON_NAME } from './bootstrap';
import { stopRateLimitCleanup } from './policies/rate-limit';

const destroy = async ({ strapi }: { strapi: Core.Strapi }) => {
  // Clear the rate-limit cleanup timer started in bootstrap.
  stopRateLimitCleanup();

  // Remove the data-retention cron job if it was registered. Guarded so teardown
  // never throws when retention was disabled (no job to remove) or when the cron
  // service is unavailable. `cron.remove` is a no-op for an unknown task name.
  try {
    if (strapi.cron && typeof strapi.cron.remove === 'function') {
      strapi.cron.remove(RETENTION_CRON_NAME);
    }
  } catch (error) {
    strapi.log.error(
      '[FormFlow] Failed to remove the data-retention cron job:',
      error
    );
  }

  // Remove the license refresh cron and clear any in-flight refresh timer.
  try {
    if (strapi.cron && typeof strapi.cron.remove === 'function') {
      strapi.cron.remove(LICENSE_CRON_NAME);
    }
  } catch (error) {
    strapi.log.error(
      '[FormFlow] Failed to remove the license refresh cron:',
      error
    );
  }

  // Remove any rehydrated scheduled-export crons so no timers leak on teardown.
  // Candidate form ids are derived from the forms collection (mirroring the
  // bootstrap rehydration) and each persisted config is cleared via the EE
  // `removeScheduledExport`. Lazy guarded import + try/catch so teardown never
  // throws when `ee/export` is stripped or the store/cron is unavailable.
  try {
    const { removeScheduledExport } = await import('./ee/export/index');

    const store = strapi.store({ type: 'plugin', name: 'formflow' });
    const forms = await strapi
      .documents('plugin::formflow.form')
      .findMany({ fields: ['documentId'] });

    for (const form of forms) {
      const config = await store.get({
        key: `scheduled-export-${form.documentId}`,
      });
      if (config) {
        await removeScheduledExport(strapi, form.documentId);
      }
    }
  } catch (error) {
    strapi.log.error(
      '[FormFlow] Failed to remove scheduled-export crons:',
      error
    );
  }

  try {
    await strapi.plugin('formflow').service('license').destroy();
  } catch (error) {
    strapi.log.error('[FormFlow] License destroy failed:', error);
  }
};

export default destroy;
