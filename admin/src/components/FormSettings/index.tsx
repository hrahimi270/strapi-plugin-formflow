import { useCallback } from 'react';
import {
  Box,
  Flex,
  Typography,
  Field,
  TextInput,
  Textarea,
  Checkbox,
  SingleSelect,
  SingleSelectOption,
  Divider,
  Grid,
} from '@strapi/design-system';
import { useIntl } from 'react-intl';

import { getTranslation } from '../../utils/getTranslation';
import type {
  FormSettings as FormSettingsType,
  SpamSettings as SpamSettingsType,
  RateLimitConfig,
} from '../../utils/api';
import { SpamSettings } from './SpamSettings';
import { RateLimitSettings } from './RateLimitSettings';

export interface FormSettingsProps {
  settings: Partial<FormSettingsType>;
  successMessage: string;
  redirectUrl: string;
  showResetButton: boolean;
  onSettingsChange: (settings: Partial<FormSettingsType>) => void;
  onSuccessMessageChange: (value: string) => void;
  onRedirectUrlChange: (value: string) => void;
  onShowResetButtonChange: (value: boolean) => void;
}

/**
 * Default spam protection settings
 */
const getDefaultSpamSettings = (): SpamSettingsType => ({
  honeypot: true,
  honeypotFieldName: '_gotcha',
});

/**
 * A titled settings section rendered inside a native card container.
 */
const SettingsSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Box>
    <Box marginBottom={4}>
      <Typography variant="delta" fontWeight="bold">
        {title}
      </Typography>
    </Box>
    {children}
  </Box>
);

/**
 * FormSettings component for configuring form-level settings.
 * Includes submission settings, button configuration, form layout,
 * spam protection (honeypot + reCAPTCHA) and rate limiting.
 */
export const FormSettings = ({
  settings,
  successMessage,
  redirectUrl,
  showResetButton,
  onSettingsChange,
  onSuccessMessageChange,
  onRedirectUrlChange,
  onShowResetButtonChange,
}: FormSettingsProps) => {
  const { formatMessage } = useIntl();

  // Update a single setting property
  const updateSetting = useCallback(
    <K extends keyof FormSettingsType>(key: K, value: FormSettingsType[K]) => {
      onSettingsChange({ ...settings, [key]: value });
    },
    [settings, onSettingsChange]
  );

  // Update spam protection settings
  const handleSpamChange = useCallback(
    (spam: SpamSettingsType) => {
      onSettingsChange({ ...settings, spam });
    },
    [settings, onSettingsChange]
  );

  // Update rate-limit settings
  const handleRateLimitChange = useCallback(
    (rateLimit: RateLimitConfig) => {
      onSettingsChange({ ...settings, rateLimit });
    },
    [settings, onSettingsChange]
  );

  const spamSettings = settings.spam || getDefaultSpamSettings();

  return (
    <Box padding={6} background="neutral0" hasRadius shadow="tableShadow" borderColor="neutral150">
      <Flex direction="column" gap={6} alignItems="stretch">
        {/* Submission Settings Section */}
        <SettingsSection
          title={formatMessage({
            id: getTranslation('settings.general.title'),
            defaultMessage: 'Submission Settings',
          })}
        >
          <Flex direction="column" gap={4} alignItems="stretch">
            {/* Success Message */}
            <Field.Root
              name="successMessage"
              hint={formatMessage({
                id: getTranslation('settings.successMessage.hint'),
                defaultMessage: 'Shown to the user after a successful submission',
              })}
            >
              <Field.Label>
                {formatMessage({
                  id: getTranslation('settings.successMessage.label'),
                  defaultMessage: 'Success Message',
                })}
              </Field.Label>
              <Textarea
                placeholder={formatMessage({
                  id: getTranslation('settings.successMessage.placeholder'),
                  defaultMessage: 'Thank you for your submission!',
                })}
                value={successMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  onSuccessMessageChange(e.target.value)
                }
              />
              <Field.Hint />
            </Field.Root>

            {/* Redirect URL */}
            <Field.Root
              name="redirectUrl"
              hint={formatMessage({
                id: getTranslation('settings.redirectUrl.hint'),
                defaultMessage: 'Redirect the user to this URL after submission',
              })}
            >
              <Field.Label>
                {formatMessage({
                  id: getTranslation('settings.redirectUrl.label'),
                  defaultMessage: 'Redirect URL (Optional)',
                })}
              </Field.Label>
              <TextInput
                placeholder={formatMessage({
                  id: getTranslation('settings.redirectUrl.placeholder'),
                  defaultMessage: 'https://example.com/thank-you',
                })}
                value={redirectUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onRedirectUrlChange(e.target.value)
                }
              />
              <Field.Hint />
            </Field.Root>
          </Flex>
        </SettingsSection>

        <Divider />

        {/* Button Settings Section */}
        <SettingsSection
          title={formatMessage({
            id: getTranslation('settings.buttons.title'),
            defaultMessage: 'Button Settings',
          })}
        >
          <Flex direction="column" gap={4} alignItems="stretch">
            <Grid.Root gap={6} gridCols={12}>
              {/* Submit Button Text */}
              <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                <Field.Root name="submitButtonText">
                  <Field.Label>
                    {formatMessage({
                      id: getTranslation('settings.submitButton.label'),
                      defaultMessage: 'Submit Button Text',
                    })}
                  </Field.Label>
                  <TextInput
                    placeholder={formatMessage({
                      id: getTranslation('settings.submitButton.placeholder'),
                      defaultMessage: 'Submit',
                    })}
                    value={settings.submitButtonText || 'Submit'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateSetting('submitButtonText', e.target.value)
                    }
                  />
                </Field.Root>
              </Grid.Item>

              {/* Reset Button Text - Only shown when reset button is enabled */}
              {showResetButton && (
                <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                  <Field.Root name="resetButtonText">
                    <Field.Label>
                      {formatMessage({
                        id: getTranslation('settings.resetButton.label'),
                        defaultMessage: 'Reset Button Text',
                      })}
                    </Field.Label>
                    <TextInput
                      placeholder={formatMessage({
                        id: getTranslation('settings.resetButton.placeholder'),
                        defaultMessage: 'Reset',
                      })}
                      value={settings.resetButtonText || 'Reset'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateSetting('resetButtonText', e.target.value)
                      }
                    />
                  </Field.Root>
                </Grid.Item>
              )}
            </Grid.Root>

            {/* Show Reset Button Checkbox */}
            <Checkbox checked={showResetButton} onCheckedChange={onShowResetButtonChange}>
              {formatMessage({
                id: getTranslation('settings.showResetButton.label'),
                defaultMessage: 'Show reset button alongside submit button',
              })}
            </Checkbox>
          </Flex>
        </SettingsSection>

        <Divider />

        {/* Form Layout Section */}
        <SettingsSection
          title={formatMessage({
            id: getTranslation('settings.layout.title'),
            defaultMessage: 'Form Layout',
          })}
        >
          <Box maxWidth="40rem">
            <Field.Root
              name="layout"
              hint={
                settings.layout === 'multi-step'
                  ? formatMessage({
                      id: getTranslation('settings.layout.multiStep.hint'),
                      defaultMessage: 'Configure steps in the Form Builder tab',
                    })
                  : formatMessage({
                      id: getTranslation('settings.layout.single.hint'),
                      defaultMessage: 'All fields displayed on a single page',
                    })
              }
            >
              <Field.Label>
                {formatMessage({
                  id: getTranslation('settings.layout.label'),
                  defaultMessage: 'Layout',
                })}
              </Field.Label>
              <SingleSelect
                value={settings.layout || 'single'}
                onChange={(value: string | number) =>
                  updateSetting('layout', value as 'single' | 'multi-step')
                }
              >
                <SingleSelectOption value="single">
                  {formatMessage({
                    id: getTranslation('settings.layout.single'),
                    defaultMessage: 'Single page',
                  })}
                </SingleSelectOption>
                <SingleSelectOption value="multi-step">
                  {formatMessage({
                    id: getTranslation('settings.layout.multiStep'),
                    defaultMessage: 'Multi-step',
                  })}
                </SingleSelectOption>
              </SingleSelect>
              <Field.Hint />
            </Field.Root>
          </Box>
        </SettingsSection>

        <Divider />

        {/* Spam Protection Section */}
        <SettingsSection
          title={formatMessage({
            id: getTranslation('settings.spam.title'),
            defaultMessage: 'Spam Protection',
          })}
        >
          <SpamSettings spam={spamSettings} onChange={handleSpamChange} />
        </SettingsSection>

        <Divider />

        {/* Rate Limiting Section */}
        <SettingsSection
          title={formatMessage({
            id: getTranslation('settings.rateLimit.title'),
            defaultMessage: 'Rate Limiting',
          })}
        >
          <RateLimitSettings rateLimit={settings.rateLimit} onChange={handleRateLimitChange} />
        </SettingsSection>
      </Flex>
    </Box>
  );
};

export default FormSettings;
