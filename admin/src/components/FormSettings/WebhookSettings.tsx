import { useState } from 'react';
import {
  Box,
  Flex,
  Typography,
  Button,
  Field,
  TextInput,
  Toggle,
  SingleSelect,
  SingleSelectOption,
  IconButton,
  Card,
  CardBody,
  Divider,
  Checkbox,
} from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import { WebhookConfig, WebhookEvent } from '../../utils/api';

interface WebhookSettingsProps {
  webhooks: WebhookConfig[];
  onChange: (webhooks: WebhookConfig[]) => void;
}

/**
 * Available webhook events with labels
 */
const AVAILABLE_EVENTS: Array<{ value: WebhookEvent; label: string; description: string }> = [
  {
    value: 'submission.created',
    label: 'Submission Created',
    description: 'When a new form submission is received',
  },
  {
    value: 'submission.updated',
    label: 'Submission Updated',
    description: 'When a submission status changes',
  },
  {
    value: 'submission.deleted',
    label: 'Submission Deleted',
    description: 'When a submission is deleted',
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
  if (!url) return true; // Empty is valid (will be caught by required validation)
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

/**
 * Example webhook payload for documentation
 */
const EXAMPLE_PAYLOAD = {
  event: 'submission.created',
  timestamp: '2024-01-15T10:30:00.000Z',
  form: {
    id: 'abc123',
    title: 'Contact Form',
    slug: 'contact-form',
  },
  submission: {
    id: 'xyz789',
    status: 'new',
    createdAt: '2024-01-15T10:30:00.000Z',
    data: {
      name: 'John Doe',
      email: 'john@example.com',
    },
  },
};

/**
 * WebhookSettings component for configuring webhook integrations
 * Allows adding multiple webhook configurations with event filtering
 */
export const WebhookSettings = ({ webhooks, onChange }: WebhookSettingsProps) => {
  // Track which secrets are visible
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});
  // Track URL validation errors
  const [urlErrors, setUrlErrors] = useState<Record<number, string>>({});

  // Add new webhook
  const addWebhook = () => {
    onChange([...webhooks, createDefaultWebhook()]);
  };

  // Remove webhook
  const removeWebhook = (index: number) => {
    const updated = [...webhooks];
    updated.splice(index, 1);
    onChange(updated);

    // Clear errors for this webhook
    setUrlErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
  };

  // Update webhook property
  const updateWebhook = <K extends keyof WebhookConfig>(
    index: number,
    key: K,
    value: WebhookConfig[K]
  ) => {
    const updated = [...webhooks];
    updated[index] = { ...updated[index], [key]: value };
    onChange(updated);
  };

  // Handle URL change with validation
  const handleUrlChange = (index: number, value: string) => {
    updateWebhook(index, 'url', value);

    if (value && !isValidUrl(value)) {
      setUrlErrors((prev) => ({ ...prev, [index]: 'Please enter a valid URL (http or https)' }));
    } else {
      setUrlErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    }
  };

  // Toggle event selection
  const toggleEvent = (index: number, event: WebhookEvent) => {
    const updated = [...webhooks];
    const events = updated[index].events || [];

    if (events.includes(event)) {
      // Don't allow removing the last event
      if (events.length > 1) {
        updated[index] = {
          ...updated[index],
          events: events.filter((e) => e !== event),
        };
      }
    } else {
      updated[index] = {
        ...updated[index],
        events: [...events, event],
      };
    }

    onChange(updated);
  };

  // Toggle secret visibility
  const toggleSecretVisibility = (index: number) => {
    setShowSecrets((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <Box>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
        <Box>
          <Typography variant="delta" fontWeight="bold">
            Webhooks
          </Typography>
          <Typography variant="pi" textColor="neutral600">
            Send HTTP requests to external services when forms are submitted
          </Typography>
        </Box>
        <Button size="S" startIcon={<Plus />} onClick={addWebhook}>
          Add Webhook
        </Button>
      </Flex>

      {/* Empty State */}
      {webhooks.length === 0 ? (
        <Box padding={6} background="neutral100" hasRadius textAlign="center">
          <Typography textColor="neutral600">
            No webhooks configured. Click &quot;Add Webhook&quot; to create one.
          </Typography>
        </Box>
      ) : (
        <Flex direction="column" gap={4}>
          {webhooks.map((webhook, index) => (
            <Card key={index}>
              <CardBody>
                {/* Webhook Header */}
                <Flex justifyContent="space-between" alignItems="flex-start" marginBottom={4}>
                  <Flex gap={3} alignItems="center">
                    <Toggle
                      checked={webhook.enabled}
                      onCheckedChange={(checked: boolean) =>
                        updateWebhook(index, 'enabled', checked)
                      }
                    />
                    <Box>
                      <Typography fontWeight="bold">Webhook #{index + 1}</Typography>
                      {!webhook.enabled && (
                        <Typography variant="pi" textColor="neutral500">
                          Disabled
                        </Typography>
                      )}
                    </Box>
                  </Flex>
                  <IconButton
                    label="Remove webhook"
                    onClick={() => removeWebhook(index)}
                    variant="ghost"
                  >
                    <Trash />
                  </IconButton>
                </Flex>

                <Flex direction="column" gap={4}>
                  {/* URL and Method */}
                  <Flex gap={4} alignItems="flex-start">
                    <Box style={{ width: '120px', flexShrink: 0 }}>
                      <Field.Root name={`webhook-${index}-method`}>
                        <Field.Label>Method</Field.Label>
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
                      <Field.Root name={`webhook-${index}-url`} error={urlErrors[index]}>
                        <Field.Label>Webhook URL</Field.Label>
                        <TextInput
                          type="url"
                          value={webhook.url}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handleUrlChange(index, e.target.value)
                          }
                          placeholder="https://api.example.com/webhook"
                          hasError={!!urlErrors[index]}
                        />
                        {urlErrors[index] && <Field.Error />}
                      </Field.Root>
                    </Box>
                  </Flex>

                  {/* Events */}
                  <Box>
                    <Typography
                      variant="sigma"
                      textColor="neutral600"
                      textTransform="uppercase"
                      marginBottom={2}
                    >
                      Trigger Events
                    </Typography>
                    <Flex direction="column" gap={2}>
                      {AVAILABLE_EVENTS.map((event) => (
                        <Flex key={event.value} gap={2} alignItems="flex-start">
                          <Checkbox
                            checked={webhook.events?.includes(event.value)}
                            onCheckedChange={() => toggleEvent(index, event.value)}
                            disabled={
                              webhook.events?.length === 1 && webhook.events.includes(event.value)
                            }
                          />
                          <Box>
                            <Typography fontWeight="semiBold">{event.label}</Typography>
                            <Typography variant="pi" textColor="neutral600">
                              {event.description}
                            </Typography>
                          </Box>
                        </Flex>
                      ))}
                    </Flex>
                  </Box>

                  <Divider />

                  {/* Secret for signature */}
                  <Field.Root name={`webhook-${index}-secret`}>
                    <Field.Label>Webhook Secret (Optional)</Field.Label>
                    <Flex gap={2}>
                      <Box flex="1">
                        <TextInput
                          type={showSecrets[index] ? 'text' : 'password'}
                          value={webhook.secret || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateWebhook(index, 'secret', e.target.value || undefined)
                          }
                          placeholder="Secret key for HMAC signature"
                        />
                      </Box>
                      <Button variant="tertiary" onClick={() => toggleSecretVisibility(index)}>
                        {showSecrets[index] ? 'Hide' : 'Show'}
                      </Button>
                    </Flex>
                    <Field.Hint>
                      If provided, requests will include X-Webhook-Signature header for verification
                    </Field.Hint>
                  </Field.Root>

                  <Divider />

                  {/* Include Data Toggle */}
                  <Flex gap={3} alignItems="center">
                    <Toggle
                      checked={webhook.includeFormData !== false}
                      onCheckedChange={(checked: boolean) =>
                        updateWebhook(index, 'includeFormData', checked)
                      }
                    />
                    <Box>
                      <Typography fontWeight="semiBold">
                        Include form submission data in payload
                      </Typography>
                      <Typography variant="pi" textColor="neutral600">
                        When enabled, all submitted field values will be included in the webhook
                        payload
                      </Typography>
                    </Box>
                  </Flex>
                </Flex>
              </CardBody>
            </Card>
          ))}
        </Flex>
      )}

      {/* Example Payload */}
      <Box marginTop={4} padding={4} background="neutral100" hasRadius>
        <Typography
          variant="sigma"
          textColor="neutral600"
          textTransform="uppercase"
          marginBottom={2}
        >
          Example Payload
        </Typography>
        <Box
          padding={3}
          background="neutral0"
          hasRadius
          style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            overflow: 'auto',
            maxHeight: '200px',
          }}
        >
          <pre style={{ margin: 0 }}>{JSON.stringify(EXAMPLE_PAYLOAD, null, 2)}</pre>
        </Box>
        <Box marginTop={2}>
          <Typography variant="pi" textColor="neutral600">
            <strong>Headers:</strong> Content-Type: application/json, X-Webhook-Event: [event],
            X-Webhook-Signature: sha256=[hash] (if secret is configured)
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
