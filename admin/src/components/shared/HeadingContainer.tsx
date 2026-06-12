import React from 'react';
import { Flex } from '@strapi/design-system';

interface HeadingContainerProps {
    children: React.ReactNode
}

const HeadingContainer = ({ children }: HeadingContainerProps) => {
  return <Flex direction="column" alignItems="start" gap="12px" width="100%">
    {children}
  </Flex>;
};

export default HeadingContainer;
