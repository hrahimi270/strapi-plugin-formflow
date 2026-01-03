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
} from '@strapi/design-system';

import type { FormSettings as FormSettingsType, SpamSettings } from '../../utils/api';

interface FormSettingsProps {
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
const getDefaultSpamSettings = (): SpamSettings => ({
  honeypot: true,
  honeypotFieldName: '_gotcha',
});

/**
 * FormSettings component for configuring form-level settings
 * Includes submission settings, button configuration, form layout, and spam protection
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
  // Update a single setting property
  const updateSetting = useCallback(
    <K extends keyof FormSettingsType>(key: K, value: FormSettingsType[K]) => {
      onSettingsChange({ ...settings, [key]: value });
    },
    [settings, onSettingsChange]
  );

  // Update spam protection settings
  const updateSpamSetting = useCallback(
    <K extends keyof SpamSettings>(key: K, value: SpamSettings[K]) => {
      const currentSpam = settings.spam || getDefaultSpamSettings();
      onSettingsChange({
        ...settings,
        spam: { ...currentSpam, [key]: value },
      });
    },
    [settings, onSettingsChange]
  );

  // Get current spam settings with defaults
  const spamSettings = settings.spam || getDefaultSpamSettings();

  return (
    <Box padding={6} background="neutral0" hasRadius shadow="tableShadow" borderColor="neutral150">
      <Flex direction="column" gap={6}>
        {/* Submission Settings Section */}
        <Box>
          <Box marginBottom={4}>
            <Typography variant="delta" fontWeight="bold">
              Submission Settings
            </Typography>
          </Box>

          <Flex direction="column" gap={4} width="100%">
            {/* Success Message */}
            <Box width="100%">
              <Field.Root name="successMessage">
                <Field.Label>Success Message</Field.Label>
                <Textarea
                  placeholder="Thank you for your submission!"
                  value={successMessage}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    onSuccessMessageChange(e.target.value)
                  }
                />
                <Field.Hint>Message displayed to users after successful form submission</Field.Hint>
              </Field.Root>
            </Box>

            {/* Redirect URL */}
            <Box width="100%">
              <Field.Root name="redirectUrl">
                <Field.Label>Redirect URL (Optional)</Field.Label>
                <TextInput
                  placeholder="https://example.com/thank-you"
                  value={redirectUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onRedirectUrlChange(e.target.value)
                  }
                />
                <Field.Hint>
                  Redirect users to this URL after submission instead of showing the success message
                </Field.Hint>
              </Field.Root>
            </Box>
          </Flex>
        </Box>

        <Divider />

        {/* Button Settings Section */}
        <Box>
          <Box marginBottom={4}>
            <Typography variant="delta" fontWeight="bold">
              Button Settings
            </Typography>
          </Box>

          <Flex direction="column" gap={4} width="100%">
            <Flex gap={6} width="100%">
              {/* Submit Button Text */}
              <Box flex="1">
                <Field.Root name="submitButtonText">
                  <Field.Label>Submit Button Text</Field.Label>
                  <TextInput
                    placeholder="Submit"
                    value={settings.submitButtonText || 'Submit'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateSetting('submitButtonText', e.target.value)
                    }
                  />
                </Field.Root>
              </Box>

              {/* Reset Button Text - Only shown when reset button is enabled */}
              {showResetButton && (
                <Box flex="1">
                  <Field.Root name="resetButtonText">
                    <Field.Label>Reset Button Text</Field.Label>
                    <TextInput
                      placeholder="Reset"
                      value={settings.resetButtonText || 'Reset'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateSetting('resetButtonText', e.target.value)
                      }
                    />
                  </Field.Root>
                </Box>
              )}
            </Flex>

            {/* Show Reset Button Checkbox */}
            <Checkbox checked={showResetButton} onCheckedChange={onShowResetButtonChange}>
              Show reset button alongside submit button
            </Checkbox>
          </Flex>
        </Box>

        <Divider />

        {/* Form Layout Section */}
        <Box>
          <Box marginBottom={4}>
            <Typography variant="delta" fontWeight="bold">
              Form Layout
            </Typography>
          </Box>

          <Box width="100%" style={{ maxWidth: '400px' }}>
            <Field.Root name="layout">
              <Field.Label>Form Layout</Field.Label>
              <SingleSelect
                value={settings.layout || 'single'}
                onChange={(value: string | number) =>
                  updateSetting('layout', value as 'single' | 'multi-step')
                }
              >
                <SingleSelectOption value="single">Single Page</SingleSelectOption>
                <SingleSelectOption value="multi-step">Multi-Step Wizard</SingleSelectOption>
              </SingleSelect>
              <Field.Hint>
                {settings.layout === 'multi-step'
                  ? 'Configure steps in the Form Builder tab'
                  : 'All fields displayed on a single page'}
              </Field.Hint>
            </Field.Root>
          </Box>
        </Box>

        <Divider />

        {/* Spam Protection Section */}
        <Box>
          <Box marginBottom={4}>
            <Typography variant="delta" fontWeight="bold">
              Spam Protection
            </Typography>
          </Box>

          <Flex direction="column" gap={4} width="100%">
            {/* Honeypot Toggle */}
            <Flex gap={6} width="100%" alignItems="flex-start">
              <Box flex="1">
                <Checkbox
                  checked={spamSettings.honeypot}
                  onCheckedChange={(checked: boolean) => updateSpamSetting('honeypot', checked)}
                >
                  Enable honeypot field
                </Checkbox>
                <Box marginTop={1}>
                  <Typography variant="pi" textColor="neutral600">
                    Adds a hidden field to catch automated spam bots
                  </Typography>
                </Box>
              </Box>

              {/* Honeypot Field Name - Only shown when honeypot is enabled */}
              {spamSettings.honeypot && (
                <Box flex="1">
                  <Field.Root name="honeypotFieldName">
                    <Field.Label>Honeypot Field Name</Field.Label>
                    <TextInput
                      placeholder="_gotcha"
                      value={spamSettings.honeypotFieldName || '_gotcha'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateSpamSetting('honeypotFieldName', e.target.value)
                      }
                    />
                    <Field.Hint>Name of the hidden honeypot field</Field.Hint>
                  </Field.Root>
                </Box>
              )}
            </Flex>

            {/* Note about future features */}
            <Box padding={4} background="neutral100" hasRadius width="100%">
              <Typography variant="pi" textColor="neutral600">
                <strong>Note:</strong> Additional spam protection options like reCAPTCHA
                integration will be available in a future update. Honeypot protection provides
                effective basic bot filtering without affecting user experience.
              </Typography>
            </Box>
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
};
