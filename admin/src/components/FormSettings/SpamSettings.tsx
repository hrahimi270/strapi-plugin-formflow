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
  NumberInput,
  Grid,
} from '@strapi/design-system';
import { useIntl } from 'react-intl';

import { getTranslation } from '../../utils/getTranslation';
import type {
  SpamSettings as SpamSettingsType,
  RecaptchaConfig,
  TurnstileConfig,
  HcaptchaConfig,
  IpBlocklistConfig,
} from '../../utils/api';
import { useLicense } from '../../ee/hooks/useLicense';
import { LockedSection } from '../../ee/components/LockedSection';
import { ProBadge } from '../../ee/components/ProBadge';

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

/** Default Cloudflare Turnstile configuration used when first enabled. */
const getDefaultTurnstile = (): TurnstileConfig => ({ enabled: false, siteKey: '', secretKey: '' });

/** Default hCaptcha configuration used when first enabled. */
const getDefaultHcaptcha = (): HcaptchaConfig => ({ enabled: false, siteKey: '', secretKey: '' });

/** Default IP blocklist configuration used when first enabled. */
const getDefaultIpBlocklist = (): IpBlocklistConfig => ({ ips: [], countryCodes: [] });

/** Render the stored IP list as the newline-separated textarea value. */
const ipsToText = (ips?: string[]): string => (ips ?? []).join('\n');

/** Parse a textarea value into a clean string[] (split on newline/comma, trim, drop empties). */
const textToIps = (text: string): string[] =>
  text
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

/**
 * SpamSettings configures honeypot + Google reCAPTCHA protection.
 * Bound to `settings.spam` via the parent's `onSettingsChange`.
 */
export const SpamSettings = ({ spam, onChange }: SpamSettingsProps) => {
  const { formatMessage } = useIntl();
  const { can } = useLicense();
  const v3Entitled = can('spam.recaptchaV3');
  const turnstileEntitled = can('spam.turnstile');
  const hcaptchaEntitled = can('spam.hcaptcha');
  const ipBlocklistEntitled = can('spam.ipBlocklist');

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

  const turnstile = spam.turnstile ?? getDefaultTurnstile();

  const updateTurnstile = useCallback(
    <K extends keyof TurnstileConfig>(key: K, value: TurnstileConfig[K]) => {
      onChange({ ...spam, turnstile: { ...turnstile, [key]: value } });
    },
    [spam, turnstile, onChange]
  );

  const hcaptcha = spam.hcaptcha ?? getDefaultHcaptcha();

  const updateHcaptcha = useCallback(
    <K extends keyof HcaptchaConfig>(key: K, value: HcaptchaConfig[K]) => {
      onChange({ ...spam, hcaptcha: { ...hcaptcha, [key]: value } });
    },
    [spam, hcaptcha, onChange]
  );

  const ipBlocklist = spam.ipBlocklist ?? getDefaultIpBlocklist();

  const updateIpBlocklist = useCallback(
    <K extends keyof IpBlocklistConfig>(key: K, value: IpBlocklistConfig[K]) => {
      onChange({ ...spam, ipBlocklist: { ...ipBlocklist, [key]: value } });
    },
    [spam, ipBlocklist, onChange]
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
          <Field.Root
            name="honeypotFieldName"
            hint={formatMessage({
              id: getTranslation('settings.spam.honeypotFieldName.hint'),
              defaultMessage: 'Name of the hidden honeypot field',
            })}
          >
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
            <Field.Hint />
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
                    {!v3Entitled && (
                      <>
                        {' '}
                        <ProBadge tier="pro" />
                      </>
                    )}
                  </SingleSelectOption>
                </SingleSelect>
              </Field.Root>
            </Grid.Item>

            {recaptcha.version === 'v3' && (
              <LockedSection can={v3Entitled} feature="spam.recaptchaV3" mode="readonly">
                <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                  <Field.Root
                    name="recaptchaThreshold"
                    hint={formatMessage({
                      id: getTranslation('settings.spam.recaptcha.threshold.hint'),
                      defaultMessage: 'Minimum score (0.0 - 1.0) required to accept a submission',
                    })}
                  >
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
                    <Field.Hint />
                  </Field.Root>
                </Grid.Item>
              </LockedSection>
            )}

            <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
              <Field.Root
                name="recaptchaSiteKey"
                hint={formatMessage({
                  id: getTranslation('settings.spam.recaptcha.siteKey.hint'),
                  defaultMessage: 'Public key embedded in the form on the frontend',
                })}
              >
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
                <Field.Hint />
              </Field.Root>
            </Grid.Item>

            <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
              <Field.Root
                name="recaptchaSecretKey"
                hint={formatMessage({
                  id: getTranslation('settings.spam.recaptcha.secretKey.hint'),
                  defaultMessage:
                    'Stored server-side and never exposed publicly. Used to verify tokens with Google.',
                })}
              >
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
                <Field.Hint />
              </Field.Root>
            </Grid.Item>
          </Grid.Root>
        </Box>
      )}

      {/* Cloudflare Turnstile (Pro) */}
      <Flex direction="column" gap={1} alignItems="stretch">
        <Flex gap={2} alignItems="center">
          <Checkbox
            disabled={!turnstileEntitled}
            checked={turnstile.enabled}
            onCheckedChange={(checked: boolean) => updateTurnstile('enabled', checked)}
          >
            {formatMessage({
              id: getTranslation('settings.spam.turnstile.enable'),
              defaultMessage: 'Enable Cloudflare Turnstile',
            })}
          </Checkbox>
          {!turnstileEntitled && <ProBadge feature="spam.turnstile" />}
        </Flex>
        <Typography variant="pi" textColor="neutral600">
          {formatMessage({
            id: getTranslation('settings.spam.turnstile.hint'),
            defaultMessage:
              'Protect this form with Cloudflare Turnstile bot verification (Pro)',
          })}
        </Typography>
      </Flex>

      {turnstile.enabled && (
        <LockedSection can={turnstileEntitled} feature="spam.turnstile" mode="readonly">
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
                <Field.Root
                  name="turnstileSiteKey"
                  hint={formatMessage({
                    id: getTranslation('settings.spam.turnstile.siteKey.hint'),
                    defaultMessage: 'Public key embedded in the form on the frontend',
                  })}
                >
                  <Field.Label>
                    {formatMessage({
                      id: getTranslation('settings.spam.turnstile.siteKey.label'),
                      defaultMessage: 'Site Key',
                    })}
                  </Field.Label>
                  <TextInput
                    value={turnstile.siteKey ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateTurnstile('siteKey', e.target.value)
                    }
                    placeholder="0x4AAA..."
                  />
                  <Field.Hint />
                </Field.Root>
              </Grid.Item>

              <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                <Field.Root
                  name="turnstileSecretKey"
                  hint={formatMessage({
                    id: getTranslation('settings.spam.turnstile.secretKey.hint'),
                    defaultMessage: 'Stored server-side; used to verify tokens with Cloudflare',
                  })}
                >
                  <Field.Label>
                    {formatMessage({
                      id: getTranslation('settings.spam.turnstile.secretKey.label'),
                      defaultMessage: 'Secret Key',
                    })}
                  </Field.Label>
                  <TextInput
                    type="password"
                    value={turnstile.secretKey ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateTurnstile('secretKey', e.target.value)
                    }
                    placeholder="0x4AAA..."
                    autoComplete="new-password"
                  />
                  <Field.Hint />
                </Field.Root>
              </Grid.Item>
            </Grid.Root>
          </Box>
        </LockedSection>
      )}

      {/* hCaptcha (Pro) */}
      <Flex direction="column" gap={1} alignItems="stretch">
        <Flex gap={2} alignItems="center">
          <Checkbox
            disabled={!hcaptchaEntitled}
            checked={hcaptcha.enabled}
            onCheckedChange={(checked: boolean) => updateHcaptcha('enabled', checked)}
          >
            {formatMessage({
              id: getTranslation('settings.spam.hcaptcha.enable'),
              defaultMessage: 'Enable hCaptcha',
            })}
          </Checkbox>
          {!hcaptchaEntitled && <ProBadge feature="spam.hcaptcha" />}
        </Flex>
        <Typography variant="pi" textColor="neutral600">
          {formatMessage({
            id: getTranslation('settings.spam.hcaptcha.hint'),
            defaultMessage: 'Protect this form with hCaptcha bot verification (Pro)',
          })}
        </Typography>
      </Flex>

      {hcaptcha.enabled && (
        <LockedSection can={hcaptchaEntitled} feature="spam.hcaptcha" mode="readonly">
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
                <Field.Root
                  name="hcaptchaSiteKey"
                  hint={formatMessage({
                    id: getTranslation('settings.spam.hcaptcha.siteKey.hint'),
                    defaultMessage: 'Public key embedded in the form on the frontend',
                  })}
                >
                  <Field.Label>
                    {formatMessage({
                      id: getTranslation('settings.spam.hcaptcha.siteKey.label'),
                      defaultMessage: 'Site Key',
                    })}
                  </Field.Label>
                  <TextInput
                    value={hcaptcha.siteKey ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateHcaptcha('siteKey', e.target.value)
                    }
                    placeholder="10000000-ffff-..."
                  />
                  <Field.Hint />
                </Field.Root>
              </Grid.Item>

              <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                <Field.Root
                  name="hcaptchaSecretKey"
                  hint={formatMessage({
                    id: getTranslation('settings.spam.hcaptcha.secretKey.hint'),
                    defaultMessage: 'Stored server-side; used to verify tokens with hCaptcha',
                  })}
                >
                  <Field.Label>
                    {formatMessage({
                      id: getTranslation('settings.spam.hcaptcha.secretKey.label'),
                      defaultMessage: 'Secret Key',
                    })}
                  </Field.Label>
                  <TextInput
                    type="password"
                    value={hcaptcha.secretKey ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateHcaptcha('secretKey', e.target.value)
                    }
                    placeholder="0x0000..."
                    autoComplete="new-password"
                  />
                  <Field.Hint />
                </Field.Root>
              </Grid.Item>
            </Grid.Root>
          </Box>
        </LockedSection>
      )}

      {/* IP Blocklist (Pro) */}
      <Flex direction="column" gap={1} alignItems="stretch">
        <Flex gap={2} alignItems="center">
          <Checkbox
            disabled={!ipBlocklistEntitled}
            checked={!!spam.ipBlocklist}
            onCheckedChange={(checked: boolean) =>
              updateSpam('ipBlocklist', checked ? getDefaultIpBlocklist() : undefined)
            }
          >
            {formatMessage({
              id: getTranslation('settings.spam.ipBlocklist.enable'),
              defaultMessage: 'Enable IP blocklist',
            })}
          </Checkbox>
          {!ipBlocklistEntitled && <ProBadge feature="spam.ipBlocklist" />}
        </Flex>
        <Typography variant="pi" textColor="neutral600">
          {formatMessage({
            id: getTranslation('settings.spam.ipBlocklist.hint'),
            defaultMessage: 'Block specific IP addresses from submitting this form (Pro)',
          })}
        </Typography>
      </Flex>

      {spam.ipBlocklist && (
        <LockedSection can={ipBlocklistEntitled} feature="spam.ipBlocklist" mode="readonly">
          <Box
            padding={4}
            background="neutral100"
            hasRadius
            borderColor="neutral200"
            borderStyle="solid"
            borderWidth="1px"
          >
            <Field.Root
              name="ipBlocklistIps"
              hint={formatMessage({
                id: getTranslation('settings.spam.ipBlocklist.ips.hint'),
                defaultMessage:
                  'One IP address per line. Exact IPv4/IPv6 match. Country blocking is not yet available.',
              })}
            >
              <Field.Label>
                {formatMessage({
                  id: getTranslation('settings.spam.ipBlocklist.ips.label'),
                  defaultMessage: 'Blocked IPs',
                })}
              </Field.Label>
              <Textarea
                rows={6}
                value={ipsToText(ipBlocklist.ips)}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  updateIpBlocklist('ips', textToIps(e.target.value))
                }
                placeholder={'1.2.3.4\n2001:db8::1'}
              />
              <Field.Hint />
            </Field.Root>
          </Box>
        </LockedSection>
      )}
    </Flex>
  );
};

export default SpamSettings;
