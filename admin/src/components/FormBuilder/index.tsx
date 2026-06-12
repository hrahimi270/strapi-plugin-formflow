import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Flex,
  Grid,
  Typography,
  Button,
  IconButton,
  Badge,
  Divider,
  Field,
  TextInput,
  SingleSelect,
  SingleSelectOption,
} from '@strapi/design-system';
import { Plus, Trash, Pencil, Drag, Duplicate } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { v4 as uuidv4 } from 'uuid';
import styled from 'styled-components';

import { getTranslation } from '../../utils/getTranslation';
import { useFieldTypes } from '../../hooks';
import { FieldTypeSelector } from './FieldTypeSelector';
import { FieldEditor } from './FieldEditor';
import { FieldPreview } from './FieldPreview';
import type { FormField, FormSettings, FormStep } from '../../utils/api';

export interface FormBuilderProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  /** Form settings (used for the multi-step steps manager). */
  settings: Partial<FormSettings>;
  /** Update the form settings (used to read/write `settings.steps`). */
  onSettingsChange: (settings: Partial<FormSettings>) => void;
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
 * Draggable field card with a visible drop indicator. Uses styled-components so
 * the drag affordance / drop-target highlight actually render (design-system
 * Box cannot express `:hover`/cursor for these states).
 */
const FieldCard = styled(Box)<{ $dragging: boolean; $dropTarget: boolean }>`
  cursor: default;
  opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
  border: 1px solid
    ${({ theme, $dropTarget }) => ($dropTarget ? theme.colors.primary600 : theme.colors.neutral200)};
  box-shadow: ${({ theme, $dropTarget }) =>
    $dropTarget ? `${theme.colors.primary600} 0px 0px 0px 1px` : 'none'};
  transition:
    border-color 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out,
    opacity 0.12s ease-in-out;
`;

const DragHandle = styled(Flex)`
  cursor: grab;
  color: ${({ theme }) => theme.colors.neutral500};

  &:active {
    cursor: grabbing;
  }

  svg path {
    fill: ${({ theme }) => theme.colors.neutral500};
  }
`;

/**
 * FormBuilder component - core form building interface.
 * Renders fields in a 12-column responsive grid respecting their width,
 * supports drag-to-reorder (commit on drop) with a visible drop indicator, and
 * provides a multi-step steps manager when the form layout is multi-step.
 */
export const FormBuilder = ({ fields, onChange, settings, onSettingsChange }: FormBuilderProps) => {
  const { formatMessage } = useIntl();
  const { fieldTypes, isLoading: isLoadingFieldTypes } = useFieldTypes();
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const isMultiStep = settings.layout === 'multi-step';
  const steps = useMemo<FormStep[]>(() => settings.steps || [], [settings.steps]);

  const sortedFields = useMemo(() => {
    return [...fields].sort((a, b) => a.order - b.order);
  }, [fields]);

  const selectedField = useMemo(() => {
    return fields.find((f) => f.id === selectedFieldId) || null;
  }, [fields, selectedFieldId]);

  // ----- Field CRUD -----
  const handleAddFieldClick = useCallback(() => setIsSelectorOpen(true), []);
  const handleSelectorClose = useCallback(() => setIsSelectorOpen(false), []);

  const handleFieldTypeSelect = useCallback(
    (type: string) => {
      const newField = createNewField(type, fields.length);
      onChange([...fields, newField]);
      setSelectedFieldId(newField.id);
      setIsEditorOpen(true);
    },
    [fields, onChange]
  );

  const handleFieldEdit = useCallback((fieldId: string) => {
    setSelectedFieldId(fieldId);
    setIsEditorOpen(true);
  }, []);

  const handleFieldUpdate = useCallback(
    (updates: Partial<FormField>) => {
      if (!selectedFieldId) return;
      onChange(fields.map((f) => (f.id === selectedFieldId ? { ...f, ...updates } : f)));
    },
    [fields, onChange, selectedFieldId]
  );

  const handleFieldDuplicate = useCallback(
    (fieldId: string) => {
      const original = fields.find((f) => f.id === fieldId);
      if (!original) return;
      const copy: FormField = {
        ...original,
        id: uuidv4(),
        name: `${original.name}_copy`,
        label: `${original.label} (copy)`,
        order: fields.length,
        conditional: original.conditional ? { ...original.conditional } : undefined,
      };
      onChange([...fields, copy]);
    },
    [fields, onChange]
  );

  const handleFieldDelete = useCallback(
    (fieldId: string) => {
      const target = fields.find((f) => f.id === fieldId);
      onChange(
        fields.filter((f) => f.id !== fieldId).map((f, index) => ({ ...f, order: index }))
      );
      // Also unassign the field from any multi-step step.
      if (target && steps.length > 0) {
        onSettingsChange({
          ...settings,
          steps: steps.map((s) => ({
            ...s,
            fields: s.fields.filter((n) => n !== target.name),
          })),
        });
      }
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
        setIsEditorOpen(false);
      }
    },
    [fields, onChange, selectedFieldId, steps, settings, onSettingsChange]
  );

  const handleEditorClose = useCallback(() => {
    setIsEditorOpen(false);
    setSelectedFieldId(null);
  }, []);

  // ----- Drag & drop (commit on drop, not on every dragOver) -----
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedIndex !== null && index !== dropIndex) {
        setDropIndex(index);
      }
    },
    [draggedIndex, dropIndex]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) {
        setDraggedIndex(null);
        setDropIndex(null);
        return;
      }
      const newFields = [...sortedFields];
      const [moved] = newFields.splice(draggedIndex, 1);
      newFields.splice(index, 0, moved);
      onChange(newFields.map((f, i) => ({ ...f, order: i })));
      setDraggedIndex(null);
      setDropIndex(null);
    },
    [draggedIndex, sortedFields, onChange]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDropIndex(null);
  }, []);

  // ----- Multi-step steps manager -----
  const handleAddStep = useCallback(() => {
    const newStep: FormStep = {
      id: uuidv4(),
      title: `Step ${steps.length + 1}`,
      fields: [],
    };
    onSettingsChange({ ...settings, steps: [...steps, newStep] });
  }, [steps, settings, onSettingsChange]);

  const handleRenameStep = useCallback(
    (stepId: string, title: string) => {
      onSettingsChange({
        ...settings,
        steps: steps.map((s) => (s.id === stepId ? { ...s, title } : s)),
      });
    },
    [steps, settings, onSettingsChange]
  );

  const handleRemoveStep = useCallback(
    (stepId: string) => {
      onSettingsChange({ ...settings, steps: steps.filter((s) => s.id !== stepId) });
    },
    [steps, settings, onSettingsChange]
  );

  const handleAssignFieldToStep = useCallback(
    (fieldName: string, stepId: string | null) => {
      const nextSteps = steps.map((s) => ({
        ...s,
        // remove the field from every step first
        fields: s.fields.filter((n) => n !== fieldName),
      }));
      if (stepId) {
        const target = nextSteps.find((s) => s.id === stepId);
        if (target) target.fields = [...target.fields, fieldName];
      }
      onSettingsChange({ ...settings, steps: nextSteps });
    },
    [steps, settings, onSettingsChange]
  );

  const stepIdForField = useCallback(
    (fieldName: string): string => {
      const step = steps.find((s) => s.fields.includes(fieldName));
      return step ? step.id : '';
    },
    [steps]
  );

  return (
    <>
      {/* Multi-step manager */}
      {isMultiStep && (
        <Box
          background="neutral0"
          hasRadius
          shadow="tableShadow"
          padding={5}
          marginBottom={5}
        >
          <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
            <Typography variant="delta" fontWeight="bold">
              {formatMessage({
                id: getTranslation('builder.steps.title'),
                defaultMessage: 'Steps',
              })}
            </Typography>
            <Button size="S" variant="secondary" startIcon={<Plus />} onClick={handleAddStep}>
              {formatMessage({
                id: getTranslation('builder.steps.add'),
                defaultMessage: 'Add Step',
              })}
            </Button>
          </Flex>

          {steps.length === 0 ? (
            <Box padding={4} background="neutral100" hasRadius textAlign="center">
              <Typography variant="pi" textColor="neutral600">
                {formatMessage({
                  id: getTranslation('builder.steps.empty'),
                  defaultMessage: 'No steps yet. Add a step to group your fields.',
                })}
              </Typography>
            </Box>
          ) : (
            <Flex direction="column" gap={3} alignItems="stretch">
              {steps.map((step, index) => (
                <Flex key={step.id} gap={2} alignItems="flex-end">
                  <Box flex="1">
                    <Field.Root name={`step-${step.id}`}>
                      <Field.Label>
                        {formatMessage(
                          {
                            id: getTranslation('builder.steps.stepLabel'),
                            defaultMessage: 'Step {number}',
                          },
                          { number: index + 1 }
                        )}
                      </Field.Label>
                      <TextInput
                        value={step.title}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleRenameStep(step.id, e.target.value)
                        }
                        placeholder="Step title"
                      />
                    </Field.Root>
                  </Box>
                  <Box>
                    <IconButton
                      label={formatMessage({
                        id: getTranslation('builder.steps.remove'),
                        defaultMessage: 'Remove step',
                      })}
                      variant="ghost"
                      onClick={() => handleRemoveStep(step.id)}
                      withTooltip={false}
                    >
                      <Trash />
                    </IconButton>
                  </Box>
                </Flex>
              ))}
            </Flex>
          )}
        </Box>
      )}

      {/* Fields builder */}
      <Box background="neutral0" hasRadius shadow="tableShadow" padding={5}>
        <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
          <Box>
            <Typography variant="delta" fontWeight="bold">
              {formatMessage({
                id: getTranslation('builder.title'),
                defaultMessage: 'Form Fields',
              })}
            </Typography>
            <Typography variant="pi" textColor="neutral600">
              {formatMessage({
                id: getTranslation('builder.subtitle'),
                defaultMessage: 'Add and configure the fields for your form',
              })}
            </Typography>
          </Box>
          <Button size="S" startIcon={<Plus />} onClick={handleAddFieldClick}>
            {formatMessage({
              id: getTranslation('builder.addField'),
              defaultMessage: 'Add Field',
            })}
          </Button>
        </Flex>

        {sortedFields.length === 0 ? (
          <Box padding={8} textAlign="center" background="neutral100" hasRadius>
            <Flex direction="column" gap={2} alignItems="center">
              <Typography textColor="neutral600" fontWeight="bold">
                {formatMessage({
                  id: getTranslation('builder.empty.title'),
                  defaultMessage: 'No fields yet',
                })}
              </Typography>
              <Typography textColor="neutral500" variant="pi">
                {formatMessage({
                  id: getTranslation('builder.empty.description'),
                  defaultMessage: 'Add your first field to start building the form',
                })}
              </Typography>
            </Flex>
          </Box>
        ) : (
          <>
            <Grid.Root gap={3} gridCols={12}>
              {sortedFields.map((field, index) => (
                <Grid.Item
                  key={field.id}
                  col={field.width === 'half' ? 6 : 12}
                  xs={12}
                  direction="column"
                  alignItems="stretch"
                >
                  <FieldCard
                    draggable
                    onDragStart={(e: React.DragEvent<HTMLDivElement>) =>
                      handleDragStart(e, index)
                    }
                    onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleDragOver(e, index)}
                    onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    padding={4}
                    background="neutral0"
                    hasRadius
                    $dragging={draggedIndex === index}
                    $dropTarget={dropIndex === index && draggedIndex !== index}
                  >
                    <Flex justifyContent="space-between" alignItems="flex-start" gap={3}>
                      <Flex gap={3} alignItems="flex-start" flex={1} overflow="hidden">
                        <DragHandle
                          alignItems="center"
                          paddingTop={1}
                          aria-label={formatMessage({
                            id: getTranslation('builder.field.move'),
                            defaultMessage: 'Drag to reorder',
                          })}
                        >
                          <Drag />
                        </DragHandle>
                        <Box flex={1} overflow="hidden">
                          <Flex gap={2} marginBottom={2} wrap="wrap">
                            <Badge>{field.type}</Badge>
                            {field.required && (
                              <Badge backgroundColor="danger100" textColor="danger700">
                                {formatMessage({
                                  id: getTranslation('builder.field.required'),
                                  defaultMessage: 'Required',
                                })}
                              </Badge>
                            )}
                            <Badge backgroundColor="neutral150" textColor="neutral700">
                              {field.width === 'half' ? '50%' : '100%'}
                            </Badge>
                            {field.conditional && (
                              <Badge backgroundColor="secondary100" textColor="secondary700">
                                {formatMessage({
                                  id: getTranslation('builder.field.conditional'),
                                  defaultMessage: 'Conditional',
                                })}
                              </Badge>
                            )}
                          </Flex>
                          {/* Realistic field preview */}
                          <FieldPreview field={field} />
                        </Box>
                      </Flex>
                      <Flex gap={1} shrink={0}>
                        <IconButton
                          label={formatMessage({
                            id: getTranslation('builder.field.edit'),
                            defaultMessage: 'Edit field',
                          })}
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
                          label={formatMessage({
                            id: getTranslation('builder.field.duplicate'),
                            defaultMessage: 'Duplicate field',
                          })}
                          variant="ghost"
                          withTooltip={false}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleFieldDuplicate(field.id);
                          }}
                        >
                          <Duplicate />
                        </IconButton>
                        <IconButton
                          label={formatMessage({
                            id: getTranslation('builder.field.delete'),
                            defaultMessage: 'Delete field',
                          })}
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

                    {/* Per-field step assignment (multi-step only) */}
                    {isMultiStep && steps.length > 0 && (
                      <>
                        <Box marginTop={3} marginBottom={3}>
                          <Divider />
                        </Box>
                        <Field.Root name={`field-step-${field.id}`}>
                          <Field.Label>
                            {formatMessage({
                              id: getTranslation('builder.steps.assign'),
                              defaultMessage: 'Step',
                            })}
                          </Field.Label>
                          <SingleSelect
                            value={stepIdForField(field.name)}
                            onChange={(value: string | number) =>
                              handleAssignFieldToStep(field.name, value ? String(value) : null)
                            }
                          >
                            <SingleSelectOption value="">
                              {formatMessage({
                                id: getTranslation('builder.steps.unassigned'),
                                defaultMessage: 'Unassigned',
                              })}
                            </SingleSelectOption>
                            {steps.map((s) => (
                              <SingleSelectOption key={s.id} value={s.id}>
                                {s.title}
                              </SingleSelectOption>
                            ))}
                          </SingleSelect>
                        </Field.Root>
                      </>
                    )}
                  </FieldCard>
                </Grid.Item>
              ))}
            </Grid.Root>

            <Box marginTop={4} textAlign="center">
              <Typography textColor="neutral600" variant="pi">
                {formatMessage(
                  {
                    id: getTranslation('builder.fieldCount'),
                    defaultMessage:
                      '{count} {count, plural, one {field} other {fields}} configured',
                  },
                  { count: sortedFields.length }
                )}
              </Typography>
            </Box>
          </>
        )}
      </Box>

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
        allFields={fields}
        isOpen={isEditorOpen}
        onChange={handleFieldUpdate}
        onClose={handleEditorClose}
      />
    </>
  );
};
