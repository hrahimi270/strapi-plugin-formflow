import { Typography } from '@strapi/design-system';

interface HeadingProps {
  text: string;
  textColor: string;
}

const Heading = ({ text, textColor }: HeadingProps) => {
  return (
    <Typography textColor={textColor} fontSize="3.2rem" variant="delta" as="h1">
      {text}
    </Typography>
  );
};

export default Heading;
