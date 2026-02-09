import { useState, useCallback, useMemo } from 'react';
import { Box, Flex, Typography, IconButton } from '@strapi/design-system';
import { Trash, Pencil, Drag, Files } from '@strapi/icons';
import { v4 as uuidv4 } from 'uuid';

import { useFieldTypes } from '../../hooks';
import { FieldTypeSelector } from './FieldTypeSelector';
import { FieldEditor } from './FieldEditor';
import type { FormField } from '../../utils/api';
import EmptyState from '../shared/EmptyState';

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
 * Displays fields in a grid layout respecting their width settings
 * Supports drag-and-drop reordering, add, edit, and delete operations
 */
export const FormBuilder = ({ fields, onChange }: FormBuilderProps) => {
  const { fieldTypes, isLoading: isLoadingFieldTypes } = useFieldTypes();
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
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

  // Handle field type selection - add new field and open editor
  const handleFieldTypeSelect = useCallback(
    (type: string) => {
      const newField = createNewField(type, fields.length);
      onChange([...fields, newField]);
      setSelectedFieldId(newField.id);
      setIsEditorOpen(true);
    },
    [fields, onChange]
  );

  // Handle field selection for editing
  const handleFieldEdit = useCallback((fieldId: string) => {
    setSelectedFieldId(fieldId);
    setIsEditorOpen(true);
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
        setIsEditorOpen(false);
      }
    },
    [fields, onChange, selectedFieldId]
  );

  // Handle closing the field editor modal
  const handleEditorClose = useCallback(() => {
    setIsEditorOpen(false);
    setSelectedFieldId(null);
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
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
      <Flex direction="column" gap="4px" width="100%">
        <Box width="100%">
          <Typography variant="primary" fontWeight="bold" fontSize="12px">
          Fields
        </Typography>
        </Box>
        {/* Fields Grid */}
        {sortedFields.length === 0 ? (
          <EmptyState
            icon={<Files color="#7b79ff" width={96} height="auto" />}
            text="No fields yet"
            buttonText="Start building your form"
            action={handleAddFieldClick}
            border
          />
        ) : (
          <>
            <Flex width="100%" wrap="wrap" gap={3}>
              {sortedFields.map((field, index) => (
                <Box
                  key={field.id}
                  draggable
                  onDragStart={(e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, index)}
                  onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  padding={4}
                  background="neutral100"
                  borderColor="neutral200"
                  borderStyle="solid"
                  borderWidth="1px"
                  hasRadius
                  style={{
                    width: field.width === 'half' ? 'calc(50% - 6px)' : '100%',
                    opacity: draggedIndex === index ? 0.5 : 1,
                    transition: 'opacity 0.15s ease-in-out',
                    cursor: 'grab',
                  }}
                >
                  <Flex justifyContent="space-between" alignItems="flex-start">
                    <Flex gap={3} alignItems="flex-start" style={{ flex: 1, minWidth: 0 }}>
                      <Box color="neutral500" style={{ cursor: 'grab', marginTop: '2px' }}>
                        <Drag />
                      </Box>
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight="bold" ellipsis>
                          {field.label}
                        </Typography>
                        <Flex gap={2} marginTop={1} wrap="wrap">
                          <Box
                            padding={1}
                            paddingLeft={2}
                            paddingRight={2}
                            background="primary100"
                            hasRadius
                          >
                            <Typography variant="pi" textColor="primary700">
                              {field.type}
                            </Typography>
                          </Box>
                          {field.required && (
                            <Box
                              padding={1}
                              paddingLeft={2}
                              paddingRight={2}
                              background="danger100"
                              hasRadius
                            >
                              <Typography variant="pi" textColor="danger700">
                                required
                              </Typography>
                            </Box>
                          )}
                          <Box
                            padding={1}
                            paddingLeft={2}
                            paddingRight={2}
                            background="neutral200"
                            hasRadius
                          >
                            <Typography variant="pi" textColor="neutral700">
                              {field.width === 'half' ? '50%' : '100%'}
                            </Typography>
                          </Box>
                        </Flex>
                      </Box>
                    </Flex>
                    <Flex gap={1} style={{ flexShrink: 0 }}>
                      <IconButton
                        label="Edit field"
                        variant="ghost"
                        withTooltip={false}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleFieldEdit(field.id);
                        }}
                      >
                        <Pencil />
                      </IconButton>
                      <IconButton
                        label="Delete field"
                        variant="ghost"
                        withTooltip={false}
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
            </Flex>

            {/* Field count */}
            <Box marginTop={4} textAlign="center">
              <Typography textColor="neutral600" variant="pi">
                {sortedFields.length} field{sortedFields.length !== 1 ? 's' : ''} configured
              </Typography>
            </Box>
          </>
        )}
      </Flex>

      {/* Field Type Selector Modal */}
      <FieldTypeSelector
        isOpen={isSelectorOpen}
        onClose={handleSelectorClose}
        onSelect={handleFieldTypeSelect}
        fieldTypes={fieldTypes}
        isLoading={isLoadingFieldTypes}
      />

      {/* Field Editor Modal */}
      <FieldEditor
        field={selectedField}
        isOpen={isEditorOpen}
        onChange={handleFieldUpdate}
        onClose={handleEditorClose}
      />
    </>
  );
};
