import { Td, Badge, Flex } from '@strapi/design-system';

interface TableBadgeProps {
  text: string;
  badgeVariant: string;
}

const TableBadge = ({ text, badgeVariant }: TableBadgeProps) => {
  return (
    <Td flex="1">
      <Flex width="100%" height="100%" alignItems="center">
        <Badge variant={badgeVariant}>{text}</Badge>
      </Flex>
    </Td>
  );
};

export default TableBadge;
