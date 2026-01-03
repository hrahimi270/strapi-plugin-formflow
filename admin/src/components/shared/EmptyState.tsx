import { Box, Flex, Typography } from '@strapi/design-system';
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
  <Box padding={10} textAlign="center" background="neutral100" hasRadius>
    <Flex direction="column" alignItems="center" gap={4}>
      {icon && (
        <Box padding={4} background="neutral200" hasRadius>
          {icon}
        </Box>
      )}
      <Typography variant="delta" fontWeight="bold">
        {title}
      </Typography>
      <Typography textColor="neutral600">{description}</Typography>
      {action && <Box paddingTop={2}>{action}</Box>}
    </Flex>
  </Box>
);
