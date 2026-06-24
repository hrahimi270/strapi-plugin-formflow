/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import * as React from 'react';
import { Button, Tooltip } from '@strapi/design-system';
import { useNotification } from '@strapi/strapi/admin';

import { type FeatureKey } from '../feature-map';
import { PURCHASE_URL } from './UpsellCard';

export interface GatedButtonProps {
  /** Whether the current license allows this action. */
  can: boolean;
  /** Tooltip text shown when locked. Defaults to "Upgrade to unlock". */
  lockedTooltip?: string;
  /** Feature key — used for the upsell notification message. */
  feature: FeatureKey;
  /** Forwarded to the DS Button when entitled. */
  onClick?: () => void;
  children: React.ReactNode;
  /** Any extra Button props (variant, size, startIcon, etc.). */
  [key: string]: unknown;
}

const DEFAULT_TOOLTIP = 'Upgrade to unlock this feature';

/**
 * A DS Button that is gated by the caller-supplied `can` flag.
 *
 * - entitled: a normal enabled button forwarding `onClick` and extra props.
 * - locked: a disabled button inside a <Tooltip>; clicking (which can still
 *   fire on some browser/DS combinations despite `disabled`) pushes an upsell
 *   notification instead of running the action.
 */
export const GatedButton = ({
  can,
  lockedTooltip = DEFAULT_TOOLTIP,
  feature,
  onClick,
  children,
  ...rest
}: GatedButtonProps) => {
  const { toggleNotification } = useNotification();

  if (can) {
    return (
      <Button onClick={onClick} {...rest}>
        {children}
      </Button>
    );
  }

  const handleLockedClick = () => {
    toggleNotification({
      type: 'info',
      message: 'This is a premium feature. Upgrade your plan to unlock it.',
      link: { label: 'View plans', url: PURCHASE_URL, target: '_blank' },
    });
  };

  return (
    <Tooltip label={lockedTooltip}>
      <Button disabled onClick={handleLockedClick} {...rest}>
        {children}
      </Button>
    </Tooltip>
  );
};
