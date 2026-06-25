/* SPDX-License-Identifier: LicenseRef-FormFlow-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import { Box, Flex, Typography, LinkButton } from '@strapi/design-system';

import { type FeatureKey } from '../feature-map';
import { ProBadge } from './ProBadge';

/** Single upsell destination — imported by every Phase 1+ gating point. */
export const PURCHASE_URL = 'https://hrahimi270.github.io/formflow-website/#pricing';

export interface UpsellCardProps {
  /** Feature key whose tier label is shown (e.g. "Pro feature"). */
  feature: FeatureKey;
  /** Short one-line description shown under the tier label. */
  description?: string;
}

/**
 * Replacement body for a fully-locked panel. Pure display component (no hooks):
 * shows the tier badge, an upgrade heading, an optional description and a link
 * to the purchase page.
 */
export const UpsellCard = ({ feature, description }: UpsellCardProps) => {
  return (
    <Box
      background="neutral0"
      hasRadius
      borderColor="neutral200"
      padding={6}
      shadow="tableShadow"
    >
      <Flex direction="column" alignItems="center" gap={3} textAlign="center">
        <ProBadge feature={feature} />
        <Typography variant="delta" fontWeight="bold">
          Upgrade to unlock this feature
        </Typography>
        {description ? (
          <Typography variant="omega" textColor="neutral600">
            {description}
          </Typography>
        ) : null}
        <LinkButton href={PURCHASE_URL} target="_blank" rel="noopener noreferrer">
          View plans
        </LinkButton>
      </Flex>
    </Box>
  );
};
