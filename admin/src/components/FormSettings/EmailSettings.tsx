import { useState } from 'react';
import {
  Box,
  Flex,
  Typography,
  Button,
  Field,
  TextInput,
  Toggle,
  IconButton,
  Card,
  CardBody,
  Divider,
} from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import { EmailNotification } from '../../utils/api';

interface EmailSettingsProps {
  notifications: EmailNotification[];
  onChange: (notifications: EmailNotification[]) => void;
}

/**
 * Default notification configuration
 */
const createDefaultNotification = (): EmailNotification => ({
  enabled: true,
  to: [''],
  subject: 'New submission from {{form.title}}',
  includeData: true,
});

/**
 * Validate email format
 */
const isValidEmail = (email: string): boolean => {
  if (!email) return true; // Empty is valid (not required)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Also allow template variables
  if (email.includes('{{')) return true;
  return emailRegex.test(email);
};

/**
 * EmailSettings component for configuring email notifications
 * Allows adding multiple notification configurations with multiple recipients each
 */
export const EmailSettings = ({ notifications, onChange }: EmailSettingsProps) => {
  // Track which notifications have validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Add new notification
  const addNotification = () => {
    onChange([...notifications, createDefaultNotification()]);
  };

  // Remove notification
  const removeNotification = (index: number) => {
    const updated = [...notifications];
    updated.splice(index, 1);
    onChange(updated);

    // Clear any validation errors for this notification
    const newErrors = { ...validationErrors };
    Object.keys(newErrors)
      .filter((key) => key.startsWith(`${index}-`))
      .forEach((key) => delete newErrors[key]);
    setValidationErrors(newErrors);
  };

  // Update notification property
  const updateNotification = <K extends keyof EmailNotification>(
    index: number,
    key: K,
    value: EmailNotification[K]
  ) => {
    const updated = [...notifications];
    updated[index] = { ...updated[index], [key]: value };
    onChange(updated);
  };

  // Add recipient to 'to' array
  const addRecipient = (index: number) => {
    const updated = [...notifications];
    updated[index] = {
      ...updated[index],
      to: [...updated[index].to, ''],
    };
    onChange(updated);
  };

  // Update recipient email
  const updateRecipient = (notifIndex: number, recipientIndex: number, value: string) => {
    const updated = [...notifications];
    const newTo = [...updated[notifIndex].to];
    newTo[recipientIndex] = value;
    updated[notifIndex] = { ...updated[notifIndex], to: newTo };
    onChange(updated);

    // Validate email
    const errorKey = `${notifIndex}-to-${recipientIndex}`;
    if (value && !isValidEmail(value)) {
      setValidationErrors((prev) => ({ ...prev, [errorKey]: 'Invalid email format' }));
    } else {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  // Remove recipient
  const removeRecipient = (notifIndex: number, recipientIndex: number) => {
    const updated = [...notifications];
    const newTo = [...updated[notifIndex].to];
    newTo.splice(recipientIndex, 1);
    updated[notifIndex] = { ...updated[notifIndex], to: newTo };
    onChange(updated);

    // Clear validation error
    const errorKey = `${notifIndex}-to-${recipientIndex}`;
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[errorKey];
      return newErrors;
    });
  };

  // Validate replyTo field
  const handleReplyToChange = (index: number, value: string) => {
    updateNotification(index, 'replyTo', value || undefined);

    const errorKey = `${index}-replyTo`;
    if (value && !isValidEmail(value)) {
      setValidationErrors((prev) => ({ ...prev, [errorKey]: 'Invalid email format' }));
    } else {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  return (
    <Box>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
        <Box>
          <Typography variant="delta" fontWeight="bold">
            Email Notifications
          </Typography>
          <Typography variant="pi" textColor="neutral600">
            Send email notifications when forms are submitted
          </Typography>
        </Box>
        <Button size="S" startIcon={<Plus />} onClick={addNotification}>
          Add Notification
        </Button>
      </Flex>

      {/* Empty State */}
      {notifications.length === 0 ? (
        <Box padding={6} background="neutral100" hasRadius textAlign="center">
          <Typography textColor="neutral600">
            No email notifications configured. Click &quot;Add Notification&quot; to create one.
          </Typography>
        </Box>
      ) : (
        <Flex direction="column" gap={4}>
          {notifications.map((notification, index) => (
            <Card key={index}>
              <CardBody>
                {/* Notification Header */}
                <Flex justifyContent="space-between" alignItems="flex-start" marginBottom={4}>
                  <Flex gap={3} alignItems="center">
                    <Toggle
                      checked={notification.enabled}
                      onCheckedChange={(checked: boolean) =>
                        updateNotification(index, 'enabled', checked)
                      }
                    />
                    <Box>
                      <Typography fontWeight="bold">Notification #{index + 1}</Typography>
                      {!notification.enabled && (
                        <Typography variant="pi" textColor="neutral500">
                          Disabled
                        </Typography>
                      )}
                    </Box>
                  </Flex>
                  <IconButton
                    label="Remove notification"
                    onClick={() => removeNotification(index)}
                    variant="ghost"
                  >
                    <Trash />
                  </IconButton>
                </Flex>

                <Flex direction="column" gap={4}>
                  {/* Recipients */}
                  <Box>
                    <Flex justifyContent="space-between" alignItems="center" marginBottom={2}>
                      <Typography variant="sigma" textColor="neutral600" textTransform="uppercase">
                        Recipients (To)
                      </Typography>
                      <Button size="S" variant="secondary" onClick={() => addRecipient(index)}>
                        Add Recipient
                      </Button>
                    </Flex>
                    <Flex direction="column" gap={2}>
                      {notification.to.map((email, recipientIndex) => {
                        const errorKey = `${index}-to-${recipientIndex}`;
                        const hasError = !!validationErrors[errorKey];
                        return (
                          <Flex key={recipientIndex} gap={2} alignItems="flex-start">
                            <Box flex="1">
                              <TextInput
                                type="email"
                                placeholder="email@example.com"
                                value={email}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  updateRecipient(index, recipientIndex, e.target.value)
                                }
                                hasError={hasError}
                              />
                              {hasError && (
                                <Typography variant="pi" textColor="danger600">
                                  {validationErrors[errorKey]}
                                </Typography>
                              )}
                            </Box>
                            <IconButton
                              label="Remove recipient"
                              onClick={() => removeRecipient(index, recipientIndex)}
                              disabled={notification.to.length === 1}
                              variant="ghost"
                            >
                              <Trash />
                            </IconButton>
                          </Flex>
                        );
                      })}
                    </Flex>
                  </Box>

                  <Divider />

                  {/* Subject Line */}
                  <Field.Root name={`notification-${index}-subject`}>
                    <Field.Label>Subject Line</Field.Label>
                    <TextInput
                      value={notification.subject}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateNotification(index, 'subject', e.target.value)
                      }
                      placeholder="New submission from {{form.title}}"
                    />
                    <Field.Hint>
                      Use {'{{form.title}}'}, {'{{form.slug}}'}, {'{{field.fieldName}}'} for dynamic
                      values
                    </Field.Hint>
                  </Field.Root>

                  {/* Reply-To */}
                  <Field.Root
                    name={`notification-${index}-replyTo`}
                    error={validationErrors[`${index}-replyTo`]}
                  >
                    <Field.Label>Reply-To (Optional)</Field.Label>
                    <TextInput
                      value={notification.replyTo || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleReplyToChange(index, e.target.value)
                      }
                      placeholder="{{field.email}} or noreply@example.com"
                      hasError={!!validationErrors[`${index}-replyTo`]}
                    />
                    <Field.Hint>
                      Use {'{{field.email}}'} to set reply-to as the submitter&apos;s email
                    </Field.Hint>
                    {validationErrors[`${index}-replyTo`] && <Field.Error />}
                  </Field.Root>

                  <Divider />

                  {/* Include Data Toggle */}
                  <Flex gap={3} alignItems="center">
                    <Toggle
                      checked={notification.includeData !== false}
                      onCheckedChange={(checked: boolean) =>
                        updateNotification(index, 'includeData', checked)
                      }
                    />
                    <Box>
                      <Typography fontWeight="semiBold">Include submitted data in email</Typography>
                      <Typography variant="pi" textColor="neutral600">
                        When enabled, all form field values will be included in the notification
                        email
                      </Typography>
                    </Box>
                  </Flex>
                </Flex>
              </CardBody>
            </Card>
          ))}
        </Flex>
      )}

      {/* Requirements Note */}
      <Box marginTop={4} padding={4} background="neutral100" hasRadius>
        <Typography variant="pi" textColor="neutral600">
          <strong>Note:</strong> Email notifications require the Strapi Email plugin to be installed
          and configured. Set up your email provider in the Strapi configuration to enable sending
          notifications.
        </Typography>
      </Box>
    </Box>
  );
};
