import { useCallback } from 'react';
import {
  Box,
  Flex,
  Typography,
  Field,
  Checkbox,
  NumberInput,
  Grid,
} from '@strapi/design-system';
import { useIntl } from 'react-intl';

import { getTranslation } from '../../utils/getTranslation';
import type { RateLimitConfig } from '../../utils/api';

export interface RateLimitSettingsProps {
  rateLimit: RateLimitConfig | undefined;
  onChange: (rateLimit: RateLimitConfig) => void;
}

const MINUTE_MS = 60_000;

/**
 * Default rate-limit configuration: 5 submissions per 60 minutes.
 */
const getDefaultRateLimit = (): RateLimitConfig => ({
  enabled: false,
  maxSubmissions: 5,
  windowMs: 60 * MINUTE_MS,
});

/**
 * RateLimitSettings edits per-form rate limiting.
 * The window is presented to the user in minutes but stored as `windowMs`.
 */
export const RateLimitSettings = ({ rateLimit, onChange }: RateLimitSettingsProps) => {
  const { formatMessage } = useIntl();

  const config = rateLimit ?? getDefaultRateLimit();

  const updateRateLimit = useCallback(
    <K extends keyof RateLimitConfig>(key: K, value: RateLimitConfig[K]) => {
      onChange({ ...config, [key]: value });
    },
    [config, onChange]
  );

  const windowMinutes = Math.max(1, Math.round(config.windowMs / MINUTE_MS));

  return (
    <Flex direction="column" gap={4} alignItems="stretch">
      <Flex direction="column" gap={1} alignItems="stretch">
        <Checkbox
          checked={config.enabled}
          onCheckedChange={(checked: boolean) => updateRateLimit('enabled', checked)}
        >
          {formatMessage({
            id: getTranslation('settings.rateLimit.enable'),
            defaultMessage: 'Enable rate limiting',
          })}
        </Checkbox>
        <Typography variant="pi" textColor="neutral600">
          {formatMessage({
            id: getTranslation('settings.rateLimit.hint'),
            defaultMessage:
              'Limit how many submissions a single client can send within a time window',
          })}
        </Typography>
      </Flex>

      {config.enabled && (
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
              <Field.Root name="maxSubmissions">
                <Field.Label>
                  {formatMessage({
                    id: getTranslation('settings.rateLimit.maxSubmissions.label'),
                    defaultMessage: 'Max Submissions',
                  })}
                </Field.Label>
                <NumberInput
                  value={config.maxSubmissions}
                  onValueChange={(value: number | undefined) =>
                    updateRateLimit('maxSubmissions', value && value > 0 ? value : 1)
                  }
                  min={1}
                  step={1}
                />
                <Field.Hint>
                  {formatMessage({
                    id: getTranslation('settings.rateLimit.maxSubmissions.hint'),
                    defaultMessage: 'Maximum submissions allowed per time window',
                  })}
                </Field.Hint>
              </Field.Root>
            </Grid.Item>

            <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
              <Field.Root name="windowMinutes">
                <Field.Label>
                  {formatMessage({
                    id: getTranslation('settings.rateLimit.window.label'),
                    defaultMessage: 'Time window (minutes)',
                  })}
                </Field.Label>
                <NumberInput
                  value={windowMinutes}
                  onValueChange={(value: number | undefined) =>
                    updateRateLimit('windowMs', (value && value > 0 ? value : 1) * MINUTE_MS)
                  }
                  min={1}
                  step={1}
                />
                <Field.Hint>
                  {formatMessage(
                    {
                      id: getTranslation('settings.rateLimit.window.hint'),
                      defaultMessage:
                        'Window length in minutes. Allows {max} submission(s) every {minutes} minute(s).',
                    },
                    { max: config.maxSubmissions, minutes: windowMinutes }
                  )}
                </Field.Hint>
              </Field.Root>
            </Grid.Item>
          </Grid.Root>
        </Box>
      )}
    </Flex>
  );
};

export default RateLimitSettings;
