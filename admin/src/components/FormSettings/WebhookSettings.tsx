import { useState } from 'react';
import {
  Box,
  Flex,
  Typography,
  Button,
  Field,
  TextInput,
  SingleSelect,
  SingleSelectOption,
  IconButton,
  Divider,
  Checkbox,
} from '@strapi/design-system';
import { Plus, Trash, Eye, EyeStriked } from '@strapi/icons';
import { useIntl } from 'react-intl';
import styled from 'styled-components';

import { getTranslation } from '../../utils/getTranslation';
import { WebhookConfig, WebhookEvent } from '../../utils/api';

export interface WebhookSettingsProps {
  webhooks: WebhookConfig[];
  onChange: (webhooks: WebhookConfig[]) => void;
}

/** A single editable header row (kept in component state, serialised to the record). */
interface HeaderRow {
  key: string;
  value: string;
}

/**
 * Monospace code block used to display the example webhook payload.
 * Replaces the previous raw <pre> + inline styles.
 */
const CodeBlock = styled(Box)`
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: ${({ theme }) => theme.fontSizes[1]};
  line-height: 1.6;
  white-space: pre;
  overflow: auto;
  max-height: 18rem;
`;

/**
 * Available webhook events with labels
 */
const AVAILABLE_EVENTS: Array<{
  value: WebhookEvent;
  labelId: string;
  defaultLabel: string;
}> = [
  {
    value: 'submission.created',
    labelId: 'notifications.webhook.events.created',
    defaultLabel: 'Submission created',
  },
  {
    value: 'submission.updated',
    labelId: 'notifications.webhook.events.updated',
    defaultLabel: 'Submission updated',
  },
  {
    value: 'submission.deleted',
    labelId: 'notifications.webhook.events.deleted',
    defaultLabel: 'Submission deleted',
  },
];

/**
 * Default webhook configuration
 */
const createDefaultWebhook = (): WebhookConfig => ({
  enabled: true,
  url: '',
  method: 'POST',
  events: ['submission.created'],
  includeFormData: true,
});

/**
 * Validate URL format
 */
const isValidUrl = (url: string): boolean => {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

/**
 * Convert a headers record into ordered editable rows (always ≥ 1 row).
 */
const headersToRows = (headers?: Record<string, string>): HeaderRow[] => {
  const entries = Object.entries(headers ?? {});
  if (entries.length === 0) return [{ key: '', value: '' }];
  return entries.map(([key, value]) => ({ key, value }));
};

/**
 * Convert editable rows back into a headers record, dropping empty keys.
 */
const rowsToHeaders = (rows: HeaderRow[]): Record<string, string> | undefined => {
  const record: Record<string, string> = {};
  rows.forEach(({ key, value }) => {
    const trimmed = key.trim();
    if (trimmed) record[trimmed] = value;
  });
  return Object.keys(record).length > 0 ? record : undefined;
};

/**
 * Example webhook payload
 */
const EXAMPLE_PAYLOAD = {
  event: 'submission.created',
  timestamp: '2024-01-15T10:30:00.000Z',
  form: { id: 'abc123', title: 'Contact Form', slug: 'contact-form' },
  submission: {
    id: 'xyz789',
    status: 'new',
    data: { name: 'John Doe', email: 'john@example.com' },
  },
};

/**
 * WebhookSettings component for configuring webhook integrations
 */
export const WebhookSettings = ({ webhooks, onChange }: WebhookSettingsProps) => {
  const { formatMessage } = useIntl();
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});
  const [urlErrors, setUrlErrors] = useState<Record<number, string>>({});
  // Header rows kept locally so partially-typed rows (empty key) survive edits.
  const [headerRows, setHeaderRows] = useState<Record<number, HeaderRow[]>>({});

  const invalidUrlMessage = formatMessage({
    id: getTranslation('notifications.webhook.url.invalid'),
    defaultMessage: 'Please enter a valid URL (http or https)',
  });

  const getHeaderRows = (index: number): HeaderRow[] =>
    headerRows[index] ?? headersToRows(webhooks[index]?.headers);

  const addWebhook = () => {
    onChange([...webhooks, createDefaultWebhook()]);
  };

  const removeWebhook = (index: number) => {
    const updated = [...webhooks];
    updated.splice(index, 1);
    onChange(updated);

    setUrlErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setHeaderRows((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const updateWebhook = <K extends keyof WebhookConfig>(
    index: number,
    key: K,
    value: WebhookConfig[K]
  ) => {
    const updated = [...webhooks];
    updated[index] = { ...updated[index], [key]: value };
    onChange(updated);
  };

  const handleUrlChange = (index: number, value: string) => {
    updateWebhook(index, 'url', value);
    setUrlErrors((prev) => {
      const next = { ...prev };
      if (value && !isValidUrl(value)) {
        next[index] = invalidUrlMessage;
      } else {
        delete next[index];
      }
      return next;
    });
  };

  const setRows = (index: number, rows: HeaderRow[]) => {
    setHeaderRows((prev) => ({ ...prev, [index]: rows }));
    updateWebhook(index, 'headers', rowsToHeaders(rows));
  };

  const addHeader = (index: number) => {
    setRows(index, [...getHeaderRows(index), { key: '', value: '' }]);
  };

  const updateHeader = (index: number, rowIndex: number, patch: Partial<HeaderRow>) => {
    const rows = getHeaderRows(index).map((row, i) => (i === rowIndex ? { ...row, ...patch } : row));
    setRows(index, rows);
  };

  const removeHeader = (index: number, rowIndex: number) => {
    const rows = getHeaderRows(index).filter((_, i) => i !== rowIndex);
    setRows(index, rows.length > 0 ? rows : [{ key: '', value: '' }]);
  };

  const toggleEvent = (index: number, event: WebhookEvent) => {
    const events = webhooks[index].events || [];
    if (events.includes(event)) {
      if (events.length > 1) {
        updateWebhook(
          index,
          'events',
          events.filter((e) => e !== event)
        );
      }
    } else {
      updateWebhook(index, 'events', [...events, event]);
    }
  };

  const toggleSecretVisibility = (index: number) => {
    setShowSecrets((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <Flex direction="column" gap={4} alignItems="stretch">
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="delta" fontWeight="bold">
            {formatMessage({
              id: getTranslation('notifications.webhook.title'),
              defaultMessage: 'Webhooks',
            })}
          </Typography>
          <Box>
            <Typography variant="pi" textColor="neutral600">
              {formatMessage({
                id: getTranslation('notifications.webhook.subtitle'),
                defaultMessage: 'Send submission data to an external URL',
              })}
            </Typography>
          </Box>
        </Box>
        <Button size="S" startIcon={<Plus />} onClick={addWebhook}>
          {formatMessage({
            id: getTranslation('notifications.webhook.add'),
            defaultMessage: 'Add webhook',
          })}
        </Button>
      </Flex>

      {/* Empty State */}
      {webhooks.length === 0 ? (
        <Box padding={6} background="neutral100" hasRadius>
          <Flex justifyContent="center">
            <Typography textColor="neutral600">
              {formatMessage({
                id: getTranslation('notifications.webhook.empty'),
                defaultMessage: 'No webhooks configured',
              })}
            </Typography>
          </Flex>
        </Box>
      ) : (
        <Flex direction="column" gap={4} alignItems="stretch">
          {webhooks.map((webhook, index) => (
            <Box
              key={index}
              padding={4}
              background="neutral0"
              hasRadius
              shadow="tableShadow"
              borderColor="neutral200"
              borderStyle="solid"
              borderWidth="1px"
            >
              {/* Webhook Header */}
              <Flex justifyContent="space-between" alignItems="flex-start" marginBottom={4}>
                <Checkbox
                  checked={webhook.enabled}
                  onCheckedChange={(checked: boolean) => updateWebhook(index, 'enabled', checked)}
                >
                  <Typography fontWeight="bold">
                    {formatMessage(
                      {
                        id: getTranslation('notifications.webhook.itemTitle'),
                        defaultMessage: 'Webhook #{number}',
                      },
                      { number: index + 1 }
                    )}
                    {!webhook.enabled && (
                      <Typography tag="span" variant="pi" textColor="neutral500">
                        {' '}
                        {formatMessage({
                          id: getTranslation('common.disabled'),
                          defaultMessage: '(Disabled)',
                        })}
                      </Typography>
                    )}
                  </Typography>
                </Checkbox>
                <IconButton
                  label={formatMessage({
                    id: getTranslation('notifications.webhook.remove'),
                    defaultMessage: 'Remove webhook',
                  })}
                  onClick={() => removeWebhook(index)}
                  variant="ghost"
                  withTooltip={false}
                >
                  <Trash />
                </IconButton>
              </Flex>

              <Flex direction="column" gap={4} alignItems="stretch">
                {/* URL and Method */}
                <Flex gap={6} alignItems="flex-start">
                  <Box width="14rem">
                    <Field.Root name={`webhook-${index}-method`}>
                      <Field.Label>
                        {formatMessage({
                          id: getTranslation('notifications.webhook.method.label'),
                          defaultMessage: 'Method',
                        })}
                      </Field.Label>
                      <SingleSelect
                        value={webhook.method}
                        onChange={(value: string | number) =>
                          updateWebhook(index, 'method', value as 'POST' | 'PUT')
                        }
                      >
                        <SingleSelectOption value="POST">POST</SingleSelectOption>
                        <SingleSelectOption value="PUT">PUT</SingleSelectOption>
                      </SingleSelect>
                    </Field.Root>
                  </Box>
                  <Box flex="1">
                    <Field.Root name={`webhook-${index}-url`} error={urlErrors[index] || false}>
                      <Field.Label>
                        {formatMessage({
                          id: getTranslation('notifications.webhook.url.label'),
                          defaultMessage: 'URL',
                        })}
                      </Field.Label>
                      <TextInput
                        type="url"
                        value={webhook.url}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleUrlChange(index, e.target.value)
                        }
                        placeholder={formatMessage({
                          id: getTranslation('notifications.webhook.url.placeholder'),
                          defaultMessage: 'https://example.com/webhook',
                        })}
                      />
                      <Field.Error />
                    </Field.Root>
                  </Box>
                </Flex>

                {/* Events */}
                <Box>
                  <Box marginBottom={2}>
                    <Typography variant="sigma" textColor="neutral600">
                      {formatMessage({
                        id: getTranslation('notifications.webhook.events.label'),
                        defaultMessage: 'Events',
                      })}
                    </Typography>
                  </Box>
                  <Flex direction="column" gap={2} alignItems="stretch">
                    {AVAILABLE_EVENTS.map((event) => (
                      <Checkbox
                        key={event.value}
                        checked={webhook.events?.includes(event.value)}
                        onCheckedChange={() => toggleEvent(index, event.value)}
                        disabled={
                          webhook.events?.length === 1 && webhook.events.includes(event.value)
                        }
                      >
                        {formatMessage({
                          id: getTranslation(event.labelId),
                          defaultMessage: event.defaultLabel,
                        })}
                      </Checkbox>
                    ))}
                  </Flex>
                </Box>

                <Divider />

                {/* Custom Headers */}
                <Box>
                  <Flex justifyContent="space-between" alignItems="center" marginBottom={2}>
                    <Typography variant="sigma" textColor="neutral600">
                      {formatMessage({
                        id: getTranslation('notifications.webhook.headers.label'),
                        defaultMessage: 'Headers',
                      })}
                    </Typography>
                    <Button
                      size="S"
                      variant="secondary"
                      startIcon={<Plus />}
                      onClick={() => addHeader(index)}
                    >
                      {formatMessage({
                        id: getTranslation('notifications.webhook.headers.add'),
                        defaultMessage: 'Add header',
                      })}
                    </Button>
                  </Flex>
                  <Flex direction="column" gap={2} alignItems="stretch">
                    {getHeaderRows(index).map((row, rowIndex) => (
                      <Flex key={rowIndex} gap={2} alignItems="flex-start">
                        <Box flex="1">
                          <Field.Root name={`webhook-${index}-header-key-${rowIndex}`}>
                            <TextInput
                              aria-label={formatMessage({
                                id: getTranslation('notifications.webhook.headers.key'),
                                defaultMessage: 'Header name',
                              })}
                              placeholder={formatMessage({
                                id: getTranslation('notifications.webhook.headers.key'),
                                defaultMessage: 'Header name',
                              })}
                              value={row.key}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updateHeader(index, rowIndex, { key: e.target.value })
                              }
                            />
                          </Field.Root>
                        </Box>
                        <Box flex="1">
                          <Field.Root name={`webhook-${index}-header-value-${rowIndex}`}>
                            <TextInput
                              aria-label={formatMessage({
                                id: getTranslation('notifications.webhook.headers.value'),
                                defaultMessage: 'Header value',
                              })}
                              placeholder={formatMessage({
                                id: getTranslation('notifications.webhook.headers.value'),
                                defaultMessage: 'Header value',
                              })}
                              value={row.value}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updateHeader(index, rowIndex, { value: e.target.value })
                              }
                            />
                          </Field.Root>
                        </Box>
                        <IconButton
                          label={formatMessage({
                            id: getTranslation('notifications.webhook.headers.remove'),
                            defaultMessage: 'Remove header',
                          })}
                          onClick={() => removeHeader(index, rowIndex)}
                          variant="ghost"
                          withTooltip={false}
                        >
                          <Trash />
                        </IconButton>
                      </Flex>
                    ))}
                  </Flex>
                </Box>

                <Divider />

                {/* Secret */}
                <Field.Root name={`webhook-${index}-secret`}>
                  <Field.Label>
                    {formatMessage({
                      id: getTranslation('notifications.webhook.secret.label'),
                      defaultMessage: 'Secret',
                    })}
                  </Field.Label>
                  <Flex gap={2} alignItems="flex-start">
                    <Box flex="1">
                      <TextInput
                        type={showSecrets[index] ? 'text' : 'password'}
                        value={webhook.secret || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateWebhook(index, 'secret', e.target.value || undefined)
                        }
                        placeholder={formatMessage({
                          id: getTranslation('notifications.webhook.secret.placeholder'),
                          defaultMessage: 'Secret key for HMAC signature',
                        })}
                        autoComplete="new-password"
                      />
                    </Box>
                    <IconButton
                      label={formatMessage({
                        id: getTranslation('notifications.webhook.secret.toggle'),
                        defaultMessage: 'Toggle secret visibility',
                      })}
                      onClick={() => toggleSecretVisibility(index)}
                      variant="tertiary"
                    >
                      {showSecrets[index] ? <EyeStriked /> : <Eye />}
                    </IconButton>
                  </Flex>
                  <Field.Hint>
                    {formatMessage({
                      id: getTranslation('notifications.webhook.secret.hint'),
                      defaultMessage:
                        'If provided, requests include an X-Webhook-Signature header for verification',
                    })}
                  </Field.Hint>
                </Field.Root>

                <Divider />

                {/* Include Data Toggle */}
                <Checkbox
                  checked={webhook.includeFormData !== false}
                  onCheckedChange={(checked: boolean) =>
                    updateWebhook(index, 'includeFormData', checked)
                  }
                >
                  {formatMessage({
                    id: getTranslation('notifications.webhook.includeFormData.label'),
                    defaultMessage: 'Include form data',
                  })}
                </Checkbox>
              </Flex>
            </Box>
          ))}
        </Flex>
      )}

      {/* Example Payload */}
      <Box padding={4} background="neutral100" hasRadius>
        <Box marginBottom={2}>
          <Typography variant="sigma" textColor="neutral600">
            {formatMessage({
              id: getTranslation('notifications.webhook.examplePayload'),
              defaultMessage: 'Example Payload',
            })}
          </Typography>
        </Box>
        <CodeBlock padding={3} background="neutral0" hasRadius>
          <Typography variant="pi" textColor="neutral800" fontWeight="regular">
            {JSON.stringify(EXAMPLE_PAYLOAD, null, 2)}
          </Typography>
        </CodeBlock>
        <Box marginTop={2}>
          <Typography variant="pi" textColor="neutral600">
            <Typography tag="span" variant="pi" fontWeight="bold" textColor="neutral700">
              {formatMessage({
                id: getTranslation('notifications.webhook.headers.label'),
                defaultMessage: 'Headers',
              })}
              :
            </Typography>{' '}
            Content-Type: application/json, X-Webhook-Event: [event], X-Webhook-Signature:
            sha256=[hash]
          </Typography>
        </Box>
      </Box>
    </Flex>
  );
};

export default WebhookSettings;
