import { useState } from 'react';
import {
  Box,
  Flex,
  Typography,
  Button,
  Field,
  TextInput,
  Checkbox,
  IconButton,
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
  if (!email) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email.includes('{{')) return true;
  return emailRegex.test(email);
};

/**
 * EmailSettings component for configuring email notifications
 */
export const EmailSettings = ({ notifications, onChange }: EmailSettingsProps) => {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const addNotification = () => {
    onChange([...notifications, createDefaultNotification()]);
  };

  const removeNotification = (index: number) => {
    const updated = [...notifications];
    updated.splice(index, 1);
    onChange(updated);

    const newErrors = { ...validationErrors };
    Object.keys(newErrors)
      .filter((key) => key.startsWith(`${index}-`))
      .forEach((key) => delete newErrors[key]);
    setValidationErrors(newErrors);
  };

  const updateNotification = <K extends keyof EmailNotification>(
    index: number,
    key: K,
    value: EmailNotification[K]
  ) => {
    const updated = [...notifications];
    updated[index] = { ...updated[index], [key]: value };
    onChange(updated);
  };

  const addRecipient = (index: number) => {
    const updated = [...notifications];
    updated[index] = {
      ...updated[index],
      to: [...updated[index].to, ''],
    };
    onChange(updated);
  };

  const updateRecipient = (notifIndex: number, recipientIndex: number, value: string) => {
    const updated = [...notifications];
    const newTo = [...updated[notifIndex].to];
    newTo[recipientIndex] = value;
    updated[notifIndex] = { ...updated[notifIndex], to: newTo };
    onChange(updated);

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

  const removeRecipient = (notifIndex: number, recipientIndex: number) => {
    const updated = [...notifications];
    const newTo = [...updated[notifIndex].to];
    newTo.splice(recipientIndex, 1);
    updated[notifIndex] = { ...updated[notifIndex], to: newTo };
    onChange(updated);

    const errorKey = `${notifIndex}-to-${recipientIndex}`;
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[errorKey];
      return newErrors;
    });
  };

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
    <Flex direction="column" gap={4} width="100%">
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center" width="100%">
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
        <Box padding={6} background="neutral100" hasRadius width="100%">
          <Typography textColor="neutral600" style={{ textAlign: 'center', display: 'block' }}>
            No email notifications configured. Click &quot;Add Notification&quot; to create one.
          </Typography>
        </Box>
      ) : (
        <Flex direction="column" gap={4} width="100%">
          {notifications.map((notification, index) => (
            <Box
              key={index}
              padding={4}
              background="neutral100"
              hasRadius
              borderColor="neutral200"
              borderStyle="solid"
              borderWidth="1px"
              width="100%"
            >
              {/* Notification Header */}
              <Flex justifyContent="space-between" alignItems="flex-start" marginBottom={4}>
                <Checkbox
                  checked={notification.enabled}
                  onCheckedChange={(checked: boolean) =>
                    updateNotification(index, 'enabled', checked)
                  }
                >
                  <Typography fontWeight="bold">
                    Notification #{index + 1}
                    {!notification.enabled && (
                      <Typography as="span" variant="pi" textColor="neutral500">
                        {' '}
                        (Disabled)
                      </Typography>
                    )}
                  </Typography>
                </Checkbox>
                <IconButton
                  label="Remove notification"
                  onClick={() => removeNotification(index)}
                  variant="ghost"
                  withTooltip={false}
                >
                  <Trash />
                </IconButton>
              </Flex>

              <Flex direction="column" gap={4} width="100%">
                {/* Recipients */}
                <Box width="100%">
                  <Flex justifyContent="space-between" alignItems="center" marginBottom={2}>
                    <Typography variant="sigma" textColor="neutral600" textTransform="uppercase">
                      Recipients (To)
                    </Typography>
                    <Button size="S" variant="secondary" onClick={() => addRecipient(index)}>
                      Add Recipient
                    </Button>
                  </Flex>
                  <Flex direction="column" gap={2} width="100%">
                    {notification.to.map((email, recipientIndex) => {
                      const errorKey = `${index}-to-${recipientIndex}`;
                      const hasError = !!validationErrors[errorKey];
                      return (
                        <Flex key={recipientIndex} gap={2} alignItems="flex-start" width="100%">
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
                            withTooltip={false}
                          >
                            <Trash />
                          </IconButton>
                        </Flex>
                      );
                    })}
                  </Flex>
                </Box>

                <Divider />

                {/* Subject and Reply-To Row */}
                <Flex gap={6} width="100%">
                  <Box flex="1">
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
                        Use {'{{form.title}}'}, {'{{field.fieldName}}'} for dynamic values
                      </Field.Hint>
                    </Field.Root>
                  </Box>

                  <Box flex="1">
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
                      <Field.Hint>Use {'{{field.email}}'} for submitter&apos;s email</Field.Hint>
                    </Field.Root>
                  </Box>
                </Flex>

                <Divider />

                {/* Include Data Toggle */}
                <Checkbox
                  checked={notification.includeData !== false}
                  onCheckedChange={(checked: boolean) =>
                    updateNotification(index, 'includeData', checked)
                  }
                >
                  Include submitted data in email
                </Checkbox>
              </Flex>
            </Box>
          ))}
        </Flex>
      )}

      {/* Requirements Note */}
      <Box padding={4} background="neutral100" hasRadius width="100%">
        <Typography variant="pi" textColor="neutral600">
          <strong>Note:</strong> Email notifications require the Strapi Email plugin to be installed
          and configured.
        </Typography>
      </Box>
    </Flex>
  );
};
