import { useState, useCallback, useMemo } from 'react';
import { Box, Flex, Grid, Typography, Button, IconButton } from '@strapi/design-system';
import { Plus, Trash, Pencil, Drag } from '@strapi/icons';
import { v4 as uuidv4 } from 'uuid';

import { useFieldTypes } from '../../hooks';
import { FieldTypeSelector } from './FieldTypeSelector';
import { FieldEditor } from './FieldEditor';
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
 * FormBuilder component - Core form building interface
 * Provides two-panel layout with field list and editor
 * Supports drag-and-drop reordering, add, edit, and delete operations
 */
export const FormBuilder = ({ fields, onChange }: FormBuilderProps) => {
  const { fieldTypes, isLoading: isLoadingFieldTypes } = useFieldTypes();
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Get sorted fields by order
  const sortedFields = useMemo(() => {
    return [...fields].sort((a, b) => a.order - b.order);
  }, [fields]);

  // Get currently selected field
  const selectedField = useMemo(() => {
    return fields.find((f) => f.id === selectedFieldId) || null;
  }, [fields, selectedFieldId]);

  // Handle opening the field type selector
  const handleAddFieldClick = useCallback(() => {
    setIsSelectorOpen(true);
  }, []);

  // Handle closing the field type selector
  const handleSelectorClose = useCallback(() => {
    setIsSelectorOpen(false);
  }, []);

  // Handle field type selection - add new field and select it
  const handleFieldTypeSelect = useCallback(
    (type: string) => {
      const newField = createNewField(type, fields.length);
      onChange([...fields, newField]);
      setSelectedFieldId(newField.id);
    },
    [fields, onChange]
  );

  // Handle field selection
  const handleFieldSelect = useCallback((fieldId: string) => {
    setSelectedFieldId(fieldId);
  }, []);

  // Handle field update
  const handleFieldUpdate = useCallback(
    (updates: Partial<FormField>) => {
      if (!selectedFieldId) return;
      onChange(fields.map((f) => (f.id === selectedFieldId ? { ...f, ...updates } : f)));
    },
    [fields, onChange, selectedFieldId]
  );

  // Handle field deletion
  const handleFieldDelete = useCallback(
    (fieldId: string) => {
      onChange(fields.filter((f) => f.id !== fieldId).map((f, index) => ({ ...f, order: index })));
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
      }
    },
    [fields, onChange, selectedFieldId]
  );

  // Handle closing the field editor
  const handleEditorClose = useCallback(() => {
    setSelectedFieldId(null);
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Set drag image transparency
    if (e.currentTarget) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (draggedIndex !== null && draggedIndex !== index) {
        const newFields = [...sortedFields];
        const [movedField] = newFields.splice(draggedIndex, 1);
        newFields.splice(index, 0, movedField);

        // Update order property for all fields
        const reorderedFields = newFields.map((f, i) => ({ ...f, order: i }));
        onChange(reorderedFields);
        setDraggedIndex(index);
      }
    },
    [draggedIndex, sortedFields, onChange]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  return (
    <>
      <Grid.Root gap={6} gridCols={12}>
        {/* Field List - Left Panel */}
        <Grid.Item col={7}>
          <Box background="neutral0" padding={4} hasRadius shadow="tableShadow">
            <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
              <Typography variant="delta" fontWeight="bold">
                Form Fields
              </Typography>
              <Button size="S" startIcon={<Plus />} onClick={handleAddFieldClick}>
                Add Field
              </Button>
            </Flex>

            {sortedFields.length === 0 ? (
              <Box padding={8} textAlign="center" background="neutral100" hasRadius>
                <Typography textColor="neutral600">
                  No fields yet. Click "Add Field" to start building your form.
                </Typography>
              </Box>
            ) : (
              <Flex direction="column" gap={2}>
                {sortedFields.map((field, index) => (
                  <Box
                    key={field.id}
                    draggable
                    onDragStart={(e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, index)}
                    onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    padding={3}
                    background={selectedFieldId === field.id ? 'primary100' : 'neutral100'}
                    borderColor={selectedFieldId === field.id ? 'primary600' : 'neutral200'}
                    borderStyle="solid"
                    borderWidth="2px"
                    hasRadius
                    cursor="grab"
                    onClick={() => handleFieldSelect(field.id)}
                    style={{
                      opacity: draggedIndex === index ? 0.5 : 1,
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <Flex justifyContent="space-between" alignItems="center">
                      <Flex gap={3} alignItems="center">
                        <Box color="neutral500" cursor="grab">
                          <Drag />
                        </Box>
                        <Box>
                          <Typography fontWeight="bold">{field.label}</Typography>
                          <Typography variant="pi" textColor="neutral600">
                            {field.type}
                            {field.required && ' • required'}
                            {field.width === 'half' && ' • half width'}
                          </Typography>
                        </Box>
                      </Flex>
                      <Flex gap={1}>
                        <IconButton
                          label="Edit field"
                          variant="ghost"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleFieldSelect(field.id);
                          }}
                        >
                          <Pencil />
                        </IconButton>
                        <IconButton
                          label="Delete field"
                          variant="ghost"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleFieldDelete(field.id);
                          }}
                        >
                          <Trash />
                        </IconButton>
                      </Flex>
                    </Flex>
                  </Box>
                ))}

                {/* Field count */}
                <Box marginTop={2} textAlign="center">
                  <Typography textColor="neutral600" variant="pi">
                    {sortedFields.length} field{sortedFields.length !== 1 ? 's' : ''} configured
                  </Typography>
                </Box>
              </Flex>
            )}
          </Box>
        </Grid.Item>

        {/* Field Editor - Right Panel */}
        <Grid.Item col={5}>
          <Box
            background="neutral0"
            padding={4}
            hasRadius
            shadow="tableShadow"
            style={{ position: 'sticky', top: 20 }}
          >
            {selectedField ? (
              <FieldEditor
                field={selectedField}
                onChange={handleFieldUpdate}
                onClose={handleEditorClose}
              />
            ) : (
              <Box padding={8} textAlign="center">
                <Flex direction="column" gap={2} alignItems="center">
                  <Typography textColor="neutral600" fontWeight="bold">
                    No field selected
                  </Typography>
                  <Typography textColor="neutral500" variant="pi">
                    Click on a field to edit its properties, or add a new field to get started.
                  </Typography>
                </Flex>
              </Box>
            )}
          </Box>
        </Grid.Item>
      </Grid.Root>

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
