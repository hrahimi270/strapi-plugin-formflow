import { ArrowLeft } from '@strapi/icons';
import { Link } from '@strapi/design-system';

interface BackButtonProps {
  action: () => void;
  displayText?: boolean
}

const BackButton = ({ action, displayText = true }: BackButtonProps) => {
  return (
    <Link startIcon={<ArrowLeft />} onClick={action}>
      {displayText && 'Back'}
    </Link>
  );
};

export default BackButton;
