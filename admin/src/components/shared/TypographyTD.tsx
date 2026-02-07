import { Td, Typography, Flex } from '@strapi/design-system';

interface TypographyTDProps {
  text: string;
}

const TypographyTD = ({ text }: TypographyTDProps) => {
  return (
    <Td flex="1" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
      <Flex width="100%" height="100%" alignItems="center">
        <Typography textColor="neutral800">{text}</Typography>
      </Flex>
    </Td>
  );
};

export default TypographyTD;
