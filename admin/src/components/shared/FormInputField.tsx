import React from 'react';
import { Field } from '@strapi/design-system';

interface FormInputFieldProps {
  disabled?: boolean;
  required: boolean;
  name: string;
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
  hint: string;
}

const FormInputField = ({
  disabled = false,
  required,
  name,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: FormInputFieldProps) => {
  return (
    <Field.Root name={name} required={required} hint={hint}>
      <Field.Label>{label}</Field.Label>
      <Field.Input
        disabled={disabled}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <Field.Hint />
    </Field.Root>
  );
};

export default FormInputField;
