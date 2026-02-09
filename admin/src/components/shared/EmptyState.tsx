import { Flex, Typography, Button } from '@strapi/design-system';
import { Plus } from '@strapi/icons';
import { ReactNode } from 'react';

interface EmptyStateProps {
  text: string;
  buttonText: string;
  description?: string;
  icon?: ReactNode;
  action: () => void;
  shadow?: boolean;
  border?: boolean;
}

/**
 * Empty state component for displaying when no data is available
 * Used throughout the plugin for empty lists and initial states
 */
const EmptyState = ({
  text,
  buttonText,
  description = '',
  icon,
  action,
  shadow = false,
  border = false,
}: EmptyStateProps) => (
  <Flex
    direction="column"
    padding="64px"
    width="100%"
    gap="24px"
    background="white"
    hasRadius
    shadow={shadow ? '0px 1px 4px rgba(33, 33, 52, 0.1)' : 'none'}
    borderColor={border ? '#dcdce4' : 'transparent'}
  >
    {icon && icon}
    <Flex direction="column" gap="16px">
      <Typography fontSize="1.6rem" textColor="neutral600" variant="beta">
        {text}
      </Typography>

      {/* <Typography textColor="neutral600">{description}</Typography> */}

      <Button
        variant="secondary" // color scheme
        height="3.2rem"
        startIcon={<Plus color="#271fe0" />}
        onClick={action}
      >
        {buttonText}
      </Button>
    </Flex>
  </Flex>
);

export default EmptyState;
