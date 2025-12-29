import { useState, useCallback } from 'react';
import { Box, Flex, Typography, Button } from '@strapi/design-system';
import { Plus } from '@strapi/icons';
import { v4 as uuidv4 } from 'uuid';

import { useFieldTypes } from '../../hooks';
import { FieldTypeSelector } from './FieldTypeSelector';
import type { FormField } from '../../utils/api';

interface FormBuilderProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

/**
 * Creates a new field with default values based on the field type
 */
const createNewField = (type: string, order: number): FormField => {
  const baseField: FormField = {
    id: uuidv4(),
    type,
    name: `field_${Date.now()}`,
    label: getDefaultLabel(type),
    placeholder: '',
    description: '',
    required: false,
    validation: [],
    order,
    width: 'full',
  };

  // Add default options for choice fields
  if (['select', 'radio', 'checkbox'].includes(type)) {
    baseField.options = [
      { label: 'Option 1', value: 'option_1' },
      { label: 'Option 2', value: 'option_2' },
    ];
  }

  return baseField;
};

/**
 * Get default label for a field type
 */
const getDefaultLabel = (type: string): string => {
  const labels: Record<string, string> = {
    text: 'Text Field',
    textarea: 'Text Area',
    email: 'Email Address',
    number: 'Number',
    phone: 'Phone Number',
    url: 'Website URL',
    password: 'Password',
    select: 'Select',
    radio: 'Radio Buttons',
    checkbox: 'Checkboxes',
    boolean: 'Yes/No',
    date: 'Date',
    time: 'Time',
    datetime: 'Date & Time',
    file: 'File Upload',
    hidden: 'Hidden Field',
    heading: 'Heading',
    paragraph: 'Paragraph',
    divider: 'Divider',
  };

  return labels[type] || 'New Field';
};

/**
 * Form Builder component for visually constructing form fields
 * Provides interface for adding and managing form fields
 */
export const FormBuilder = ({ fields, onChange }: FormBuilderProps) => {
  const { fieldTypes, isLoading: isLoadingFieldTypes } = useFieldTypes();
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // Handle opening the field type selector
  const handleAddFieldClick = useCallback(() => {
    setIsSelectorOpen(true);
  }, []);

  // Handle closing the field type selector
  const handleSelectorClose = useCallback(() => {
    setIsSelectorOpen(false);
  }, []);

  // Handle field type selection
  const handleFieldTypeSelect = useCallback(
    (type: string) => {
      const newField = createNewField(type, fields.length);
      onChange([...fields, newField]);
    },
    [fields, onChange]
  );

  return (
    <>
      <Box
        padding={6}
        background="neutral0"
        hasRadius
        shadow="tableShadow"
        borderColor="neutral150"
      >
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
              <Flex direction="column" gap={3}>
                {fields.map((field, index) => (
                  <Box
                    key={field.id}
                    padding={4}
                    background="neutral100"
                    borderColor="neutral200"
                    borderStyle="solid"
                    borderWidth="1px"
                    hasRadius
                  >
                    <Flex justifyContent="space-between" alignItems="center">
                      <Flex gap={3} alignItems="center">
                        <Typography variant="omega" fontWeight="bold" textColor="neutral800">
                          {index + 1}.
                        </Typography>
                        <Box>
                          <Typography fontWeight="bold">{field.label}</Typography>
                          <Typography variant="pi" textColor="neutral600">
                            {field.type} {field.required && '(required)'}
                          </Typography>
                        </Box>
                      </Flex>
                      <Typography variant="pi" textColor="neutral500">
                        {field.name}
                      </Typography>
                    </Flex>
                  </Box>
                ))}
              </Flex>
              <Box marginTop={4} textAlign="center">
                <Typography textColor="neutral600" variant="pi">
                  {fields.length} field{fields.length !== 1 ? 's' : ''} configured
                </Typography>
              </Box>
            </Box>
          )}

          <Button variant="secondary" startIcon={<Plus />} onClick={handleAddFieldClick}>
            Add Field
          </Button>
        </Flex>
      </Box>

      {/* Field Type Selector Modal */}
      <FieldTypeSelector
        isOpen={isSelectorOpen}
        onClose={handleSelectorClose}
        onSelect={handleFieldTypeSelect}
        fieldTypes={fieldTypes}
        isLoading={isLoadingFieldTypes}
      />
    </>
  );
};
