import { useCallback, useMemo } from 'react';
import {
  Box,
  Flex,
  Typography,
  Field,
  TextInput,
  NumberInput,
  SingleSelect,
  SingleSelectOption,
  IconButton,
  Divider,
} from '@strapi/design-system';
import { Trash } from '@strapi/icons';

import type { ValidationRule } from '../../utils/api';

interface ValidationRulesEditorProps {
  fieldType: string;
  rules: ValidationRule[];
  onChange: (rules: ValidationRule[]) => void;
}

/**
 * Available validation rules by field type
 */
const RULES_BY_TYPE: Record<string, string[]> = {
  text: ['minLength', 'maxLength', 'pattern'],
  textarea: ['minLength', 'maxLength'],
  password: ['minLength', 'maxLength', 'pattern'],
  number: ['min', 'max'],
  phone: ['pattern'],
  url: ['pattern'],
  date: ['minDate', 'maxDate'],
  time: ['minTime', 'maxTime'],
  datetime: ['minDate', 'maxDate'],
  checkbox: ['minSelected', 'maxSelected'],
  file: ['maxSize', 'allowedTypes'],
};

/**
 * Human-readable labels for each rule type
 */
const RULE_LABELS: Record<string, string> = {
  minLength: 'Minimum Length',
  maxLength: 'Maximum Length',
  pattern: 'Pattern (Regex)',
  min: 'Minimum Value',
  max: 'Maximum Value',
  minDate: 'Earliest Date',
  maxDate: 'Latest Date',
  minTime: 'Earliest Time',
  maxTime: 'Latest Time',
  minSelected: 'Min Selections',
  maxSelected: 'Max Selections',
  maxSize: 'Max File Size (MB)',
  allowedTypes: 'Allowed File Types',
};

/**
 * Placeholder values for each rule type
 */
const RULE_PLACEHOLDERS: Record<string, string> = {
  minLength: '2',
  maxLength: '100',
  pattern: '^[A-Za-z]+$',
  min: '0',
  max: '100',
  minDate: '2024-01-01',
  maxDate: '2025-12-31',
  minTime: '09:00',
  maxTime: '17:00',
  minSelected: '1',
  maxSelected: '3',
  maxSize: '5',
  allowedTypes: 'image/*,application/pdf',
};

/**
 * Help text for each rule type
 */
const RULE_HINTS: Record<string, string> = {
  minLength: 'Minimum number of characters required',
  maxLength: 'Maximum number of characters allowed',
  pattern: 'Regular expression pattern for validation',
  min: 'Minimum numeric value allowed',
  max: 'Maximum numeric value allowed',
  minDate: 'Earliest date allowed (YYYY-MM-DD)',
  maxDate: 'Latest date allowed (YYYY-MM-DD)',
  minTime: 'Earliest time allowed (HH:MM)',
  maxTime: 'Latest time allowed (HH:MM)',
  minSelected: 'Minimum number of options to select',
  maxSelected: 'Maximum number of options to select',
  maxSize: 'Maximum file size in megabytes',
  allowedTypes: 'Comma-separated MIME types or extensions',
};

/**
 * Rule types that use numeric input
 */
const NUMERIC_RULES = [
  'minLength',
  'maxLength',
  'min',
  'max',
  'minSelected',
  'maxSelected',
  'maxSize',
];

/**
 * ValidationRulesEditor component for configuring field validation rules
 * Provides UI for adding, editing, and removing validation rules based on field type
 */
export const ValidationRulesEditor = ({
  fieldType,
  rules,
  onChange,
}: ValidationRulesEditorProps) => {
  // Get available rules for this field type
  const availableRules = useMemo(() => RULES_BY_TYPE[fieldType] || [], [fieldType]);

  // Get rules that haven't been added yet
  const unusedRules = useMemo(
    () => availableRules.filter((ruleType) => !rules.some((r) => r.type === ruleType)),
    [availableRules, rules]
  );

  // Add a new validation rule
  const handleAddRule = useCallback(
    (type: string | number) => {
      if (!type || typeof type !== 'string') return;

      const newRule: ValidationRule = {
        type,
        value: undefined,
        message: '',
      };
      onChange([...rules, newRule]);
    },
    [rules, onChange]
  );

  // Update a validation rule
  const handleUpdateRule = useCallback(
    (index: number, updates: Partial<ValidationRule>) => {
      const newRules = [...rules];
      newRules[index] = { ...newRules[index], ...updates };
      onChange(newRules);
    },
    [rules, onChange]
  );

  // Remove a validation rule
  const handleRemoveRule = useCallback(
    (index: number) => {
      const newRules = [...rules];
      newRules.splice(index, 1);
      onChange(newRules);
    },
    [rules, onChange]
  );

  // Don't render if no rules available for this field type
  if (availableRules.length === 0) {
    return null;
  }

  return (
    <Box>
      <Divider />
      <Box marginTop={4}>
        <Flex justifyContent="space-between" alignItems="center" marginBottom={3}>
          <Typography variant="sigma" textColor="neutral600" textTransform="uppercase">
            Validation Rules
          </Typography>
        </Flex>

        {/* Existing rules */}
        {rules.length > 0 && (
          <Flex direction="column" gap={3} marginBottom={3}>
            {rules.map((rule, index) => (
              <Box key={`${rule.type}-${index}`} padding={3} background="neutral100" hasRadius>
                <Flex justifyContent="space-between" alignItems="flex-start" marginBottom={3}>
                  <Typography fontWeight="bold">{RULE_LABELS[rule.type] || rule.type}</Typography>
                  <IconButton
                    label="Remove rule"
                    onClick={() => handleRemoveRule(index)}
                    variant="ghost"
                  >
                    <Trash />
                  </IconButton>
                </Flex>

                <Flex direction="column" gap={3}>
                  {/* Value input */}
                  <Field.Root name={`rule-${index}-value`}>
                    <Field.Label>Value</Field.Label>
                    {NUMERIC_RULES.includes(rule.type) ? (
                      <NumberInput
                        value={Number(rule.value) || 0}
                        onValueChange={(value: number | undefined) =>
                          handleUpdateRule(index, { value })
                        }
                        placeholder={RULE_PLACEHOLDERS[rule.type]}
                      />
                    ) : (
                      <TextInput
                        value={(rule.value as string) || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleUpdateRule(index, { value: e.target.value })
                        }
                        placeholder={RULE_PLACEHOLDERS[rule.type]}
                      />
                    )}
                    {RULE_HINTS[rule.type] && <Field.Hint>{RULE_HINTS[rule.type]}</Field.Hint>}
                  </Field.Root>

                  {/* Error message */}
                  <Field.Root name={`rule-${index}-message`}>
                    <Field.Label>Error Message</Field.Label>
                    <TextInput
                      value={rule.message || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleUpdateRule(index, { message: e.target.value })
                      }
                      placeholder="Custom error message (optional)"
                    />
                    <Field.Hint>Shown when validation fails</Field.Hint>
                  </Field.Root>
                </Flex>
              </Box>
            ))}
          </Flex>
        )}

        {/* Add rule dropdown */}
        {unusedRules.length > 0 && (
          <Box>
            <SingleSelect placeholder="Add validation rule..." value="" onChange={handleAddRule}>
              {unusedRules.map((ruleType) => (
                <SingleSelectOption key={ruleType} value={ruleType}>
                  {RULE_LABELS[ruleType] || ruleType}
                </SingleSelectOption>
              ))}
            </SingleSelect>
          </Box>
        )}

        {/* Empty state hint */}
        {rules.length === 0 && (
          <Box marginTop={2}>
            <Typography variant="pi" textColor="neutral500">
              Add validation rules to enforce input requirements
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
