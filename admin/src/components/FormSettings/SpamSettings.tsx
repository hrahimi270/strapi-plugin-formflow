import { useCallback } from 'react';
import {
  Box,
  Flex,
  Typography,
  Field,
  TextInput,
  Checkbox,
  SingleSelect,
  SingleSelectOption,
  NumberInput,
  Grid,
} from '@strapi/design-system';
import { useIntl } from 'react-intl';

import { getTranslation } from '../../utils/getTranslation';
import type { SpamSettings as SpamSettingsType, RecaptchaConfig } from '../../utils/api';

export interface SpamSettingsProps {
  spam: SpamSettingsType;
  onChange: (spam: SpamSettingsType) => void;
}

/**
 * Default reCAPTCHA configuration used when the user first enables it.
 */
const getDefaultRecaptcha = (): RecaptchaConfig => ({
  enabled: false,
  siteKey: '',
  secretKey: '',
  version: 'v2',
  threshold: 0.5,
});

/**
 * SpamSettings configures honeypot + Google reCAPTCHA protection.
 * Bound to `settings.spam` via the parent's `onSettingsChange`.
 */
export const SpamSettings = ({ spam, onChange }: SpamSettingsProps) => {
  const { formatMessage } = useIntl();

  const updateSpam = useCallback(
    <K extends keyof SpamSettingsType>(key: K, value: SpamSettingsType[K]) => {
      onChange({ ...spam, [key]: value });
    },
    [spam, onChange]
  );

  const recaptcha = spam.recaptcha ?? getDefaultRecaptcha();

  const updateRecaptcha = useCallback(
    <K extends keyof RecaptchaConfig>(key: K, value: RecaptchaConfig[K]) => {
      onChange({ ...spam, recaptcha: { ...recaptcha, [key]: value } });
    },
    [spam, recaptcha, onChange]
  );

  return (
    <Flex direction="column" gap={4} alignItems="stretch">
      {/* Honeypot */}
      <Flex direction="column" gap={1} alignItems="stretch">
        <Checkbox
          checked={spam.honeypot}
          onCheckedChange={(checked: boolean) => updateSpam('honeypot', checked)}
        >
          {formatMessage({
            id: getTranslation('settings.spam.honeypot.label'),
            defaultMessage: 'Enable honeypot field',
          })}
        </Checkbox>
        <Typography variant="pi" textColor="neutral600">
          {formatMessage({
            id: getTranslation('settings.spam.honeypot.hint'),
            defaultMessage: 'Adds a hidden field to catch automated spam bots',
          })}
        </Typography>
      </Flex>

      {spam.honeypot && (
        <Box maxWidth="40rem">
          <Field.Root name="honeypotFieldName">
            <Field.Label>
              {formatMessage({
                id: getTranslation('settings.spam.honeypotFieldName.label'),
                defaultMessage: 'Honeypot field name',
              })}
            </Field.Label>
            <TextInput
              placeholder="_gotcha"
              value={spam.honeypotFieldName || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSpam('honeypotFieldName', e.target.value)
              }
            />
            <Field.Hint>
              {formatMessage({
                id: getTranslation('settings.spam.honeypotFieldName.hint'),
                defaultMessage: 'Name of the hidden honeypot field',
              })}
            </Field.Hint>
          </Field.Root>
        </Box>
      )}

      {/* reCAPTCHA */}
      <Flex direction="column" gap={1} alignItems="stretch">
        <Checkbox
          checked={recaptcha.enabled}
          onCheckedChange={(checked: boolean) => updateRecaptcha('enabled', checked)}
        >
          {formatMessage({
            id: getTranslation('settings.spam.recaptcha.enable'),
            defaultMessage: 'Enable Google reCAPTCHA',
          })}
        </Checkbox>
        <Typography variant="pi" textColor="neutral600">
          {formatMessage({
            id: getTranslation('settings.spam.recaptcha.hint'),
            defaultMessage: 'Protect this form with Google reCAPTCHA bot verification',
          })}
        </Typography>
      </Flex>

      {recaptcha.enabled && (
        <Box
          padding={4}
          background="neutral100"
          hasRadius
          borderColor="neutral200"
          borderStyle="solid"
          borderWidth="1px"
        >
          <Grid.Root gap={4} gridCols={12}>
            <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
              <Field.Root name="recaptchaVersion">
                <Field.Label>
                  {formatMessage({
                    id: getTranslation('settings.spam.recaptcha.version.label'),
                    defaultMessage: 'Version',
                  })}
                </Field.Label>
                <SingleSelect
                  value={recaptcha.version}
                  onChange={(value: string | number) =>
                    updateRecaptcha('version', value as 'v2' | 'v3')
                  }
                >
                  <SingleSelectOption value="v2">
                    {formatMessage({
                      id: getTranslation('settings.spam.recaptcha.version.v2'),
                      defaultMessage: 'v2',
                    })}
                  </SingleSelectOption>
                  <SingleSelectOption value="v3">
                    {formatMessage({
                      id: getTranslation('settings.spam.recaptcha.version.v3'),
                      defaultMessage: 'v3',
                    })}
                  </SingleSelectOption>
                </SingleSelect>
              </Field.Root>
            </Grid.Item>

            {recaptcha.version === 'v3' && (
              <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                <Field.Root name="recaptchaThreshold">
                  <Field.Label>
                    {formatMessage({
                      id: getTranslation('settings.spam.recaptcha.threshold.label'),
                      defaultMessage: 'Threshold (v3)',
                    })}
                  </Field.Label>
                  <NumberInput
                    value={recaptcha.threshold ?? 0.5}
                    onValueChange={(value: number | undefined) =>
                      updateRecaptcha('threshold', value ?? 0.5)
                    }
                    step={0.1}
                    min={0}
                    max={1}
                  />
                  <Field.Hint>
                    {formatMessage({
                      id: getTranslation('settings.spam.recaptcha.threshold.hint'),
                      defaultMessage:
                        'Minimum score (0.0 - 1.0) required to accept a submission',
                    })}
                  </Field.Hint>
                </Field.Root>
              </Grid.Item>
            )}

            <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
              <Field.Root name="recaptchaSiteKey">
                <Field.Label>
                  {formatMessage({
                    id: getTranslation('settings.spam.recaptcha.siteKey.label'),
                    defaultMessage: 'Site key',
                  })}
                </Field.Label>
                <TextInput
                  value={recaptcha.siteKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateRecaptcha('siteKey', e.target.value)
                  }
                  placeholder="6Lc..."
                />
                <Field.Hint>
                  {formatMessage({
                    id: getTranslation('settings.spam.recaptcha.siteKey.hint'),
                    defaultMessage: 'Public key embedded in the form on the frontend',
                  })}
                </Field.Hint>
              </Field.Root>
            </Grid.Item>

            <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
              <Field.Root name="recaptchaSecretKey">
                <Field.Label>
                  {formatMessage({
                    id: getTranslation('settings.spam.recaptcha.secretKey.label'),
                    defaultMessage: 'Secret key',
                  })}
                </Field.Label>
                <TextInput
                  type="password"
                  value={recaptcha.secretKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateRecaptcha('secretKey', e.target.value)
                  }
                  placeholder="6Lc..."
                  autoComplete="new-password"
                />
                <Field.Hint>
                  {formatMessage({
                    id: getTranslation('settings.spam.recaptcha.secretKey.hint'),
                    defaultMessage:
                      'Stored server-side and never exposed publicly. Used to verify tokens with Google.',
                  })}
                </Field.Hint>
              </Field.Root>
            </Grid.Item>
          </Grid.Root>
        </Box>
      )}
    </Flex>
  );
};

export default SpamSettings;
