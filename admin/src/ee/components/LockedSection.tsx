/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import * as React from 'react';
import { Box } from '@strapi/design-system';

import { type FeatureKey } from '../feature-map';
import { UpsellCard } from './UpsellCard';

export interface LockedSectionProps {
  /** Whether the current license allows the feature. Pass `useLicense().can(feature)` result. */
  can: boolean;
  /** readonly: children rendered but all interactive controls disabled.
   *  replace: children replaced entirely with <UpsellCard>. */
  mode?: 'readonly' | 'replace';
  /** Forwarded to UpsellCard when mode="replace". */
  feature: FeatureKey;
  /** Optional description forwarded to UpsellCard. */
  description?: string;
  children: React.ReactNode;
}

/**
 * Gates a section of the admin UI based on the caller-supplied `can` flag.
 *
 * - entitled: renders children untouched.
 * - locked + replace (default): swaps in an <UpsellCard>.
 * - locked + readonly: renders children but blocks interaction (pointer-events
 *   off, dimmed) so existing form-state values are preserved.
 *
 * A missing/undefined `can` degrades to the locked state, never an error.
 */
export const LockedSection = ({
  can,
  mode = 'replace',
  feature,
  description,
  children,
}: LockedSectionProps) => {
  if (can) {
    return <>{children}</>;
  }

  if (mode === 'readonly') {
    return (
      <Box style={{ pointerEvents: 'none', opacity: 0.6 }} aria-disabled>
        {children}
      </Box>
    );
  }

  return <UpsellCard feature={feature} description={description} />;
};
