import * as React from 'react';
import { useCallback, useMemo } from 'react';
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
  Grid,
  Badge,
  Modal,
} from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import { useIntl } from 'react-intl';

import { getTranslation } from '../../utils/getTranslation';
import { ValidationRulesEditor } from './ValidationRulesEditor';
import { FieldPreview } from './FieldPreview';
import type { FormField, FieldOption, ConditionalRule } from '../../utils/api';

export interface FieldEditorProps {
  field: FormField | null;
  /** All fields in the form, used to populate the conditional-logic selector. */
  allFields: FormField[];
  isOpen: boolean;
  onChange: (updates: Partial<FormField>) => void;
  onClose: () => void;
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
 * Conditional operators that do not require a value input.
 */
const VALUELESS_OPERATORS: ConditionalRule['operator'][] = ['is_empty', 'is_not_empty'];

const CONDITIONAL_OPERATORS: ConditionalRule['operator'][] = [
  'equals',
  'not_equals',
  'contains',
  'is_empty',
  'is_not_empty',
];

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
 * FieldEditor modal component for editing individual field properties.
 * Provides inputs for label, name, placeholder, default value, width, options
 * (choice fields), validation rules, and conditional display logic, plus a live
 * read-only preview of the field.
 */
export const FieldEditor = ({ field, allFields, isOpen, onChange, onClose }: FieldEditorProps) => {
  const { formatMessage } = useIntl();

  // Determine field type characteristics
  const hasOptions = useMemo(() => field && CHOICE_FIELD_TYPES.includes(field.type), [field]);
  const isLayoutField = useMemo(() => field && LAYOUT_FIELD_TYPES.includes(field.type), [field]);
  const hasDefaultValue = useMemo(
    () => field && DEFAULT_VALUE_FIELD_TYPES.includes(field.type),
    [field]
  );

  // Other fields (excluding self and layout-only fields) usable as conditions.
  const conditionSourceFields = useMemo(
    () =>
      allFields.filter(
        (f) => f.id !== field?.id && !LAYOUT_FIELD_TYPES.includes(f.type)
      ),
    [allFields, field]
  );

  // Handle label change with auto-name generation
  const handleLabelChange = useCallback(
    (label: string) => {
      if (!field) return;
      const updates: Partial<FormField> = { label };
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

  // Conditional logic management
  const handleToggleConditional = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        onChange({ conditional: undefined });
        return;
      }
      const firstField = conditionSourceFields[0];
      onChange({
        conditional: {
          field: firstField ? firstField.name : '',
          operator: 'equals',
          value: '',
        },
      });
    },
    [conditionSourceFields, onChange]
  );

  const handleUpdateConditional = useCallback(
    (updates: Partial<ConditionalRule>) => {
      if (!field?.conditional) return;
      onChange({ conditional: { ...field.conditional, ...updates } });
    },
    [field, onChange]
  );

  // Handle modal open state change
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  if (!field) return null;

  const operatorLabel = (op: ConditionalRule['operator']) =>
    formatMessage({
      id: getTranslation(`fieldEditor.conditional.operator.${op}`),
      defaultMessage: op,
    });

  const conditionalNeedsValue =
    field.conditional && !VALUELESS_OPERATORS.includes(field.conditional.operator);

  return (
    <Modal.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Content>
        <Modal.Header>
          <Flex gap={3} alignItems="center">
            <Modal.Title>
              {formatMessage({
                id: getTranslation('fieldEditor.title'),
                defaultMessage: 'Edit Field',
              })}
            </Modal.Title>
            <Badge>{field.type.toUpperCase()}</Badge>
          </Flex>
        </Modal.Header>

        <Modal.Body>
          <Flex direction="column" gap={4} alignItems="stretch">
            {/* Live preview */}
            <Box
              padding={4}
              background="neutral100"
              hasRadius
              borderColor="neutral200"
              borderStyle="solid"
              borderWidth="1px"
            >
              <Box marginBottom={2}>
                <Typography variant="sigma" textColor="neutral600" textTransform="uppercase">
                  {formatMessage({
                    id: getTranslation('builder.preview'),
                    defaultMessage: 'Preview',
                  })}
                </Typography>
              </Box>
              <FieldPreview field={field} />
            </Box>

            {/* Label */}
            <Field.Root
              name="label"
              required
              hint={formatMessage({
                id: getTranslation('fieldEditor.label.hint'),
                defaultMessage: 'The label shown above the field',
              })}
            >
              <Field.Label>
                {formatMessage({
                  id: getTranslation('fieldEditor.label.label'),
                  defaultMessage: 'Label',
                })}
              </Field.Label>
              <TextInput
                value={field.label}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleLabelChange(e.target.value)
                }
                placeholder={formatMessage({
                  id: getTranslation('fieldEditor.label.placeholder'),
                  defaultMessage: 'Field label',
                })}
              />
              <Field.Hint />
            </Field.Root>

            {/* Name (field key) */}
            <Field.Root
              name="name"
              required
              hint={formatMessage({
                id: getTranslation('fieldEditor.name.hint'),
                defaultMessage: 'Used as the key in submission data',
              })}
            >
              <Field.Label>
                {formatMessage({
                  id: getTranslation('fieldEditor.name.label'),
                  defaultMessage: 'Name',
                })}
              </Field.Label>
              <TextInput
                value={field.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleNameChange(e.target.value)
                }
                placeholder={formatMessage({
                  id: getTranslation('fieldEditor.name.placeholder'),
                  defaultMessage: 'field_name',
                })}
              />
              <Field.Hint />
            </Field.Root>

            {/* Input-specific options for non-layout fields */}
            {!isLayoutField && (
              <>
                <Field.Root name="placeholder">
                  <Field.Label>
                    {formatMessage({
                      id: getTranslation('fieldEditor.placeholder.label'),
                      defaultMessage: 'Placeholder',
                    })}
                  </Field.Label>
                  <TextInput
                    value={field.placeholder || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      onChange({ placeholder: e.target.value })
                    }
                    placeholder={formatMessage({
                      id: getTranslation('fieldEditor.placeholder.placeholder'),
                      defaultMessage: 'Placeholder text',
                    })}
                  />
                </Field.Root>

                <Field.Root name="description">
                  <Field.Label>
                    {formatMessage({
                      id: getTranslation('fieldEditor.description.label'),
                      defaultMessage: 'Help Text',
                    })}
                  </Field.Label>
                  <Textarea
                    value={field.description || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      onChange({ description: e.target.value })
                    }
                    placeholder={formatMessage({
                      id: getTranslation('fieldEditor.description.placeholder'),
                      defaultMessage: 'Help text shown below the field',
                    })}
                  />
                </Field.Root>

                {/* Width + Required */}
                <Grid.Root gap={5} gridCols={12}>
                  <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                    <Field.Root name="width">
                      <Field.Label>
                        {formatMessage({
                          id: getTranslation('fieldEditor.width.label'),
                          defaultMessage: 'Width',
                        })}
                      </Field.Label>
                      <SingleSelect
                        value={field.width || 'full'}
                        onChange={(value: string | number) =>
                          onChange({ width: value as 'full' | 'half' })
                        }
                      >
                        <SingleSelectOption value="full">
                          {formatMessage({
                            id: getTranslation('fieldEditor.width.full'),
                            defaultMessage: 'Full width',
                          })}
                        </SingleSelectOption>
                        <SingleSelectOption value="half">
                          {formatMessage({
                            id: getTranslation('fieldEditor.width.half'),
                            defaultMessage: 'Half width',
                          })}
                        </SingleSelectOption>
                      </SingleSelect>
                    </Field.Root>
                  </Grid.Item>
                  <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                    <Field.Root name="required">
                      <Field.Label>
                        {formatMessage({
                          id: getTranslation('fieldEditor.required.label'),
                          defaultMessage: 'Required',
                        })}
                      </Field.Label>
                      <Flex height="3.2rem" alignItems="center">
                        <Checkbox
                          checked={field.required}
                          onCheckedChange={(checked: boolean) => onChange({ required: checked })}
                        >
                          {formatMessage({
                            id: getTranslation('fieldEditor.required.hint'),
                            defaultMessage: 'Users must fill in this field',
                          })}
                        </Checkbox>
                      </Flex>
                    </Field.Root>
                  </Grid.Item>
                </Grid.Root>

                {/* Default Value */}
                {hasDefaultValue && (
                  <Field.Root name="defaultValue">
                    <Field.Label>
                      {formatMessage({
                        id: getTranslation('fieldEditor.defaultValue.label'),
                        defaultMessage: 'Default Value',
                      })}
                    </Field.Label>
                    <TextInput
                      value={(field.defaultValue as string) || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onChange({ defaultValue: e.target.value })
                      }
                      placeholder={formatMessage({
                        id: getTranslation('fieldEditor.defaultValue.label'),
                        defaultMessage: 'Default Value',
                      })}
                    />
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
                      {formatMessage({
                        id: getTranslation('fieldEditor.options.title'),
                        defaultMessage: 'Options',
                      })}
                    </Typography>
                    <Button
                      size="S"
                      variant="secondary"
                      startIcon={<Plus />}
                      onClick={handleAddOption}
                    >
                      {formatMessage({
                        id: getTranslation('fieldEditor.options.add'),
                        defaultMessage: 'Add option',
                      })}
                    </Button>
                  </Flex>

                  {(field.options?.length || 0) === 0 ? (
                    <Box padding={4} background="neutral100" hasRadius textAlign="center">
                      <Typography textColor="neutral600" variant="pi">
                        {formatMessage({
                          id: getTranslation('fieldEditor.options.empty'),
                          defaultMessage: 'No options added yet',
                        })}
                      </Typography>
                    </Box>
                  ) : (
                    <Flex direction="column" gap={2} alignItems="stretch">
                      <Flex gap={2} paddingBottom={1}>
                        <Box flex="1">
                          <Typography variant="pi" fontWeight="bold" textColor="neutral600">
                            {formatMessage({
                              id: getTranslation('fieldEditor.options.label'),
                              defaultMessage: 'Label',
                            })}
                          </Typography>
                        </Box>
                        <Box flex="1">
                          <Typography variant="pi" fontWeight="bold" textColor="neutral600">
                            {formatMessage({
                              id: getTranslation('fieldEditor.options.value'),
                              defaultMessage: 'Value',
                            })}
                          </Typography>
                        </Box>
                        <Box width="32px" />
                      </Flex>

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
                            label={formatMessage({
                              id: getTranslation('fieldEditor.options.remove'),
                              defaultMessage: 'Remove option',
                            })}
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

            {/* Conditional Logic (non-layout fields only) */}
            {!isLayoutField && (
              <>
                <Divider />
                <Box>
                  <Box marginBottom={3}>
                    <Typography variant="sigma" textColor="neutral600" textTransform="uppercase">
                      {formatMessage({
                        id: getTranslation('fieldEditor.conditional.title'),
                        defaultMessage: 'Conditional Logic',
                      })}
                    </Typography>
                  </Box>

                  {conditionSourceFields.length === 0 ? (
                    <Box padding={3} background="neutral100" hasRadius>
                      <Typography variant="pi" textColor="neutral600">
                        {formatMessage({
                          id: getTranslation('fieldEditor.conditional.noFields'),
                          defaultMessage:
                            'Add other input fields first to make this field conditional.',
                        })}
                      </Typography>
                    </Box>
                  ) : (
                    <Flex direction="column" gap={3} alignItems="stretch">
                      <Checkbox
                        checked={Boolean(field.conditional)}
                        onCheckedChange={(checked: boolean) => handleToggleConditional(checked)}
                      >
                        {formatMessage({
                          id: getTranslation('fieldEditor.conditional.enable'),
                          defaultMessage: 'Show this field conditionally',
                        })}
                      </Checkbox>

                      {field.conditional && (
                        <Grid.Root gap={3} gridCols={12}>
                          <Grid.Item col={4} xs={12} direction="column" alignItems="stretch">
                            <Field.Root name="conditional-field">
                              <Field.Label>
                                {formatMessage({
                                  id: getTranslation('fieldEditor.conditional.field'),
                                  defaultMessage: 'When field',
                                })}
                              </Field.Label>
                              <SingleSelect
                                value={field.conditional.field}
                                onChange={(value: string | number) =>
                                  handleUpdateConditional({ field: String(value) })
                                }
                              >
                                {conditionSourceFields.map((f) => (
                                  <SingleSelectOption key={f.id} value={f.name}>
                                    {f.label || f.name}
                                  </SingleSelectOption>
                                ))}
                              </SingleSelect>
                            </Field.Root>
                          </Grid.Item>

                          <Grid.Item col={4} xs={12} direction="column" alignItems="stretch">
                            <Field.Root name="conditional-operator">
                              <Field.Label>
                                {formatMessage({
                                  id: getTranslation('fieldEditor.conditional.operator'),
                                  defaultMessage: 'Operator',
                                })}
                              </Field.Label>
                              <SingleSelect
                                value={field.conditional.operator}
                                onChange={(value: string | number) => {
                                  const operator = value as ConditionalRule['operator'];
                                  // Valueless operators (is_empty/is_not_empty) don't use a
                                  // value, so clear any stale value in the same update.
                                  handleUpdateConditional({
                                    operator,
                                    ...(VALUELESS_OPERATORS.includes(operator)
                                      ? { value: undefined }
                                      : {}),
                                  });
                                }}
                              >
                                {CONDITIONAL_OPERATORS.map((op) => (
                                  <SingleSelectOption key={op} value={op}>
                                    {operatorLabel(op)}
                                  </SingleSelectOption>
                                ))}
                              </SingleSelect>
                            </Field.Root>
                          </Grid.Item>

                          <Grid.Item col={4} xs={12} direction="column" alignItems="stretch">
                            <Field.Root name="conditional-value">
                              <Field.Label>
                                {formatMessage({
                                  id: getTranslation('fieldEditor.conditional.value'),
                                  defaultMessage: 'Value',
                                })}
                              </Field.Label>
                              <TextInput
                                value={(field.conditional.value as string) || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  handleUpdateConditional({ value: e.target.value })
                                }
                                disabled={!conditionalNeedsValue}
                                placeholder={conditionalNeedsValue ? 'Value' : 'N/A'}
                              />
                            </Field.Root>
                          </Grid.Item>
                        </Grid.Root>
                      )}
                    </Flex>
                  )}
                </Box>
              </>
            )}
          </Flex>
        </Modal.Body>

        <Modal.Footer>
          {/* Edits apply live via onChange, so this is a close-only action. */}
          <Modal.Close>
            <Button>
              {formatMessage({
                id: getTranslation('common.done'),
                defaultMessage: 'Done',
              })}
            </Button>
          </Modal.Close>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};
