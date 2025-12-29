import {
  Box,
  Flex,
  Grid,
  Typography,
  Field,
  TextInput,
  Textarea,
  Toggle,
} from '@strapi/design-system';

import type { FormSettings as FormSettingsType } from '../../utils/api';

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
 * Form Settings component for configuring form behavior
 * Includes submission settings, button text, and post-submission actions
 *
 * @todo Implement full settings functionality in ENG-1850
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
  return (
    <Box padding={6} background="neutral0" hasRadius shadow="tableShadow" borderColor="neutral150">
      <Flex direction="column" gap={6}>
        <Typography variant="delta" fontWeight="bold">
          Submission Settings
        </Typography>

        <Grid.Root gap={4} gridCols={12}>
          {/* Success Message */}
          <Grid.Item col={12}>
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
          </Grid.Item>

          {/* Redirect URL */}
          <Grid.Item col={12}>
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
          </Grid.Item>
        </Grid.Root>

        <Box borderColor="neutral150" borderStyle="solid" borderWidth="1px 0 0 0" paddingTop={6}>
          <Typography variant="delta" fontWeight="bold" marginBottom={4}>
            Button Settings
          </Typography>

          <Grid.Root gap={4} gridCols={12}>
            {/* Submit Button Text */}
            <Grid.Item col={6}>
              <Field.Root name="submitButtonText">
                <Field.Label>Submit Button Text</Field.Label>
                <TextInput
                  placeholder="Submit"
                  value={settings.submitButtonText || 'Submit'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onSettingsChange({ ...settings, submitButtonText: e.target.value })
                  }
                />
              </Field.Root>
            </Grid.Item>

            {/* Reset Button Text */}
            <Grid.Item col={6}>
              <Field.Root name="resetButtonText">
                <Field.Label>Reset Button Text</Field.Label>
                <TextInput
                  placeholder="Reset"
                  value={settings.resetButtonText || 'Reset'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onSettingsChange({ ...settings, resetButtonText: e.target.value })
                  }
                />
              </Field.Root>
            </Grid.Item>

            {/* Show Reset Button Toggle */}
            <Grid.Item col={12}>
              <Flex gap={2} alignItems="center">
                <Toggle checked={showResetButton} onCheckedChange={onShowResetButtonChange} />
                <Typography>Show reset button</Typography>
              </Flex>
            </Grid.Item>
          </Grid.Root>
        </Box>
      </Flex>
    </Box>
  );
};
