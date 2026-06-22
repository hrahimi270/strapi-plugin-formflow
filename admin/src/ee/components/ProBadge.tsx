/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import { Badge } from '@strapi/design-system';

import { FEATURE_TIER, type FeatureKey, type Tier } from '../feature-map';

export interface ProBadgeProps {
  /** Feature key to look up in FEATURE_TIER, or an explicit tier string. */
  feature?: FeatureKey;
  tier?: Tier;
}

/**
 * Small tier label badge ("Pro" / "Business"). Resolves the tier from a
 * `feature` key (via FEATURE_TIER) or an explicit `tier` prop. Renders nothing
 * for the free tier or when no tier can be resolved.
 */
export const ProBadge = ({ feature, tier }: ProBadgeProps) => {
  const resolvedTier: Tier | undefined = feature ? FEATURE_TIER[feature] : tier;

  if (!resolvedTier || resolvedTier === 'free') {
    return null;
  }

  // `active` tints the badge with the primary colour — used to set Pro apart
  // from the secondary-variant Business badge without inventing custom tokens.
  if (resolvedTier === 'business') {
    return <Badge variant="secondary">Business</Badge>;
  }

  return (
    <Badge variant="primary" active>
      Pro
    </Badge>
  );
};
