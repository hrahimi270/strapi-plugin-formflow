import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import {
  Main,
  Box,
  Flex,
  Typography,
  Button,
  IconButton,
  Grid,
  Card,
  CardBody,
  SingleSelect,
  SingleSelectOption,
  Divider,
  Loader,
} from '@strapi/design-system';
import { ArrowLeft, Trash } from '@strapi/icons';

import { API, FormSubmissionDetail, SubmissionStatus, ApiResponse, FormField } from '../utils/api';
import { PLUGIN_ID } from '../pluginId';
import { StatusBadge } from '../components/shared/StatusBadge';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import EmptyState from '../components/shared/EmptyState';

/**
 * Status options for the dropdown
 */
const STATUS_OPTIONS: Array<{ value: SubmissionStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'processed', label: 'Processed' },
  { value: 'archived', label: 'Archived' },
  { value: 'spam', label: 'Spam' },
];

/**
 * Format a date string for display
 */
const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
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
 * Format a value for display based on its type
 */
const formatValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined || value === '') {
    return <Typography textColor="neutral400">—</Typography>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <Typography textColor="neutral400">—</Typography>;
    }
    return value.join(', ');
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'object') {
    return (
      <Typography
        as="pre"
        style={{ fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}
      >
        {JSON.stringify(value, null, 2)}
      </Typography>
    );
  }

  return String(value);
};

/**
 * Get field label from form definition, falling back to the field name
 */
const getFieldLabel = (fieldName: string, fields?: FormField[]): string => {
  if (!fields) return fieldName;
  const field = fields.find((f) => f.name === fieldName);
  return field?.label || fieldName;
};

/**
 * Get field type for display formatting hints
 */
const getFieldType = (fieldName: string, fields?: FormField[]): string | undefined => {
  if (!fields) return undefined;
  const field = fields.find((f) => f.name === fieldName);
  return field?.type;
};

export const SubmissionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { get, put, del } = useFetchClient();
  const { toggleNotification } = useNotification();

  // State
  const [submission, setSubmission] = useState<FormSubmissionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch submission data
  const fetchSubmission = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await get<ApiResponse<FormSubmissionDetail>>(API.submission(id));
      setSubmission(response.data.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch submission';
      setError(new Error(errorMessage));
      setSubmission(null);
    } finally {
      setIsLoading(false);
    }
  }, [get, id]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  // Update status handler
  const handleStatusChange = async (newStatus: string | number) => {
    if (!id || !submission) return;

    const status = newStatus as SubmissionStatus;
    setIsUpdating(true);

    try {
      const response = await put<ApiResponse<FormSubmissionDetail>>(API.submission(id), { status });
      setSubmission(response.data.data);
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: 'strapi-forms.submission.status.updated',
          defaultMessage: 'Status updated successfully',
        }),
      });
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: 'strapi-forms.submission.status.error',
          defaultMessage: 'Failed to update status',
        }),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!id) return;

    setIsDeleting(true);

    try {
      await del(API.submission(id));
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: 'strapi-forms.submission.delete.success',
          defaultMessage: 'Submission deleted successfully',
        }),
      });

      // Navigate back to submissions list
      if (submission?.form?.documentId) {
        navigate(`/plugins/${PLUGIN_ID}/forms/${submission.form.documentId}/submissions`);
      } else {
        navigate(`/plugins/${PLUGIN_ID}`);
      }
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: 'strapi-forms.submission.delete.error',
          defaultMessage: 'Failed to delete submission',
        }),
      });
      setDeleteDialogOpen(false);
      setIsDeleting(false);
    }
  };

  // Navigate back
  const handleBack = () => {
    if (submission?.form?.documentId) {
      navigate(`/plugins/${PLUGIN_ID}/forms/${submission.form.documentId}/submissions`);
    } else {
      navigate(-1);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Main>
        <Box padding={8}>
          <Flex justifyContent="center" alignItems="center" minHeight="400px">
            <Loader>Loading submission...</Loader>
          </Flex>
        </Box>
      </Main>
    );
  }

  // Error state
  if (error) {
    return (
      <Main>
        <Box padding={8}>
          <EmptyState
            text="Error loading submission"
            buttonText='Try again'
            // description={error.message}
            action={() => fetchSubmission()}
            // action={
            //   <Button onClick={() => fetchSubmission()} variant="secondary">
            //     Try again
            //   </Button>
            // }
          />
        </Box>
      </Main>
    );
  }

  // Not found state
  if (!submission) {
    return (
      <Main>
        <Box padding={8}>
          <EmptyState
            text="Submission not found"
            buttonText='Back to Forms'
            // description="The submission you are looking for does not exist or has been deleted."
            action={() => navigate(`/plugins/${PLUGIN_ID}`)}
            // action={
            //   <Button onClick={() => navigate(`/plugins/${PLUGIN_ID}`)} variant="secondary">
            //     Back to Forms
            //   </Button>
            // }
          />
        </Box>
      </Main>
    );
  }

  // Get submission data entries, excluding honeypot fields
  const dataEntries = Object.entries(submission.data).filter(([key]) => {
    // Exclude common honeypot field names
    const honeypotPatterns = ['honeypot', '_hp', '_honey', 'hp_'];
    return !honeypotPatterns.some((pattern) => key.toLowerCase().includes(pattern));
  });

  return (
    <Main>
      {/* Header */}
      <Box padding={8} background="neutral100">
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap={4}>
            <IconButton label="Back to submissions" onClick={handleBack} variant="tertiary" withTooltip={false}>
              <ArrowLeft />
            </IconButton>
            <Box>
              <Flex alignItems="center" gap={2}>
                <Typography variant="alpha" as="h1">
                  Submission Details
                </Typography>
                <StatusBadge status={submission.status} />
              </Flex>
              <Typography variant="epsilon" textColor="neutral600">
                {submission.form?.title || 'Unknown form'}
              </Typography>
            </Box>
          </Flex>
          <Button
            variant="danger-light"
            startIcon={<Trash />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete
          </Button>
        </Flex>
      </Box>

      {/* Content */}
      <Box padding={8}>
        <Grid.Root gap={6}>
          {/* Main Content - Submission Data */}
          <Grid.Item col={8} s={12}>
            <Card>
              <CardBody>
                <Typography variant="delta" fontWeight="bold">
                  Submitted Data
                </Typography>

                <Box marginTop={4}>
                  {dataEntries.length === 0 ? (
                    <Typography textColor="neutral400">No data submitted</Typography>
                  ) : (
                    dataEntries.map(([key, value], index) => {
                      const fieldType = getFieldType(key, submission.form?.fields);
                      return (
                        <Box key={key}>
                          {index > 0 && <Divider marginTop={3} marginBottom={3} />}
                          <Box>
                            <Typography
                              variant="sigma"
                              textColor="neutral600"
                              textTransform="uppercase"
                            >
                              {getFieldLabel(key, submission.form?.fields)}
                            </Typography>
                            <Box marginTop={1}>
                              {fieldType === 'textarea' ? (
                                <Typography
                                  as="div"
                                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                >
                                  {formatValue(value)}
                                </Typography>
                              ) : fieldType === 'email' ? (
                                <Typography>
                                  <a href={`mailto:${value}`} style={{ color: 'inherit' }}>
                                    {String(value)}
                                  </a>
                                </Typography>
                              ) : fieldType === 'url' ? (
                                <Typography>
                                  <a
                                    href={String(value)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'inherit' }}
                                  >
                                    {String(value)}
                                  </a>
                                </Typography>
                              ) : (
                                <Typography>{formatValue(value)}</Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      );
                    })
                  )}
                </Box>
              </CardBody>
            </Card>
          </Grid.Item>

          {/* Sidebar - Status and Metadata */}
          <Grid.Item col={4} s={12}>
            <Flex direction="column" gap={4}>
              {/* Status Card */}
              <Card>
                <CardBody>
                  <Typography variant="delta" fontWeight="bold">
                    Status
                  </Typography>
                  <Box marginTop={3}>
                    <SingleSelect
                      value={submission.status}
                      onChange={handleStatusChange}
                      disabled={isUpdating}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <SingleSelectOption key={option.value} value={option.value}>
                          {option.label}
                        </SingleSelectOption>
                      ))}
                    </SingleSelect>
                  </Box>
                </CardBody>
              </Card>

              {/* Metadata Card */}
              <Card>
                <CardBody>
                  <Typography variant="delta" fontWeight="bold">
                    Metadata
                  </Typography>

                  <Flex direction="column" gap={3} marginTop={3}>
                    <Box>
                      <Typography variant="sigma" textColor="neutral600" textTransform="uppercase">
                        Submitted At
                      </Typography>
                      <Typography marginTop={1}>{formatDate(submission.createdAt)}</Typography>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="sigma" textColor="neutral600" textTransform="uppercase">
                        Last Updated
                      </Typography>
                      <Typography marginTop={1}>{formatDate(submission.updatedAt)}</Typography>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="sigma" textColor="neutral600" textTransform="uppercase">
                        Submission ID
                      </Typography>
                      <Typography
                        marginTop={1}
                        variant="pi"
                        style={{
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                        }}
                      >
                        {submission.documentId}
                      </Typography>
                    </Box>

                    {submission.ipAddress && (
                      <>
                        <Divider />
                        <Box>
                          <Typography
                            variant="sigma"
                            textColor="neutral600"
                            textTransform="uppercase"
                          >
                            IP Address
                          </Typography>
                          <Typography marginTop={1} style={{ fontFamily: 'monospace' }}>
                            {submission.ipAddress}
                          </Typography>
                        </Box>
                      </>
                    )}

                    {submission.userAgent && (
                      <>
                        <Divider />
                        <Box>
                          <Typography
                            variant="sigma"
                            textColor="neutral600"
                            textTransform="uppercase"
                          >
                            User Agent
                          </Typography>
                          <Typography
                            marginTop={1}
                            variant="pi"
                            textColor="neutral600"
                            style={{
                              wordBreak: 'break-word',
                            }}
                          >
                            {submission.userAgent}
                          </Typography>
                        </Box>
                      </>
                    )}

                    {submission.metadata?.referrer && (
                      <>
                        <Divider />
                        <Box>
                          <Typography
                            variant="sigma"
                            textColor="neutral600"
                            textTransform="uppercase"
                          >
                            Referrer
                          </Typography>
                          <Typography
                            marginTop={1}
                            ellipsis
                            style={{
                              wordBreak: 'break-all',
                            }}
                          >
                            {String(submission.metadata.referrer)}
                          </Typography>
                        </Box>
                      </>
                    )}

                    {submission.metadata?.pageUrl && (
                      <>
                        <Divider />
                        <Box>
                          <Typography
                            variant="sigma"
                            textColor="neutral600"
                            textTransform="uppercase"
                          >
                            Page URL
                          </Typography>
                          <Typography
                            marginTop={1}
                            ellipsis
                            style={{
                              wordBreak: 'break-all',
                            }}
                          >
                            {String(submission.metadata.pageUrl)}
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Flex>
                </CardBody>
              </Card>
            </Flex>
          </Grid.Item>
        </Grid.Root>
      </Box>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Submission"
        message="Are you sure you want to delete this submission? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isConfirming={isDeleting}
      />
    </Main>
  );
};
