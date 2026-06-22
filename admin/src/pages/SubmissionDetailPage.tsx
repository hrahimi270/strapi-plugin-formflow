import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { styled } from 'styled-components';
import {
  Box,
  Flex,
  Typography,
  Grid,
  Divider,
  Link,
  SingleSelect,
  SingleSelectOption,
  Field,
  Button,
  Dialog,
} from '@strapi/design-system';
import { Trash, WarningCircle } from '@strapi/icons';
import {
  Page,
  Layouts,
  BackButton,
  ConfirmDialog,
  useNotification,
  useRBAC,
} from '@strapi/strapi/admin';

import { useSubmission } from '../hooks';
import { PLUGIN_ID } from '../pluginId';
import { getTranslation } from '../utils/getTranslation';
import { SUBMISSION_PERMISSIONS } from '../permissions';
import { StatusBadge } from '../components/shared/StatusBadge';
import { SubmissionStatus, FormField } from '../utils/api';
import ApprovalWorkflow from '../ee/components/ApprovalWorkflow';

/**
 * Status options for the dropdown.
 */
const STATUS_OPTIONS: Array<{ value: SubmissionStatus; labelId: string; defaultLabel: string }> = [
  { value: 'new', labelId: getTranslation('status.new'), defaultLabel: 'New' },
  { value: 'read', labelId: getTranslation('status.read'), defaultLabel: 'Read' },
  { value: 'processed', labelId: getTranslation('status.processed'), defaultLabel: 'Processed' },
  { value: 'archived', labelId: getTranslation('status.archived'), defaultLabel: 'Archived' },
  { value: 'spam', labelId: getTranslation('status.spam'), defaultLabel: 'Spam' },
];

const DEFAULT_HONEYPOT_FIELD = '_gotcha';

/**
 * Monospace block for raw/structured values (replaces inline `style` + `<pre>`).
 */
const Monospace = styled(Box)`
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  white-space: pre-wrap;
  word-break: break-word;
`;

/**
 * Format a date string for display.
 */
const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

/**
 * Get field label from form definition, falling back to the field name.
 */
const getFieldLabel = (fieldName: string, fields?: FormField[]): string => {
  const field = fields?.find((f) => f.name === fieldName);
  return field?.label || fieldName;
};

/**
 * Get field type for display formatting hints.
 */
const getFieldType = (fieldName: string, fields?: FormField[]): string | undefined => {
  return fields?.find((f) => f.name === fieldName)?.type;
};

/**
 * Field types whose stored values are option *values* that should be displayed
 * as their human-readable option *labels* (select / radio / multi-select
 * checkboxes).
 */
const CHOICE_FIELD_TYPES = new Set(['select', 'radio', 'checkbox']);

/**
 * Map a single stored option value to its display label using the field's
 * configured options. Falls back to the raw value when no option matches
 * (e.g. an option removed from the form after the submission was made).
 */
const getOptionLabel = (value: unknown, field?: FormField): string => {
  const raw = String(value);
  const match = field?.options?.find((o) => o.value === raw);
  return match?.label ?? raw;
};

/**
 * Resolve a choice field's stored value(s) to option label(s). Returns
 * undefined when the field is not a choice field (so the caller can fall back to
 * its default rendering).
 */
const getChoiceLabels = (
  fieldName: string,
  value: unknown,
  fields?: FormField[]
): string[] | undefined => {
  const field = fields?.find((f) => f.name === fieldName);
  if (!field || !CHOICE_FIELD_TYPES.has(field.type)) {
    return undefined;
  }
  const values = Array.isArray(value) ? value : [value];
  return values.map((v) => getOptionLabel(v, field));
};

/**
 * A stored file-field value is a media reference (or an array of them) shaped
 * like { id, url, name, mime?, size? }, produced when files are uploaded on
 * submission. Normalize either form to the refs we can render as links.
 */
interface MediaRef {
  url?: string;
  name?: string;
}
const asMediaRefs = (value: unknown): MediaRef[] => {
  const arr = Array.isArray(value) ? value : [value];
  return arr.filter(
    (v): v is MediaRef =>
      typeof v === 'object' && v !== null && typeof (v as MediaRef).url === 'string'
  );
};

interface MetadataItemProps {
  label: string;
  children: React.ReactNode;
  monospace?: boolean;
}

/**
 * A labelled metadata row in the sidebar panel.
 */
const MetadataItem = ({ label, children, monospace = false }: MetadataItemProps) => (
  <Box>
    <Typography variant="sigma" textColor="neutral600" textTransform="uppercase">
      {label}
    </Typography>
    <Box marginTop={1}>
      {monospace ? (
        <Monospace tag="div">{children}</Monospace>
      ) : (
        <Typography textColor="neutral800">{children}</Typography>
      )}
    </Box>
  </Box>
);

/**
 * Shape of the populated form (the server populates the full form, including
 * `settings`, but the shared `FormSubmissionDetail.form` type only declares a
 * subset). We read the honeypot field name from settings to know which key to
 * hide from the rendered data.
 */
interface PopulatedFormSettings {
  settings?: { spam?: { honeypotFieldName?: string } };
}

export const SubmissionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();

  const { submission, isLoading, isUpdating, error, updateStatus, deleteSubmission, refetch } =
    useSubmission(id);

  // Gate the status change (update) and delete actions. Super-admins pass all.
  const {
    allowedActions: { canUpdate, canDelete },
  } = useRBAC(SUBMISSION_PERMISSIONS);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const tabTitle = formatMessage({
    id: getTranslation('submission.title'),
    defaultMessage: 'Submission Details',
  });

  const handleStatusChange = async (value: string | number) => {
    try {
      await updateStatus(value as SubmissionStatus);
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: getTranslation('submission.status.updated'),
          defaultMessage: 'Status updated successfully',
        }),
      });
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('submission.status.error'),
          defaultMessage: 'Failed to update status',
        }),
      });
    }
  };

  const handleDelete = async () => {
    const formDocumentId = submission?.form?.documentId;
    try {
      await deleteSubmission();
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: getTranslation('submission.delete.success'),
          defaultMessage: 'Submission deleted successfully',
        }),
      });
      navigate(
        formDocumentId
          ? `/plugins/${PLUGIN_ID}/forms/${formDocumentId}/submissions`
          : `/plugins/${PLUGIN_ID}`
      );
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('submission.delete.error'),
          defaultMessage: 'Failed to delete submission',
        }),
      });
      setDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return <Page.Loading />;
  }

  if (error || !submission) {
    return <Page.Error />;
  }

  // Resolve the configured honeypot field name from the form settings and
  // exclude exactly that key from the rendered data (default `_gotcha`).
  const honeypotFieldName =
    (submission.form as unknown as PopulatedFormSettings | undefined)?.settings?.spam
      ?.honeypotFieldName || DEFAULT_HONEYPOT_FIELD;

  const dataEntries = Object.entries(submission.data).filter(([key]) => key !== honeypotFieldName);

  const backFallback = submission.form?.documentId
    ? `/plugins/${PLUGIN_ID}/forms/${submission.form.documentId}/submissions`
    : `/plugins/${PLUGIN_ID}`;

  const renderValue = (key: string, value: unknown) => {
    const fieldType = getFieldType(key, submission.form?.fields);

    if (value === null || value === undefined || value === '') {
      return <Typography textColor="neutral400">—</Typography>;
    }

    // For choice fields (select/radio/checkbox) the stored value(s) are option
    // *values* (e.g. "option_1"); display the matching option *label(s)*
    // ("Option 1"), falling back to the raw value when no option matches.
    const choiceLabels = getChoiceLabels(key, value, submission.form?.fields);
    if (choiceLabels) {
      return (
        <Typography textColor="neutral800">
          {choiceLabels.length === 0 ? '—' : choiceLabels.join(', ')}
        </Typography>
      );
    }

    // File fields store a media reference (or an array of them); render each as
    // a link to the uploaded file rather than dumping the raw object as JSON.
    if (fieldType === 'file') {
      const files = asMediaRefs(value);
      if (files.length === 0) {
        return <Typography textColor="neutral400">—</Typography>;
      }
      return (
        <Flex direction="column" alignItems="flex-start" gap={1}>
          {files.map((file, index) => (
            <Link key={index} href={file.url} isExternal>
              {file.name || file.url}
            </Link>
          ))}
        </Flex>
      );
    }

    if (Array.isArray(value)) {
      return (
        <Typography textColor="neutral800">
          {value.length === 0 ? '—' : value.join(', ')}
        </Typography>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <Typography textColor="neutral800">
          {value
            ? formatMessage({ id: getTranslation('common.yes'), defaultMessage: 'Yes' })
            : formatMessage({ id: getTranslation('common.no'), defaultMessage: 'No' })}
        </Typography>
      );
    }

    if (typeof value === 'object') {
      return <Monospace tag="pre">{JSON.stringify(value, null, 2)}</Monospace>;
    }

    if (fieldType === 'email') {
      return <Link href={`mailto:${String(value)}`}>{String(value)}</Link>;
    }

    if (fieldType === 'url') {
      return (
        <Link href={String(value)} isExternal>
          {String(value)}
        </Link>
      );
    }

    if (fieldType === 'textarea') {
      return <Monospace tag="div">{String(value)}</Monospace>;
    }

    return <Typography textColor="neutral800">{String(value)}</Typography>;
  };

  return (
    <Page.Main>
      <Page.Title>{tabTitle}</Page.Title>
      <Layouts.Header
        navigationAction={<BackButton disabled={false} fallback={backFallback} />}
        title={tabTitle}
        subtitle={
          submission.form?.title ||
          formatMessage({
            id: getTranslation('submissions.unknownForm'),
            defaultMessage: 'Unknown form',
          })
        }
        primaryAction={
          canDelete ? (
            <Button
              variant="danger-light"
              startIcon={<Trash />}
              onClick={() => setDeleteDialogOpen(true)}
            >
              {formatMessage({ id: getTranslation('common.delete'), defaultMessage: 'Delete' })}
            </Button>
          ) : null
        }
      />
      <Layouts.Content>
        <Grid.Root gap={4}>
          {/* Submitted data */}
          <Grid.Item col={8} xs={12} direction="column" alignItems="stretch">
            <Box
              background="neutral0"
              hasRadius
              shadow="tableShadow"
              padding={6}
              width="100%"
            >
              <Typography variant="delta" fontWeight="bold" tag="h2">
                {formatMessage({
                  id: getTranslation('submission.data'),
                  defaultMessage: 'Submitted Data',
                })}
              </Typography>
              <Box marginTop={4}>
                {dataEntries.length === 0 ? (
                  <Typography textColor="neutral400">
                    {formatMessage({
                      id: getTranslation('submission.noData'),
                      defaultMessage: 'No data submitted',
                    })}
                  </Typography>
                ) : (
                  dataEntries.map(([key, value], index) => (
                    <Box key={key}>
                      {index > 0 && <Divider marginTop={3} marginBottom={3} />}
                      <Typography variant="sigma" textColor="neutral600" textTransform="uppercase">
                        {getFieldLabel(key, submission.form?.fields)}
                      </Typography>
                      <Box marginTop={1}>{renderValue(key, value)}</Box>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          </Grid.Item>

          {/* Status + metadata */}
          <Grid.Item col={4} xs={12} direction="column" alignItems="stretch">
            <Flex direction="column" alignItems="stretch" gap={4} width="100%">
              <Box background="neutral0" hasRadius shadow="tableShadow" padding={6}>
                <Flex justifyContent="space-between" alignItems="center">
                  <Typography variant="delta" fontWeight="bold" tag="h2">
                    {formatMessage({
                      id: getTranslation('submission.status'),
                      defaultMessage: 'Status',
                    })}
                  </Typography>
                  <StatusBadge status={submission.status} />
                </Flex>
                <Box marginTop={3}>
                  <Field.Root name="status">
                    <Field.Label>
                      {formatMessage({
                        id: getTranslation('submission.changeStatus'),
                        defaultMessage: 'Change status',
                      })}
                    </Field.Label>
                    <SingleSelect
                      value={submission.status}
                      onChange={handleStatusChange}
                      disabled={isUpdating || !canUpdate}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <SingleSelectOption key={option.value} value={option.value}>
                          {formatMessage({
                            id: option.labelId,
                            defaultMessage: option.defaultLabel,
                          })}
                        </SingleSelectOption>
                      ))}
                    </SingleSelect>
                  </Field.Root>
                </Box>
              </Box>

              {/* Approval workflow (Business). Self-gates: renders an UpsellCard
                  when the license is not entitled. */}
              <ApprovalWorkflow
                submissionId={submission.documentId}
                approvalStatus={submission.approvalStatus}
                approvalNote={submission.approvalNote}
                onUpdated={refetch}
              />

              <Box background="neutral0" hasRadius shadow="tableShadow" padding={6}>
                <Typography variant="delta" fontWeight="bold" tag="h2">
                  {formatMessage({
                    id: getTranslation('submission.metadata'),
                    defaultMessage: 'Metadata',
                  })}
                </Typography>
                <Flex direction="column" alignItems="stretch" gap={3} marginTop={3}>
                  <MetadataItem
                    label={formatMessage({
                      id: getTranslation('submission.submittedAt'),
                      defaultMessage: 'Submitted At',
                    })}
                  >
                    {formatDate(submission.createdAt)}
                  </MetadataItem>

                  <Divider />

                  <MetadataItem
                    label={formatMessage({
                      id: getTranslation('submission.lastUpdated'),
                      defaultMessage: 'Last Updated',
                    })}
                  >
                    {formatDate(submission.updatedAt)}
                  </MetadataItem>

                  <Divider />

                  <MetadataItem
                    label={formatMessage({
                      id: getTranslation('submission.id'),
                      defaultMessage: 'Submission ID',
                    })}
                    monospace
                  >
                    {submission.documentId}
                  </MetadataItem>

                  {submission.ipAddress && (
                    <>
                      <Divider />
                      <MetadataItem
                        label={formatMessage({
                          id: getTranslation('submission.ipAddress'),
                          defaultMessage: 'IP Address',
                        })}
                        monospace
                      >
                        {submission.ipAddress}
                      </MetadataItem>
                    </>
                  )}

                  {submission.userAgent && (
                    <>
                      <Divider />
                      <MetadataItem
                        label={formatMessage({
                          id: getTranslation('submission.userAgent'),
                          defaultMessage: 'User Agent',
                        })}
                        monospace
                      >
                        {submission.userAgent}
                      </MetadataItem>
                    </>
                  )}

                  {typeof submission.metadata?.referrer === 'string' && (
                    <>
                      <Divider />
                      <MetadataItem
                        label={formatMessage({
                          id: getTranslation('submission.referrer'),
                          defaultMessage: 'Referrer',
                        })}
                      >
                        {submission.metadata.referrer}
                      </MetadataItem>
                    </>
                  )}

                  {typeof submission.metadata?.pageUrl === 'string' && (
                    <>
                      <Divider />
                      <MetadataItem
                        label={formatMessage({
                          id: getTranslation('submission.pageUrl'),
                          defaultMessage: 'Page URL',
                        })}
                      >
                        {submission.metadata.pageUrl}
                      </MetadataItem>
                    </>
                  )}
                </Flex>
              </Box>
            </Flex>
          </Grid.Item>
        </Grid.Root>
      </Layouts.Content>

      <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <ConfirmDialog onConfirm={handleDelete} variant="danger-light" icon={<WarningCircle />}>
          {formatMessage({
            id: getTranslation('submission.delete.confirm'),
            defaultMessage:
              'Are you sure you want to delete this submission? This action cannot be undone.',
          })}
        </ConfirmDialog>
      </Dialog.Root>
    </Page.Main>
  );
};
