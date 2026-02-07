import { Td, Badge, Flex } from '@strapi/design-system';

interface BadgeTDProps {
  text: string;
  badgeVariant: string;
}

const BadgeTD = ({ text, badgeVariant }: BadgeTDProps) => {
  return (
    <Td flex="1">
      <Flex width="100%" height="100%" alignItems="center">
        <Badge variant={badgeVariant}>{text}</Badge>
      </Flex>
    </Td>
  );
};

export default BadgeTD;
