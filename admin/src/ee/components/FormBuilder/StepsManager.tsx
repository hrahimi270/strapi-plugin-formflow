/* SPDX-License-Identifier: LicenseRef-FormFlow-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import * as React from 'react';
import { useCallback } from 'react';
import { Box, Flex, Typography, IconButton, Field, TextInput } from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { v4 as uuidv4 } from 'uuid';

import { getTranslation } from '../../../utils/getTranslation';
import { GatedButton } from '../GatedButton';
import type { FormStep, FormSettings } from '../../../utils/api';

export interface StepsManagerProps {
  steps: FormStep[];
  settings: Partial<FormSettings>;
  onSettingsChange: (settings: Partial<FormSettings>) => void;
  /** When false: renders steps read-only (Add Step + Remove + rename inputs all disabled). */
  canEdit: boolean;
}

/**
 * Multi-step (wizard) steps manager. Owns add/rename/remove of `settings.steps`;
 * the per-field step-assignment dropdown lives in FormBuilder. When `canEdit` is
 * false the existing steps stay visible but all mutation controls are disabled,
 * and "Add Step" surfaces an upsell — existing Pro config is never hidden.
 */
export const StepsManager = ({ steps, settings, onSettingsChange, canEdit }: StepsManagerProps) => {
  const { formatMessage } = useIntl();

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

  return (
    <Box background="neutral0" hasRadius shadow="tableShadow" padding={5} marginBottom={5}>
      <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
        <Typography variant="delta" fontWeight="bold">
          {formatMessage({
            id: getTranslation('builder.steps.title'),
            defaultMessage: 'Steps',
          })}
        </Typography>
        <GatedButton
          can={canEdit}
          feature="multistep"
          size="S"
          variant="secondary"
          startIcon={<Plus />}
          onClick={handleAddStep}
        >
          {formatMessage({
            id: getTranslation('builder.steps.add'),
            defaultMessage: 'Add Step',
          })}
        </GatedButton>
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
                    disabled={!canEdit}
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
                  disabled={!canEdit}
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
  );
};
