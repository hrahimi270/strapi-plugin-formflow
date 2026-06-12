import React, { useCallback, useMemo } from 'react';
import {
  Box,
  Flex,
  Typography,
  Button,
  Field,
  TextInput,
  Textarea,
  Checkbox,
  IconButton,
  Divider,
  SingleSelect,
  SingleSelectOption,
  Modal,
} from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';

import { ValidationRulesEditor } from './ValidationRulesEditor';
import type { FormField, FieldOption } from '../../utils/api';
import BackButton from '../../components/shared/BackButton';

export interface FieldEditorProps {
  selectedFieldType: string;
  // isEditing: boolean;
  name: string;
  fieldIcon: React.ReactNode;
  isOpen: boolean;
  field: FormField | null;
  onChange: (updates: Partial<FormField>) => void;
  onClose: () => void;
  onBack: () => void;
}

/**
 * Field types that support options (select/radio/checkbox)
 */
const CHOICE_FIELD_TYPES = ['select', 'radio', 'checkbox'];

/**
 * Layout field types that don't have input-specific properties
 */
const LAYOUT_FIELD_TYPES = ['heading', 'paragraph', 'divider'];

/**
 * Field types that support default values
 */
const DEFAULT_VALUE_FIELD_TYPES = ['text', 'textarea', 'email', 'number', 'hidden', 'url', 'phone'];

/**
 * Generates a URL-friendly field name from a label
 */
const generateFieldName = (label: string): string => {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '')
    .substring(0, 50);
};

/**
 * FieldEditor modal component for editing individual field properties
 * Provides comprehensive form inputs for configuring all field properties
 * including label, name, options (for choice fields), and validation
 */
export const FieldEditor = ({
  selectedFieldType,
  // isEditing,
  name,
  fieldIcon,
  isOpen,
  field,
  onChange,
  onClose,
  onBack,
}: FieldEditorProps) => {
  // Determine field type characteristics
  const hasOptions = useMemo(() => field && CHOICE_FIELD_TYPES.includes(field.type), [field]);
  const isLayoutField = useMemo(() => field && LAYOUT_FIELD_TYPES.includes(field.type), [field]);
  const hasDefaultValue = useMemo(
    () => field && DEFAULT_VALUE_FIELD_TYPES.includes(field.type),
    [field]
  );

  // Handle label change with auto-name generation
  const handleLabelChange = useCallback(
    (label: string) => {
      if (!field) return;
      const updates: Partial<FormField> = { label };

      // Auto-generate name if it looks auto-generated (starts with field_)
      if (field.name.startsWith('field_')) {
        const generatedName = generateFieldName(label);
        updates.name = generatedName || `field_${Date.now()}`;
      }

      onChange(updates);
    },
    [field, onChange]
  );

  // Handle name change with sanitization
  const handleNameChange = useCallback(
    (name: string) => {
      const sanitizedName = name
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 50);
      onChange({ name: sanitizedName || `field_${Date.now()}` });
    },
    [onChange]
  );

  // Options management
  const handleAddOption = useCallback(() => {
    if (!field) return;
    const options = field.options || [];
    const newOption: FieldOption = {
      label: `Option ${options.length + 1}`,
      value: `option_${options.length + 1}`,
    };
    onChange({ options: [...options, newOption] });
  }, [field, onChange]);

  const handleUpdateOption = useCallback(
    (index: number, key: keyof FieldOption, value: string) => {
      if (!field) return;
      const options = [...(field.options || [])];
      options[index] = { ...options[index], [key]: value };
      onChange({ options });
    },
    [field, onChange]
  );

  const handleRemoveOption = useCallback(
    (index: number) => {
      if (!field) return;
      const options = [...(field.options || [])];
      options.splice(index, 1);
      onChange({ options });
    },
    [field, onChange]
  );

  if (!field) return null;

  return (
    <Modal.Root open={isOpen} onOpenChange={onClose}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>
            <Flex gap="12px">
              {<BackButton action={onBack} displayText={false} />}
              {fieldIcon}
              <Typography variant="pi" fontWeight="400">
                {name}
              </Typography>
              {(
                <>
                  <Typography variant="pi" fontWeight="400" textColor="neutral500">
                    /
                  </Typography>
                  <Typography variant="pi" fontWeight="600">
                    {selectedFieldType}
                  </Typography>
                </>
              )}
            </Flex>
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Flex direction="column" gap={4}>
            {/* Label */}
            <Field.Root name="label" required>
              <Field.Label>Label</Field.Label>
              <TextInput
                value={field.label}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleLabelChange(e.target.value)
                }
                placeholder="Enter field label"
              />
              <Field.Hint>The label shown above the field</Field.Hint>
            </Field.Root>

            {/* Name (field key) */}
            <Field.Root name="name" required>
              <Field.Label>Field Name</Field.Label>
              <TextInput
                value={field.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleNameChange(e.target.value)
                }
                placeholder="field_name"
              />
              <Field.Hint>Used as the key in form submissions (lowercase, no spaces)</Field.Hint>
            </Field.Root>

            {/* Only show input-specific options for non-layout fields */}
            {!isLayoutField && (
              <>
                {/* Placeholder */}
                <Field.Root name="placeholder">
                  <Field.Label>Placeholder</Field.Label>
                  <TextInput
                    value={field.placeholder || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      onChange({ placeholder: e.target.value })
                    }
                    placeholder="Enter placeholder text"
                  />
                  <Field.Hint>Text shown when the field is empty</Field.Hint>
                </Field.Root>

                {/* Description / Help text */}
                <Field.Root name="description">
                  <Field.Label>Help Text</Field.Label>
                  <Textarea
                    value={field.description || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      onChange({ description: e.target.value })
                    }
                    placeholder="Additional help text shown below the field"
                  />
                </Field.Root>

                {/* Required and Width in same row */}
                <Flex gap={6} alignItems="flex-start">
                  <Box style={{ flex: 1 }}>
                    <Field.Root name="width">
                      <Field.Label>Field Width</Field.Label>
                      <SingleSelect
                        value={field.width || 'full'}
                        onChange={(value: string | number) =>
                          onChange({ width: value as 'full' | 'half' })
                        }
                      >
                        <SingleSelectOption value="full">Full Width (100%)</SingleSelectOption>
                        <SingleSelectOption value="half">Half Width (50%)</SingleSelectOption>
                      </SingleSelect>
                    </Field.Root>
                  </Box>
                  <Box style={{ flex: 1, paddingTop: '24px' }}>
                    <Checkbox
                      checked={field.required}
                      onCheckedChange={(checked: boolean) => onChange({ required: checked })}
                    >
                      Required field
                    </Checkbox>
                  </Box>
                </Flex>

                {/* Default Value for supported field types */}
                {hasDefaultValue && (
                  <Field.Root name="defaultValue">
                    <Field.Label>Default Value</Field.Label>
                    <TextInput
                      value={(field.defaultValue as string) || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onChange({ defaultValue: e.target.value })
                      }
                      placeholder="Default value"
                    />
                    <Field.Hint>Pre-filled value when the form loads</Field.Hint>
                  </Field.Root>
                )}

                {/* Validation Rules Editor */}
                <ValidationRulesEditor
                  fieldType={field.type}
                  rules={field.validation || []}
                  onChange={(validation) => onChange({ validation })}
                />
              </>
            )}

            {/* Options Editor for choice fields */}
            {hasOptions && (
              <>
                <Divider />
                <Box>
                  <Flex justifyContent="space-between" alignItems="center" marginBottom={3}>
                    <Typography variant="sigma" textColor="neutral600" textTransform="uppercase">
                      Options
                    </Typography>
                    <Button
                      size="S"
                      variant="secondary"
                      startIcon={<Plus />}
                      onClick={handleAddOption}
                    >
                      Add Option
                    </Button>
                  </Flex>

                  {(field.options?.length || 0) === 0 ? (
                    <Box padding={4} background="neutral100" hasRadius textAlign="center">
                      <Typography textColor="neutral600" variant="pi">
                        No options yet. Add at least one option.
                      </Typography>
                    </Box>
                  ) : (
                    <Flex direction="column" gap={2}>
                      {/* Column Headers */}
                      <Flex gap={2} paddingBottom={1}>
                        <Box flex="1">
                          <Typography variant="pi" fontWeight="bold" textColor="neutral600">
                            Label
                          </Typography>
                        </Box>
                        <Box flex="1">
                          <Typography variant="pi" fontWeight="bold" textColor="neutral600">
                            Value
                          </Typography>
                        </Box>
                        <Box width="32px" />
                      </Flex>

                      {/* Option Rows */}
                      {(field.options || []).map((option, index) => (
                        <Flex key={index} gap={2} alignItems="center">
                          <Box flex="1">
                            <TextInput
                              aria-label={`Option ${index + 1} label`}
                              value={option.label}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                handleUpdateOption(index, 'label', e.target.value)
                              }
                              placeholder="Label"
                              size="S"
                            />
                          </Box>
                          <Box flex="1">
                            <TextInput
                              aria-label={`Option ${index + 1} value`}
                              value={option.value}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                handleUpdateOption(index, 'value', e.target.value)
                              }
                              placeholder="value"
                              size="S"
                            />
                          </Box>
                          <IconButton
                            label="Remove option"
                            onClick={() => handleRemoveOption(index)}
                            disabled={(field.options?.length || 0) <= 1}
                            variant="ghost"
                            withTooltip={false}
                          >
                            <Trash />
                          </IconButton>
                        </Flex>
                      ))}
                    </Flex>
                  )}
                </Box>
              </>
            )}

            {/* Layout field specific options */}
            {isLayoutField && field.type === 'heading' && (
              <Field.Root name="headingLevel">
                <Field.Label>Heading Level</Field.Label>
                <SingleSelect
                  value={(field.attributes?.level as string) || 'h2'}
                  onChange={(value: string | number) =>
                    onChange({ attributes: { ...field.attributes, level: value } })
                  }
                >
                  <SingleSelectOption value="h1">Heading 1 (H1)</SingleSelectOption>
                  <SingleSelectOption value="h2">Heading 2 (H2)</SingleSelectOption>
                  <SingleSelectOption value="h3">Heading 3 (H3)</SingleSelectOption>
                  <SingleSelectOption value="h4">Heading 4 (H4)</SingleSelectOption>
                </SingleSelect>
              </Field.Root>
            )}

            {isLayoutField && field.type === 'paragraph' && (
              <Field.Root name="content">
                <Field.Label>Content</Field.Label>
                <Textarea
                  value={(field.attributes?.content as string) || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    onChange({ attributes: { ...field.attributes, content: e.target.value } })
                  }
                  placeholder="Enter paragraph text"
                />
              </Field.Root>
            )}
          </Flex>
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Close</Button>
          </Modal.Close>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};