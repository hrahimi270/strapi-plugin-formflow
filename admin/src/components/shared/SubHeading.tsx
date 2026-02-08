import { Typography } from '@strapi/design-system';

interface SubHeadingProps {
  text: string;
  textColor?: string;
}

const SubHeading = ({ text, textColor = 'neutral600' }: SubHeadingProps) => {
  return (
    <Typography fontSize="1.6rem" variant="epsilon" textColor={textColor} as="p">
      {text}
    </Typography>
  );
};

export default SubHeading;
