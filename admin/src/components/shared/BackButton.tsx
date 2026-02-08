import { ArrowLeft } from '@strapi/icons';
import { Link } from '@strapi/design-system';

interface BackButtonProps {
  handleBack: () => void;
}

const BackButton = ({ handleBack }: BackButtonProps) => {
  return (
    <Link width="100%" startIcon={<ArrowLeft />} onClick={handleBack}>
      Back
    </Link>
  );
};

export default BackButton;
