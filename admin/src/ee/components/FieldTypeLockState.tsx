/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import { Box, Flex, Typography } from '@strapi/design-system';
import { Lock } from '@strapi/icons';
import styled from 'styled-components';

import { type Tier } from '../feature-map';
import { ProBadge } from './ProBadge';

export interface FieldTypeLockStateProps {
  /** Display label for the field type tile (e.g. "Signature"). */
  label: string;
  /** Icon name or element — pass-through to whatever icon mechanism FieldTypeSelector uses. */
  icon: string;
  /** The tier required — shown via <ProBadge>. */
  tier: Tier;
  /** Called when the user clicks the locked tile (to show upsell, handled by parent). */
  onLockedClick?: () => void;
}

/**
 * Locked-tile variant for the FieldTypeSelector grid. Matches the dimensions of
 * the unlocked tile (same border/padding) so no layout shift occurs when locked
 * and unlocked tiles are mixed. The tile is dimmed, shows a lock icon and a
 * tier badge, and forwards clicks to the parent via `onLockedClick`.
 */
const LockedTile = styled.button`
  position: relative;
  display: block;
  width: 100%;
  cursor: pointer;
  text-align: left;
  background: ${({ theme }) => theme.colors.neutral100};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: ${({ theme }) => theme.spaces[4]};

  &:hover {
    border-color: ${({ theme }) => theme.colors.neutral300};
  }

  &:focus-visible {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary600};
    box-shadow: ${({ theme }) => theme.colors.primary600} 0px 0px 0px 2px;
  }
`;

export const FieldTypeLockState = ({
  label,
  icon,
  tier,
  onLockedClick,
}: FieldTypeLockStateProps) => {
  return (
    <LockedTile type="button" onClick={onLockedClick} title={label}>
      {/* top-right corner tier badge */}
      <Box position="absolute" top={1} right={1}>
        <ProBadge tier={tier} />
      </Box>
      <Flex direction="column" alignItems="center" gap={2} style={{ opacity: 0.5 }}>
        <Flex>
          <Lock aria-hidden />
        </Flex>
        <Typography variant="pi" fontWeight="bold" textAlign="center" textColor="neutral600">
          {label}
        </Typography>
      </Flex>
    </LockedTile>
  );
};
