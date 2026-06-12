import type { Core } from '@strapi/strapi';

import { startRateLimitCleanup } from './policies/rate-limit';

const bootstrap = (_args: { strapi: Core.Strapi }) => {
  // Start the rate-limit store cleanup timer. Its lifecycle is tied to the
  // Strapi instance and is cleared in the destroy hook.
  startRateLimitCleanup();
};

export default bootstrap;
