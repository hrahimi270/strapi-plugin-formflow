import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Flex,
  Typography,
  Modal,
  Button,
  Tabs,
  EmptyStateLayout,
  Divider,
} from '@strapi/design-system';
import { Trash, Pencil, Drag, Files, Plus } from '@strapi/icons';
import { v4 as uuidv4 } from 'uuid';
import { useFieldTypes } from '../../hooks';
import { FieldTypeSelector } from './FieldTypeSelector';
import { FieldEditor } from './FieldEditor';
import type { FormField } from '../../utils/api';
import AddMoreButton from '../shared/AddMoreButton';
import TooltipIconButton from '../shared/TooltipIconButton';
import FieldTypeIcon from '../shared/FieldTypeIcon';

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
  const { fieldTypes, isLoading: isLoadingFieldTypes, fieldTypesByCategory } = useFieldTypes();
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
        <Box borderColor="neutral200" width="100%" hasRadius overflow="hidden">
          {sortedFields.length === 0 ? (
            <>
              <EmptyStateLayout
                action={
                  <Button
                    onClick={handleAddFieldClick}
                    variant="secondary" // color scheme
                    height="3.2rem"
                    startIcon={<Plus color="#271fe0" />}
                  >
                    Add new field
                  </Button>
                }
                content="No fields yet"
                icon={<Files color="#7b79ff" width={96} height="auto" />}
              />
            </>
          ) : (
            <>
              {sortedFields.map((field, index) => {
                const fieldActions = [
                  {
                    label: 'Edit field',
                    icon: <Pencil />,
                    handler: () => handleFieldEdit(field.id),
                  },
                  {
                    label: 'Delete field',
                    icon: <Trash />,
                    handler: () => handleFieldDelete(field.id),
                  },
                ];

                return (
                  <Flex
                    key={field.id}
                    title="Drag/Move field"
                    draggable
                    onDragStart={(e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, index)}
                    onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    // background="#fbfbfb"
                    background="white"
                    borderColor={index === sortedFields.length - 1 ? 'transparent' : 'neutral150'}
                    borderWidth="0px 0px 1px 0px"
                    justifyContent="space-between"
                    padding="16px"
                    cursor="grab"
                    width={field.width === 'half' ? 'calc(50% - 6px)' : '100%'}
                    // opacity={draggedIndex === index ? 0.5 : 1}
                    style={{
                      opacity: draggedIndex === index ? 0.5 : 1,
                    }}
                  >
                    <Flex gap="8px">
                      <TooltipIconButton label="Drag/Move field" cursor="move">
                        <Drag />
                      </TooltipIconButton>
                      <Flex gap="16px">
                        <FieldTypeIcon index={index} fiedlType={field.type} />
                        <Flex>
                          <Typography fontWeight="bold" ellipsis>
                            {field.label}
                          </Typography>
                          {field.required && (
                            <Typography
                              fontSize="1.4rem"
                              fontWeight="600"
                              variant="pi"
                              textColor="danger600"
                            >
                              *
                            </Typography>
                          )}
                        </Flex>
                      </Flex>
                    </Flex>

                    <Flex gap="4px">
                      {fieldActions.map((fieldAction, index) => (
                        <TooltipIconButton
                          key={index}
                          label={fieldAction.label}
                          onClick={(event: MouseEvent) => {
                            event.stopPropagation();
                            fieldAction.handler();
                          }}
                        >
                          {fieldAction.icon}
                        </TooltipIconButton>
                      ))}
                    </Flex>
                  </Flex>
                );
              })}

              <Modal.Root>
                <Modal.Trigger>
                  <AddMoreButton text="Add another field to this form" />
                </Modal.Trigger>
                <Modal.Content>
                  <Modal.Header>
                    <Modal.Title>Some Title</Modal.Title>
                  </Modal.Header>
                  <Modal.Body>
                    <Tabs.Root variant="simple" defaultValue={Object.keys(fieldTypesByCategory)[0]}>
                      <Flex justifyContent="space-between">
                        <Typography variant="beta" tag="h2">
                          Select the category
                        </Typography>
                        <Tabs.List>
                          {Object.keys(fieldTypesByCategory).map((category) => (
                            <Tabs.Trigger value={category}>{category}</Tabs.Trigger>
                          ))}
                        </Tabs.List>
                      </Flex>
                      <Divider marginBottom="24px" />
                      {Object.entries(fieldTypesByCategory).map(([category, items]) => (
                        <Tabs.Content key={category} value={category}>
                          <Flex gap="12px" wrap="wrap">
                            {items.map((item) => (
                              <Flex
                                borderColor="primary200"
                                hasRadius
                                gap="16px"
                                padding="16px"
                                variant="secondary"
                                width="calc(calc(100% - 12px) / 2)"
                                key={item.type}
                                // onClick={() => handleItemClick(item)}
                              >
                                <FieldTypeIcon fiedlType={item.type} />
                                <Flex direction="column" flex="1">
                                  <Typography width="100%" variant="omega" textColor="neutral800">
                                    {item.label}
                                  </Typography>
                                  <Typography width="100%" variant="pi" textColor="neutral600">
                                    {item.label} Description
                                  </Typography>
                                </Flex>
                              </Flex>
                            ))}
                          </Flex>
                        </Tabs.Content>
                      ))}
                    </Tabs.Root>
                  </Modal.Body>
                  {/* <Modal.Footer justifyContent="flex-end">
                    <Modal.Close onClick={handleSelectorClose}>
                      <Button>Confirm</Button>
                    </Modal.Close>
                  </Modal.Footer> */}
                </Modal.Content>
              </Modal.Root>

              {/* <AddMoreButton onClick={handleAddFieldClick} text="Add another field to this form" /> */}
            </>
          )}
        </Box>
      </Flex>

      {/* Field Type Selector Modal */}
      {/* <FieldTypeSelector
        onSelect={handleFieldTypeSelect}
        fieldTypes={fieldTypes}
        isLoading={isLoadingFieldTypes}
      /> */}

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
