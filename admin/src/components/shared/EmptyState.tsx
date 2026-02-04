import { Flex, Typography } from '@strapi/design-system';
import { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

/**
 * Empty state component for displaying when no data is available
 * Used throughout the plugin for empty lists and initial states
 */
export const EmptyState = ({ title, description, action, icon }: EmptyStateProps) => (
  <Flex direction="column" padding="64px" width="100%" gap="24px" background="white" hasRadius shadow='0px 1px 4px rgba(33, 33, 52, 0.1)'>
    {icon && icon}
    <Flex direction="column" gap="16px">
      <Typography fontSize="1.6rem" textColor="neutral600">
        {title}
      </Typography>
      {/* <Typography textColor="neutral600">{description}</Typography> */}
      {action && action}
    </Flex>
  </Flex>
);
