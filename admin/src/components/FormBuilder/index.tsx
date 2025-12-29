import { Box, Flex, Typography, Button } from '@strapi/design-system';
import { Plus } from '@strapi/icons';

import type { FormField } from '../../utils/api';

interface FormBuilderProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

/**
 * Form Builder component for visually constructing form fields
 * Provides drag-and-drop interface for adding and arranging fields
 *
 * @todo Implement full form builder functionality in ENG-1849
 */
export const FormBuilder = ({ fields, onChange }: FormBuilderProps) => {
  return (
    <Box padding={6} background="neutral0" hasRadius shadow="tableShadow" borderColor="neutral150">
      <Flex direction="column" alignItems="center" gap={4}>
        <Typography variant="delta" fontWeight="bold">
          Form Fields
        </Typography>

        {fields.length === 0 ? (
          <Box padding={8} textAlign="center">
            <Typography textColor="neutral600" variant="omega">
              No fields added yet. Click the button below to add your first field.
            </Typography>
          </Box>
        ) : (
          <Box width="100%">
            <Typography textColor="neutral600" variant="omega">
              {fields.length} field{fields.length !== 1 ? 's' : ''} configured
            </Typography>
          </Box>
        )}

        <Button
          variant="secondary"
          startIcon={<Plus />}
          onClick={() => {
            // Placeholder: will be implemented in ENG-1849
            console.log('Add field clicked', onChange);
          }}
        >
          Add Field
        </Button>
      </Flex>
    </Box>
  );
};
