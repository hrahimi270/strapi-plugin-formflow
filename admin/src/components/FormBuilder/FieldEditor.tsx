import { Box, Flex, Typography, Button, Field, TextInput, Toggle } from '@strapi/design-system';
import { Cross } from '@strapi/icons';

import type { FormField } from '../../utils/api';

interface FieldEditorProps {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
  onClose: () => void;
}

/**
 * FieldEditor component for editing individual field properties
 * Provides form inputs for configuring field label, name, placeholder, etc.
 *
 * @todo Implement full field editor functionality in ENG-1849
 */
export const FieldEditor = ({ field, onChange, onClose }: FieldEditorProps) => {
  return (
    <Box>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
        <Typography variant="delta" fontWeight="bold">
          Edit Field
        </Typography>
        <Button variant="tertiary" onClick={onClose} startIcon={<Cross />}>
          Close
        </Button>
      </Flex>

      {/* Field Type Badge */}
      <Box marginBottom={4} padding={2} background="primary100" hasRadius display="inline-block">
        <Typography variant="pi" fontWeight="bold" textColor="primary700">
          {field.type.toUpperCase()}
        </Typography>
      </Box>

      {/* Basic Properties */}
      <Flex direction="column" gap={4}>
        {/* Label */}
        <Field.Root name="label" required>
          <Field.Label>Label</Field.Label>
          <TextInput
            value={field.label}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ label: e.target.value })
            }
            placeholder="Enter field label"
          />
          <Field.Hint>The label shown above the field</Field.Hint>
        </Field.Root>

        {/* Name */}
        <Field.Root name="name" required>
          <Field.Label>Field Name</Field.Label>
          <TextInput
            value={field.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ name: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() })
            }
            placeholder="field_name"
          />
          <Field.Hint>Used as the key in form submissions (no spaces)</Field.Hint>
        </Field.Root>

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

        {/* Description */}
        <Field.Root name="description">
          <Field.Label>Description</Field.Label>
          <TextInput
            value={field.description || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ description: e.target.value })
            }
            placeholder="Help text for users"
          />
          <Field.Hint>Additional help text shown below the field</Field.Hint>
        </Field.Root>

        {/* Required Toggle */}
        <Flex gap={2} alignItems="center">
          <Toggle
            checked={field.required}
            onCheckedChange={(checked: boolean) => onChange({ required: checked })}
          />
          <Typography>Required field</Typography>
        </Flex>

        {/* Width Selection */}
        <Field.Root name="width">
          <Field.Label>Field Width</Field.Label>
          <Flex gap={2}>
            <Button
              variant={field.width === 'full' ? 'default' : 'tertiary'}
              onClick={() => onChange({ width: 'full' })}
              size="S"
            >
              Full Width
            </Button>
            <Button
              variant={field.width === 'half' ? 'default' : 'tertiary'}
              onClick={() => onChange({ width: 'half' })}
              size="S"
            >
              Half Width
            </Button>
          </Flex>
        </Field.Root>
      </Flex>
    </Box>
  );
};
