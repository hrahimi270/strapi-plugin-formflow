import type { Core } from '@strapi/strapi';

import { stopRateLimitCleanup } from './policies/rate-limit';

const destroy = (_args: { strapi: Core.Strapi }) => {
  // Clear the rate-limit cleanup timer started in bootstrap.
  stopRateLimitCleanup();
};

export default destroy;
