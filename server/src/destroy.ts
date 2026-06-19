import type { Core } from '@strapi/strapi';

import { RETENTION_CRON_NAME } from './bootstrap';
import { stopRateLimitCleanup } from './policies/rate-limit';

const destroy = ({ strapi }: { strapi: Core.Strapi }) => {
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
      '[Strapi Forms] Failed to remove the data-retention cron job:',
      error
    );
  }
};

export default destroy;
