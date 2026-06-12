import { Flex } from '@strapi/design-system';

interface SidebarItemContainerProps {
  children: React.ReactNode;
}

const SidebarItemContainer = ({ children }: SidebarItemContainerProps) => {
  return (
    <Flex
      background="white"
      width="100%"
      direction="column"
      gap="12px"
      padding="16px"
      hasRadius
      shadow="0px 1px 4px rgba(33, 33, 52, 0.1)"
    >
      {children}
    </Flex>
  );
};

export default SidebarItemContainer;
