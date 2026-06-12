import { Textarea, Field } from '@strapi/design-system';

interface FormTextareaFieldProps {
  required: boolean;
  name: string;
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  placeholder: string;
  hint: string;
}

const FormTextareaField = ({
  required,
  name,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: FormTextareaFieldProps) => {
  return (
    <Field.Root name={name} hint={hint} required={required}>
      <Field.Label>{label}</Field.Label>
      <Textarea value={value} onChange={onChange} placeholder={placeholder} />
      <Field.Hint />
    </Field.Root>
  );
};

export default FormTextareaField;
