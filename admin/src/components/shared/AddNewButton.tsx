import { Button } from '@strapi/design-system';
import { Plus } from '@strapi/icons';

interface AddNewButtonProps {
  text: string;
  onClick: () => void;
  variant?: string;
}

const AddNewButton = ({ text, onClick, variant = 'default' }: AddNewButtonProps) => {
  return (
    <Button variant={variant} height="3.2rem" startIcon={<Plus />} onClick={onClick}>
      {text}
    </Button>
  );
};

export default AddNewButton;
