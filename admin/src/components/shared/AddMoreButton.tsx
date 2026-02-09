import { Typography, Flex } from '@strapi/design-system';
import { Plus } from '@strapi/icons';

interface AddMoreButtonProps {
  text: string;
  onClick: () => void;
}

const AddMoreButton = ({ text, onClick }: AddMoreButtonProps) => {
  return (
    <Flex gap="12px" cursor="pointer" background="primary100" padding="20px" onClick={onClick}>
      <Flex
        justifyContent="center"
        alignItems="center"
        width="2.4rem"
        height="2.4rem"
        background="primary200"
        borderRadius="50%"
      >
        <Plus color="primary600" width="1rem" height="1rem" />
      </Flex>
      <Typography variant="pi" fontWeight="bold" textColor="#4945ff">
        {/* Showing {filteredForms.length} of {forms.length} forms */}
        {text}
      </Typography>
    </Flex>
  );
};

export default AddMoreButton;
