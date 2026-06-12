import {
  Box,
  Flex,
  Typography,
  Field,
  TextInput,
  Textarea,
  SingleSelect,
  SingleSelectOption,
  Checkbox,
  Radio,
  Toggle,
  DatePicker,
  TimePicker,
  DateTimePicker,
  Divider,
} from '@strapi/design-system';

import type { FormField } from '../../utils/api';

/**
 * Props for {@link FieldPreview}. Exported because the component is consumed by
 * the builder/editor and the Strapi plugin build emits type definitions for it.
 */
export interface FieldPreviewProps {
  field: FormField;
}

/**
 * Renders the field label + required marker as a native Field.Label.
 */
const PreviewLabel = ({ field }: FieldPreviewProps) => (
  <Field.Label>
    {field.label}
    {field.required ? ' *' : ''}
  </Field.Label>
);

/**
 * FieldPreview renders a realistic, read-only (disabled) preview of a form
 * field using the actual Strapi design-system input that the public form would
 * render. Layout fields (heading/paragraph/divider) render their display
 * representation instead of an input.
 */
export const FieldPreview = ({ field }: FieldPreviewProps) => {
  const placeholder = field.placeholder || '';
  const defaultValue = typeof field.defaultValue === 'string' ? field.defaultValue : '';

  // Layout elements have no input; render their visual representation
  if (field.type === 'heading') {
    const level = (field.attributes?.level as string) || 'h2';
    const variant =
      level === 'h1' ? 'alpha' : level === 'h2' ? 'beta' : level === 'h3' ? 'delta' : 'epsilon';
    return (
      <Typography variant={variant} fontWeight="bold" tag={level as 'h1' | 'h2' | 'h3' | 'h4'}>
        {field.label}
      </Typography>
    );
  }

  if (field.type === 'paragraph') {
    return (
      <Typography textColor="neutral700">
        {(field.attributes?.content as string) || field.label}
      </Typography>
    );
  }

  if (field.type === 'divider') {
    return <Divider />;
  }

  // Hidden fields are not rendered to end users; show a muted note
  if (field.type === 'hidden') {
    return (
      <Field.Root name={field.name}>
        <PreviewLabel field={field} />
        <Box
          padding={2}
          paddingLeft={3}
          paddingRight={3}
          background="neutral100"
          hasRadius
          borderColor="neutral200"
          borderStyle="dashed"
          borderWidth="1px"
        >
          <Typography variant="pi" textColor="neutral500">
            Hidden field{defaultValue ? ` = ${defaultValue}` : ''}
          </Typography>
        </Box>
      </Field.Root>
    );
  }

  // Choice fields
  if (field.type === 'select') {
    return (
      <Field.Root name={field.name} hint={field.description || undefined}>
        <PreviewLabel field={field} />
        <SingleSelect placeholder={placeholder || 'Select...'} value="" disabled>
          {(field.options || []).map((opt) => (
            <SingleSelectOption key={opt.value} value={opt.value}>
              {opt.label}
            </SingleSelectOption>
          ))}
        </SingleSelect>
        {field.description ? <Field.Hint /> : null}
      </Field.Root>
    );
  }

  if (field.type === 'radio') {
    return (
      <Field.Root name={field.name} hint={field.description || undefined}>
        <PreviewLabel field={field} />
        <Radio.Group aria-label={field.label}>
          <Flex direction="column" alignItems="flex-start" gap={2} paddingTop={1}>
            {(field.options || []).map((opt) => (
              <Radio.Item key={opt.value} value={opt.value} disabled>
                {opt.label}
              </Radio.Item>
            ))}
          </Flex>
        </Radio.Group>
        {field.description ? <Field.Hint /> : null}
      </Field.Root>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <Field.Root name={field.name} hint={field.description || undefined}>
        <PreviewLabel field={field} />
        <Flex direction="column" alignItems="flex-start" gap={2} paddingTop={1}>
          {(field.options || []).map((opt) => (
            <Checkbox key={opt.value} checked={false} disabled>
              {opt.label}
            </Checkbox>
          ))}
        </Flex>
        {field.description ? <Field.Hint /> : null}
      </Field.Root>
    );
  }

  if (field.type === 'boolean') {
    return (
      <Field.Root name={field.name} hint={field.description || undefined}>
        <PreviewLabel field={field} />
        <Box>
          <Toggle onLabel="Yes" offLabel="No" checked={false} disabled aria-label={field.label} />
        </Box>
        {field.description ? <Field.Hint /> : null}
      </Field.Root>
    );
  }

  // Date / time fields
  if (field.type === 'date') {
    return (
      <Field.Root name={field.name} hint={field.description || undefined}>
        <PreviewLabel field={field} />
        <DatePicker placeholder={placeholder || 'Pick a date'} disabled />
        {field.description ? <Field.Hint /> : null}
      </Field.Root>
    );
  }

  if (field.type === 'time') {
    return (
      <Field.Root name={field.name} hint={field.description || undefined}>
        <PreviewLabel field={field} />
        <TimePicker disabled />
        {field.description ? <Field.Hint /> : null}
      </Field.Root>
    );
  }

  if (field.type === 'datetime') {
    return (
      <Field.Root name={field.name} hint={field.description || undefined}>
        <PreviewLabel field={field} />
        <DateTimePicker placeholder={placeholder || 'Pick date & time'} disabled />
        {field.description ? <Field.Hint /> : null}
      </Field.Root>
    );
  }

  // Textarea
  if (field.type === 'textarea') {
    return (
      <Field.Root name={field.name} hint={field.description || undefined}>
        <PreviewLabel field={field} />
        <Textarea placeholder={placeholder} value={defaultValue} disabled readOnly />
        {field.description ? <Field.Hint /> : null}
      </Field.Root>
    );
  }

  // File
  if (field.type === 'file') {
    return (
      <Field.Root name={field.name} hint={field.description || undefined}>
        <PreviewLabel field={field} />
        <Box
          padding={4}
          background="neutral100"
          hasRadius
          borderColor="neutral200"
          borderStyle="dashed"
          borderWidth="1px"
          textAlign="center"
        >
          <Typography variant="pi" textColor="neutral500">
            {placeholder || 'Click or drop a file to upload'}
          </Typography>
        </Box>
        {field.description ? <Field.Hint /> : null}
      </Field.Root>
    );
  }

  // Default: text-like inputs (text, email, number, phone, url, password)
  const inputType =
    field.type === 'number'
      ? 'number'
      : field.type === 'email'
        ? 'email'
        : field.type === 'password'
          ? 'password'
          : field.type === 'url'
            ? 'url'
            : field.type === 'phone'
              ? 'tel'
              : 'text';

  return (
    <Field.Root name={field.name} hint={field.description || undefined}>
      <PreviewLabel field={field} />
      <TextInput
        type={inputType}
        placeholder={placeholder}
        value={defaultValue}
        disabled
        readOnly
      />
      {field.description ? <Field.Hint /> : null}
    </Field.Root>
  );
};
