/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import * as React from 'react';
import {
  Box,
  Flex,
  Typography,
  Field,
  TextInput,
  Checkbox,
  Grid,
  SingleSelect,
  SingleSelectOption,
} from '@strapi/design-system';
import { useIntl } from 'react-intl';

import { getTranslation } from '../../../utils/getTranslation';
import { LockedSection } from '../LockedSection';
import type { ConditionalRule, FormField } from '../../../utils/api';

export interface ConditionalLogicBuilderProps {
  /** The current single conditional rule (or undefined/null if no rule). */
  conditional: ConditionalRule | undefined;
  /** All fields in the form available as condition sources (layout fields excluded by caller). */
  conditionSourceFields: FormField[];
  /** Called when the rule changes. Pass undefined to remove the rule. */
  onChange: (conditional: ConditionalRule | undefined) => void;
  /** When false: renders read-only (existing rule visible, no editing). */
  canEdit: boolean;
}

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
 * Visual AND/OR-style conditional-logic builder. For Phase 1 it edits the single
 * flat {@link ConditionalRule} shape (one field/operator/value) inside a distinct
 * group container that scaffolds future multi-rule support — no new data is added
 * to the rule shape and the server engine is unchanged.
 *
 * When `canEdit` is false the existing rule stays visible but read-only (via
 * <LockedSection mode="readonly">), and the enable/disable checkbox is disabled so
 * an unlicensed user cannot remove an existing rule.
 */
export const ConditionalLogicBuilder = ({
  conditional,
  conditionSourceFields,
  onChange,
  canEdit,
}: ConditionalLogicBuilderProps) => {
  const { formatMessage } = useIntl();

  const operatorLabel = (op: ConditionalRule['operator']) =>
    formatMessage({
      id: getTranslation(`fieldEditor.conditional.operator.${op}`),
      defaultMessage: op,
    });

  const handleToggle = (enabled: boolean) => {
    if (!enabled) {
      onChange(undefined);
      return;
    }
    const firstField = conditionSourceFields[0];
    onChange({
      field: firstField ? firstField.name : '',
      operator: 'equals',
      value: '',
    });
  };

  const handleUpdate = (updates: Partial<ConditionalRule>) => {
    if (!conditional) return;
    onChange({ ...conditional, ...updates });
  };

  const needsValue = conditional && !VALUELESS_OPERATORS.includes(conditional.operator);

  return (
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
              defaultMessage: 'Add other input fields first to make this field conditional.',
            })}
          </Typography>
        </Box>
      ) : (
        <LockedSection can={canEdit} mode="readonly" feature="conditionalLogic">
          <Flex direction="column" gap={3} alignItems="stretch">
            <Checkbox
              checked={Boolean(conditional)}
              onCheckedChange={(checked: boolean) => handleToggle(checked)}
              disabled={!canEdit}
            >
              {formatMessage({
                id: getTranslation('fieldEditor.conditional.enable'),
                defaultMessage: 'Show this field conditionally',
              })}
            </Checkbox>

            {conditional && (
              <Box
                padding={3}
                background="neutral100"
                hasRadius
                borderColor="neutral200"
                borderStyle="solid"
                borderWidth="1px"
              >
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
                        value={conditional.field}
                        onChange={(value: string | number) =>
                          handleUpdate({ field: String(value) })
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
                        value={conditional.operator}
                        onChange={(value: string | number) => {
                          const operator = value as ConditionalRule['operator'];
                          // Valueless operators (is_empty/is_not_empty) don't use a
                          // value, so clear any stale value in the same update.
                          handleUpdate({
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
                        value={(conditional.value as string) || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleUpdate({ value: e.target.value })
                        }
                        disabled={!needsValue}
                        placeholder={needsValue ? 'Value' : 'N/A'}
                      />
                    </Field.Root>
                  </Grid.Item>
                </Grid.Root>
              </Box>
            )}
          </Flex>
        </LockedSection>
      )}
    </Box>
  );
};
