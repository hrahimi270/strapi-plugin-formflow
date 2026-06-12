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
import { useIntl } from 'react-intl';

import { getTranslation } from '../../utils/getTranslation';
import { EmailNotification } from '../../utils/api';

export interface EmailSettingsProps {
  notifications: EmailNotification[];
  onChange: (notifications: EmailNotification[]) => void;
}

/** Recipient list keys on EmailNotification that this editor manages. */
type RecipientField = 'to' | 'cc' | 'bcc';

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
 * Validate email format. Template tokens (containing `{{`) are always allowed.
 */
const isValidEmail = (email: string): boolean => {
  if (!email) return true;
  if (email.includes('{{')) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * EmailSettings component for configuring email notifications
 */
export const EmailSettings = ({ notifications, onChange }: EmailSettingsProps) => {
  const { formatMessage } = useIntl();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const invalidEmailMessage = formatMessage({
    id: getTranslation('notifications.email.invalidEmail'),
    defaultMessage: 'Invalid email format',
  });

  const setError = (key: string, message: string | null) => {
    setValidationErrors((prev) => {
      const next = { ...prev };
      if (message) {
        next[key] = message;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const addNotification = () => {
    onChange([...notifications, createDefaultNotification()]);
  };

  const removeNotification = (index: number) => {
    const updated = [...notifications];
    updated.splice(index, 1);
    onChange(updated);

    setValidationErrors((prev) => {
      const next = { ...prev };
      Object.keys(next)
        .filter((key) => key.startsWith(`${index}-`))
        .forEach((key) => delete next[key]);
      return next;
    });
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

  const getRecipients = (notification: EmailNotification, field: RecipientField): string[] => {
    if (field === 'to') return notification.to;
    return notification[field] ?? [];
  };

  const addRecipient = (index: number, field: RecipientField) => {
    const current = getRecipients(notifications[index], field);
    updateNotification(index, field, [...current, '']);
  };

  const updateRecipient = (
    notifIndex: number,
    field: RecipientField,
    recipientIndex: number,
    value: string
  ) => {
    const current = [...getRecipients(notifications[notifIndex], field)];
    current[recipientIndex] = value;
    updateNotification(notifIndex, field, current);

    const errorKey = `${notifIndex}-${field}-${recipientIndex}`;
    setError(errorKey, value && !isValidEmail(value) ? invalidEmailMessage : null);
  };

  const removeRecipient = (notifIndex: number, field: RecipientField, recipientIndex: number) => {
    const current = [...getRecipients(notifications[notifIndex], field)];
    current.splice(recipientIndex, 1);
    updateNotification(notifIndex, field, field === 'to' && current.length === 0 ? [''] : current);

    const errorKey = `${notifIndex}-${field}-${recipientIndex}`;
    setError(errorKey, null);
  };

  const handleReplyToChange = (index: number, value: string) => {
    updateNotification(index, 'replyTo', value || undefined);
    const errorKey = `${index}-replyTo`;
    setError(errorKey, value && !isValidEmail(value) ? invalidEmailMessage : null);
  };

  const recipientLabels: Record<RecipientField, { id: string; defaultMessage: string }> = {
    to: { id: getTranslation('notifications.email.to.label'), defaultMessage: 'To' },
    cc: { id: getTranslation('notifications.email.cc.label'), defaultMessage: 'Cc' },
    bcc: { id: getTranslation('notifications.email.bcc.label'), defaultMessage: 'Bcc' },
  };

  const renderRecipientEditor = (
    notification: EmailNotification,
    index: number,
    field: RecipientField
  ) => {
    const recipients = getRecipients(notification, field);
    const isRequired = field === 'to';

    return (
      <Box key={field}>
        <Flex justifyContent="space-between" alignItems="center" marginBottom={2}>
          <Typography variant="sigma" textColor="neutral600">
            {formatMessage(recipientLabels[field])}
          </Typography>
          <Button
            size="S"
            variant="secondary"
            startIcon={<Plus />}
            onClick={() => addRecipient(index, field)}
          >
            {formatMessage({
              id: getTranslation('notifications.email.addRecipient'),
              defaultMessage: 'Add recipient',
            })}
          </Button>
        </Flex>
        {recipients.length === 0 ? (
          <Typography variant="pi" textColor="neutral500">
            {formatMessage({
              id: getTranslation('notifications.email.noRecipients'),
              defaultMessage: 'No recipients added',
            })}
          </Typography>
        ) : (
          <Flex direction="column" gap={2} alignItems="stretch">
            {recipients.map((email, recipientIndex) => {
              const errorKey = `${index}-${field}-${recipientIndex}`;
              const error = validationErrors[errorKey];
              return (
                <Flex key={recipientIndex} gap={2} alignItems="flex-start">
                  <Box flex="1">
                    <Field.Root name={errorKey} error={error || false}>
                      <TextInput
                        type="email"
                        aria-label={`${formatMessage(recipientLabels[field])} ${recipientIndex + 1}`}
                        placeholder={formatMessage({
                          id: getTranslation('notifications.email.to.placeholder'),
                          defaultMessage: 'recipient@example.com',
                        })}
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateRecipient(index, field, recipientIndex, e.target.value)
                        }
                      />
                      <Field.Error />
                    </Field.Root>
                  </Box>
                  <IconButton
                    label={formatMessage({
                      id: getTranslation('notifications.email.removeRecipient'),
                      defaultMessage: 'Remove recipient',
                    })}
                    onClick={() => removeRecipient(index, field, recipientIndex)}
                    disabled={isRequired && recipients.length === 1}
                    variant="ghost"
                    withTooltip={false}
                  >
                    <Trash />
                  </IconButton>
                </Flex>
              );
            })}
          </Flex>
        )}
      </Box>
    );
  };

  return (
    <Flex direction="column" gap={4} alignItems="stretch">
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="delta" fontWeight="bold">
            {formatMessage({
              id: getTranslation('notifications.email.title'),
              defaultMessage: 'Email Notifications',
            })}
          </Typography>
          <Box>
            <Typography variant="pi" textColor="neutral600">
              {formatMessage({
                id: getTranslation('notifications.email.subtitle'),
                defaultMessage: 'Send an email when a new submission is received',
              })}
            </Typography>
          </Box>
        </Box>
        <Button size="S" startIcon={<Plus />} onClick={addNotification}>
          {formatMessage({
            id: getTranslation('notifications.email.add'),
            defaultMessage: 'Add email notification',
          })}
        </Button>
      </Flex>

      {/* Empty State */}
      {notifications.length === 0 ? (
        <Box padding={6} background="neutral100" hasRadius>
          <Flex justifyContent="center">
            <Typography textColor="neutral600">
              {formatMessage({
                id: getTranslation('notifications.email.empty'),
                defaultMessage: 'No email notifications configured',
              })}
            </Typography>
          </Flex>
        </Box>
      ) : (
        <Flex direction="column" gap={4} alignItems="stretch">
          {notifications.map((notification, index) => (
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
              {/* Notification Header */}
              <Flex justifyContent="space-between" alignItems="flex-start" marginBottom={4}>
                <Checkbox
                  checked={notification.enabled}
                  onCheckedChange={(checked: boolean) =>
                    updateNotification(index, 'enabled', checked)
                  }
                >
                  <Typography fontWeight="bold">
                    {formatMessage(
                      {
                        id: getTranslation('notifications.email.itemTitle'),
                        defaultMessage: 'Notification #{number}',
                      },
                      { number: index + 1 }
                    )}
                    {!notification.enabled && (
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
                    id: getTranslation('notifications.email.remove'),
                    defaultMessage: 'Remove notification',
                  })}
                  onClick={() => removeNotification(index)}
                  variant="ghost"
                  withTooltip={false}
                >
                  <Trash />
                </IconButton>
              </Flex>

              <Flex direction="column" gap={4} alignItems="stretch">
                {/* Recipients: To / Cc / Bcc */}
                {renderRecipientEditor(notification, index, 'to')}
                {renderRecipientEditor(notification, index, 'cc')}
                {renderRecipientEditor(notification, index, 'bcc')}

                <Divider />

                {/* Subject and Reply-To Row */}
                <Flex gap={6} alignItems="flex-start">
                  <Box flex="1">
                    <Field.Root name={`notification-${index}-subject`}>
                      <Field.Label>
                        {formatMessage({
                          id: getTranslation('notifications.email.subject.label'),
                          defaultMessage: 'Subject',
                        })}
                      </Field.Label>
                      <TextInput
                        value={notification.subject}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateNotification(index, 'subject', e.target.value)
                        }
                        placeholder={formatMessage({
                          id: getTranslation('notifications.email.subject.placeholder'),
                          defaultMessage: 'New form submission',
                        })}
                      />
                      <Field.Hint>
                        {formatMessage({
                          id: getTranslation('notifications.email.subject.hint'),
                          defaultMessage:
                            'Use {{form.title}} and {{field.name}} for dynamic values',
                        })}
                      </Field.Hint>
                    </Field.Root>
                  </Box>

                  <Box flex="1">
                    <Field.Root
                      name={`notification-${index}-replyTo`}
                      error={validationErrors[`${index}-replyTo`] || false}
                    >
                      <Field.Label>
                        {formatMessage({
                          id: getTranslation('notifications.email.replyTo.label'),
                          defaultMessage: 'Reply-To',
                        })}
                      </Field.Label>
                      <TextInput
                        value={notification.replyTo || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleReplyToChange(index, e.target.value)
                        }
                        placeholder="{{field.email}}"
                      />
                      <Field.Hint>
                        {formatMessage({
                          id: getTranslation('notifications.email.replyTo.hint'),
                          defaultMessage: "Use {{field.email}} for the submitter's email",
                        })}
                      </Field.Hint>
                      <Field.Error />
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
                  {formatMessage({
                    id: getTranslation('notifications.email.includeData.label'),
                    defaultMessage: 'Include submission data',
                  })}
                </Checkbox>
              </Flex>
            </Box>
          ))}
        </Flex>
      )}

      {/* Requirements Note */}
      <Box padding={4} background="neutral100" hasRadius>
        <Typography variant="pi" textColor="neutral600">
          <Typography tag="span" variant="pi" fontWeight="bold" textColor="neutral700">
            {formatMessage({
              id: getTranslation('common.note'),
              defaultMessage: 'Note:',
            })}
          </Typography>{' '}
          {formatMessage({
            id: getTranslation('notifications.email.requirement'),
            defaultMessage:
              'Email notifications require the Strapi Email plugin to be installed and configured.',
          })}
        </Typography>
      </Box>
    </Flex>
  );
};

export default EmailSettings;
