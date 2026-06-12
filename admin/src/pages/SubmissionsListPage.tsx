import type * as React from 'react';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  Flex,
  Typography,
  Button,
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Checkbox,
  SingleSelect,
  SingleSelectOption,
  Dialog,
  EmptyStateLayout,
  Menu,
  Field,
  Switch,
  VisuallyHidden,
} from '@strapi/design-system';
import { Trash, Download, Eye, CheckCircle, Archive, CaretDown, WarningCircle } from '@strapi/icons';
import { EmptyDocuments } from '@strapi/icons/symbols';
import {
  Page,
  Layouts,
  BackButton,
  Pagination,
  ConfirmDialog,
  useNotification,
  useQueryParams,
} from '@strapi/strapi/admin';

import { useSubmissions } from '../hooks/useSubmissions';
import { useForm } from '../hooks/useForm';
import { PLUGIN_ID } from '../pluginId';
import { getTranslation } from '../utils/getTranslation';
import { StatusBadge } from '../components/shared/StatusBadge';
import { SubmissionStatus, ExportFormat } from '../utils/api';

/**
 * Status options for the filter dropdown.
 */
const STATUS_OPTIONS: Array<{ value: SubmissionStatus; labelId: string; defaultLabel: string }> = [
  { value: 'new', labelId: getTranslation('status.new'), defaultLabel: 'New' },
  { value: 'read', labelId: getTranslation('status.read'), defaultLabel: 'Read' },
  { value: 'processed', labelId: getTranslation('status.processed'), defaultLabel: 'Processed' },
  { value: 'archived', labelId: getTranslation('status.archived'), defaultLabel: 'Archived' },
  { value: 'spam', labelId: getTranslation('status.spam'), defaultLabel: 'Spam' },
];

const DEFAULT_PAGE_SIZE = 25;

/**
 * Format a date string for display.
 */
const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

/**
 * Get a short preview of submission data (first 2 non-empty fields).
 */
const getPreview = (data: Record<string, unknown>): string => {
  const entries = Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 2);

  if (entries.length === 0) {
    return '—';
  }

  return entries
    .map(([key, value]) => {
      const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const truncated = strValue.length > 30 ? `${strValue.slice(0, 30)}...` : strValue;
      return `${key}: ${truncated}`;
    })
    .join(' | ');
};

interface SubmissionsQuery {
  page?: string;
  pageSize?: string;
  status?: SubmissionStatus;
}

export const SubmissionsListPage = () => {
  const { formId } = useParams<{ formId: string }>();

  // The URL query is the source of truth for page / pageSize / status so the
  // view survives a refresh and the native <Pagination> can drive it directly.
  const [{ query }, setQuery] = useQueryParams<SubmissionsQuery>();
  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || DEFAULT_PAGE_SIZE;
  const status = query.status;

  const { form, isLoading: isLoadingForm } = useForm(formId);

  // `useSubmissions` keeps its own query state internally and only reads
  // `initialQueryParams` on mount, so we remount its consumer whenever the
  // page size or status (the params it has no public setter for) change by
  // keying <SubmissionsView>. Page changes — the frequent case — are pushed
  // through the hook's `setPage` without a remount.
  return (
    <SubmissionsView
      key={`${pageSize}-${status ?? 'all'}`}
      formId={formId!}
      page={page}
      pageSize={pageSize}
      status={status}
      form={form}
      isLoadingForm={isLoadingForm}
      setQuery={setQuery}
    />
  );
};

interface SubmissionsViewProps {
  formId: string;
  page: number;
  pageSize: number;
  status?: SubmissionStatus;
  form: ReturnType<typeof useForm>['form'];
  isLoadingForm: boolean;
  setQuery: (params: SubmissionsQuery) => void;
}

const SubmissionsView = ({
  formId,
  page,
  pageSize,
  status,
  form,
  isLoadingForm,
  setQuery,
}: SubmissionsViewProps) => {
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();

  const {
    submissions,
    pagination,
    isLoading,
    isDeleting,
    isUpdating,
    isExporting,
    error,
    setPage,
    deleteSubmission,
    bulkDelete,
    bulkUpdateStatus,
    exportSubmissions,
  } = useSubmissions(formId, { page, pageSize, status });

  // Page changes flow through the URL; push them into the hook (no remount).
  useEffect(() => {
    setPage(page);
  }, [page, setPage]);

  // Guard against an out-of-range page: increasing the page size (or a direct
  // URL edit) can leave `page` beyond the available `pageCount`, which would
  // request an empty page. Clamp the URL back to the last valid page so the
  // view always shows data. Only act once a real page count is known and there
  // is at least one page of results.
  useEffect(() => {
    const pageCount = pagination?.pageCount;
    if (pageCount && pageCount >= 1 && page > pageCount) {
      setQuery({ page: String(pageCount) });
    }
  }, [page, pagination?.pageCount, setQuery]);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Delete dialog state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // IP inclusion for export
  const [includeIp, setIncludeIp] = useState(false);

  const tabTitle = formatMessage({
    id: getTranslation('submissions.title'),
    defaultMessage: 'Submissions',
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleAll = (selected: boolean | 'indeterminate') => {
    setSelectedIds(selected === true ? submissions.map((s) => s.documentId) : []);
  };

  /**
   * After deleting `removedIds`, if the current page is now empty and we are
   * not on the first page, step the URL back one page so the user is not left
   * on a stranded empty page. The URL is the source of truth, so we update it
   * directly rather than fighting the hook's own page reconciliation.
   */
  const stepBackIfPageEmptied = (removedIds: string[]) => {
    const removed = new Set(removedIds);
    const remaining = submissions.filter((s) => !removed.has(s.documentId)).length;
    if (remaining === 0 && page > 1) {
      setQuery({ page: String(page - 1) });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) {
      return;
    }
    const idToDelete = deletingId;
    try {
      await deleteSubmission(idToDelete);
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: getTranslation('submissions.delete.success'),
          defaultMessage: 'Submission deleted successfully',
        }),
      });
      setSelectedIds((prev) => prev.filter((id) => id !== idToDelete));
      stepBackIfPageEmptied([idToDelete]);
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('submissions.delete.error'),
          defaultMessage: 'Failed to delete submission',
        }),
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    const idsToDelete = selectedIds;
    try {
      const result = await bulkDelete(idsToDelete);
      stepBackIfPageEmptied(idsToDelete);
      toggleNotification({
        type: 'success',
        message: formatMessage(
          {
            id: getTranslation('submissions.bulkDelete.success'),
            defaultMessage: '{count} submission(s) deleted successfully',
          },
          { count: result.deleted }
        ),
      });
      setSelectedIds([]);
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('submissions.bulkDelete.error'),
          defaultMessage: 'Failed to delete submissions',
        }),
      });
    } finally {
      setBulkDeleteOpen(false);
    }
  };

  const handleBulkStatus = async (newStatus: SubmissionStatus) => {
    if (selectedIds.length === 0) {
      return;
    }
    try {
      await bulkUpdateStatus(selectedIds, newStatus);
      toggleNotification({
        type: 'success',
        message: formatMessage(
          {
            id: getTranslation('submissions.bulkStatus.success'),
            defaultMessage: '{count} submission(s) updated',
          },
          { count: selectedIds.length }
        ),
      });
      setSelectedIds([]);
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('submissions.bulkStatus.error'),
          defaultMessage: 'Failed to update submissions',
        }),
      });
    }
  };

  const handleExport = async (format: ExportFormat) => {
    try {
      await exportSubmissions(format, status, { includeIp });
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: getTranslation('submissions.export.success'),
          defaultMessage: 'Export started',
        }),
      });
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('submissions.export.error'),
          defaultMessage: 'Failed to export submissions',
        }),
      });
    }
  };

  const handleStatusFilterChange = (value: string | number) => {
    setSelectedIds([]);
    if (value) {
      setQuery({ status: value as SubmissionStatus, page: '1' });
    } else {
      setQuery({ status: undefined, page: '1' });
    }
  };

  const handleViewSubmission = (documentId: string) => {
    navigate(`/plugins/${PLUGIN_ID}/submissions/${documentId}`);
  };

  if (isLoading && submissions.length === 0) {
    return <Page.Loading />;
  }

  if (error) {
    return <Page.Error />;
  }

  const numberOfSubmissions = submissions.length;
  const isAllSelected = selectedIds.length === numberOfSubmissions && numberOfSubmissions > 0;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < numberOfSubmissions;

  return (
    <Page.Main>
      <Page.Title>{tabTitle}</Page.Title>
      <Layouts.Header
        navigationAction={<BackButton disabled={false} fallback={`/plugins/${PLUGIN_ID}`} />}
        title={tabTitle}
        subtitle={
          isLoadingForm
            ? formatMessage({ id: getTranslation('common.loading'), defaultMessage: 'Loading...' })
            : form?.title ||
              formatMessage({
                id: getTranslation('submissions.unknownForm'),
                defaultMessage: 'Unknown form',
              })
        }
        primaryAction={
          <Menu.Root>
            <Menu.Trigger
              variant="secondary"
              startIcon={<Download />}
              endIcon={<CaretDown />}
              loading={isExporting}
              disabled={numberOfSubmissions === 0}
            >
              {formatMessage({
                id: getTranslation('submissions.export'),
                defaultMessage: 'Export',
              })}
            </Menu.Trigger>
            <Menu.Content>
              <Menu.Item onSelect={() => handleExport('csv')}>
                {formatMessage({
                  id: getTranslation('submissions.export.csv'),
                  defaultMessage: 'Export as CSV',
                })}
              </Menu.Item>
              <Menu.Item onSelect={() => handleExport('json')}>
                {formatMessage({
                  id: getTranslation('submissions.export.json'),
                  defaultMessage: 'Export as JSON',
                })}
              </Menu.Item>
            </Menu.Content>
          </Menu.Root>
        }
      />

      {selectedIds.length > 0 && (
        <Layouts.Action
          startActions={
            <>
              <Typography variant="epsilon" textColor="neutral600">
                {formatMessage(
                  {
                    id: getTranslation('submissions.selected'),
                    defaultMessage:
                      '{count, plural, one {# submission} other {# submissions}} selected',
                  },
                  { count: selectedIds.length }
                )}
              </Typography>
              <Button
                variant="secondary"
                startIcon={<CheckCircle />}
                onClick={() => handleBulkStatus('read')}
                loading={isUpdating}
              >
                {formatMessage({
                  id: getTranslation('submissions.bulk.markRead'),
                  defaultMessage: 'Mark as read',
                })}
              </Button>
              <Button
                variant="secondary"
                startIcon={<Archive />}
                onClick={() => handleBulkStatus('archived')}
                loading={isUpdating}
              >
                {formatMessage({
                  id: getTranslation('submissions.bulk.markArchived'),
                  defaultMessage: 'Mark as archived',
                })}
              </Button>
              <Button
                variant="danger-light"
                startIcon={<Trash />}
                onClick={() => setBulkDeleteOpen(true)}
                loading={isDeleting}
              >
                {formatMessage({ id: getTranslation('common.delete'), defaultMessage: 'Delete' })}
              </Button>
            </>
          }
        />
      )}

      {selectedIds.length === 0 && (
        <Layouts.Action
          startActions={
            <Flex gap={4} alignItems="end" wrap="wrap">
              <Field.Root
                name="status-filter"
              hint={formatMessage(
                {
                  id: getTranslation('submissions.count'),
                  defaultMessage: '{count, plural, one {# submission} other {# submissions}}',
                },
                { count: pagination?.total ?? 0 }
              )}
            >
              <SingleSelect
                aria-label={formatMessage({
                  id: getTranslation('submissions.filter.status'),
                  defaultMessage: 'Filter by status',
                })}
                placeholder={formatMessage({
                  id: getTranslation('submissions.filter.status'),
                  defaultMessage: 'Filter by status',
                })}
                value={status || ''}
                onChange={handleStatusFilterChange}
                onClear={() => handleStatusFilterChange('')}
                clearLabel={formatMessage({
                  id: getTranslation('submissions.clearFilter'),
                  defaultMessage: 'Clear filter',
                })}
              >
                {STATUS_OPTIONS.map((option) => (
                  <SingleSelectOption key={option.value} value={option.value}>
                    {formatMessage({ id: option.labelId, defaultMessage: option.defaultLabel })}
                  </SingleSelectOption>
                ))}
              </SingleSelect>
            </Field.Root>

            <Field.Root name="include-ip">
              <Flex gap={2} alignItems="center" paddingBottom={2}>
                <Switch
                  checked={includeIp}
                  onCheckedChange={(checked: boolean) => setIncludeIp(checked)}
                  onLabel={formatMessage({ id: getTranslation('common.on'), defaultMessage: 'On' })}
                  offLabel={formatMessage({
                    id: getTranslation('common.off'),
                    defaultMessage: 'Off',
                  })}
                  aria-label={formatMessage({
                    id: getTranslation('submissions.export.includeIp'),
                    defaultMessage: 'Include IP address in export',
                  })}
                  visibleLabels
                />
                <Typography variant="pi" textColor="neutral600">
                  {formatMessage({
                    id: getTranslation('submissions.export.includeIp'),
                    defaultMessage: 'Include IP address in export',
                  })}
                </Typography>
              </Flex>
            </Field.Root>
            </Flex>
          }
        />
      )}

      <Layouts.Content>
        {numberOfSubmissions > 0 ? (
          <>
            <Table colCount={5} rowCount={numberOfSubmissions + 1}>
              <Thead>
                <Tr>
                  <Th>
                    <Checkbox
                      aria-label={formatMessage({
                        id: getTranslation('common.selectAll'),
                        defaultMessage: 'Select all entries',
                      })}
                      checked={isIndeterminate ? 'indeterminate' : isAllSelected}
                      onCheckedChange={toggleAll}
                    />
                  </Th>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      {formatMessage({
                        id: getTranslation('submissions.column.status'),
                        defaultMessage: 'Status',
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      {formatMessage({
                        id: getTranslation('submissions.column.submitted'),
                        defaultMessage: 'Submitted',
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      {formatMessage({
                        id: getTranslation('submissions.column.preview'),
                        defaultMessage: 'Preview',
                      })}
                    </Typography>
                  </Th>
                  <Th>
                    <VisuallyHidden>
                      {formatMessage({
                        id: getTranslation('submissions.column.actions'),
                        defaultMessage: 'Actions',
                      })}
                    </VisuallyHidden>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {submissions.map((submission) => (
                  <Tr
                    key={submission.documentId}
                    onClick={() => handleViewSubmission(submission.documentId)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={`${formatMessage({
                          id: getTranslation('common.select'),
                          defaultMessage: 'Select',
                        })} ${submission.documentId}`}
                        checked={selectedIds.includes(submission.documentId)}
                        onCheckedChange={() => toggleSelection(submission.documentId)}
                      />
                    </Td>
                    <Td>
                      <StatusBadge status={submission.status} />
                    </Td>
                    <Td>
                      <Typography textColor="neutral800">
                        {formatDate(submission.createdAt)}
                      </Typography>
                    </Td>
                    <Td>
                      <Typography textColor="neutral600" ellipsis>
                        {getPreview(submission.data)}
                      </Typography>
                    </Td>
                    <Td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <Flex gap={1} justifyContent="flex-end">
                        <IconButton
                          label={formatMessage({
                            id: getTranslation('submissions.action.view'),
                            defaultMessage: 'View submission',
                          })}
                          onClick={() => handleViewSubmission(submission.documentId)}
                          variant="ghost"
                        >
                          <Eye />
                        </IconButton>
                        <IconButton
                          label={formatMessage({
                            id: getTranslation('submissions.action.delete'),
                            defaultMessage: 'Delete submission',
                          })}
                          onClick={() => setDeletingId(submission.documentId)}
                          variant="ghost"
                        >
                          <Trash />
                        </IconButton>
                      </Flex>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <Pagination.Root
              pageCount={pagination?.pageCount ?? 1}
              defaultPageSize={DEFAULT_PAGE_SIZE}
              total={pagination?.total ?? 0}
            >
              <Pagination.PageSize options={['10', '25', '50', '100']} />
              <Pagination.Links />
            </Pagination.Root>
          </>
        ) : (
          <EmptyStateLayout
            icon={<EmptyDocuments width="160px" />}
            content={
              status
                ? formatMessage(
                    {
                      id: getTranslation('submissions.empty.filtered'),
                      defaultMessage: 'No submissions with status "{status}" found.',
                    },
                    { status }
                  )
                : formatMessage({
                    id: getTranslation('submissions.empty'),
                    defaultMessage: 'This form has not received any submissions yet.',
                  })
            }
            action={
              status ? (
                <Button variant="secondary" onClick={() => handleStatusFilterChange('')}>
                  {formatMessage({
                    id: getTranslation('submissions.clearFilter'),
                    defaultMessage: 'Clear filter',
                  })}
                </Button>
              ) : null
            }
          />
        )}
      </Layouts.Content>

      {/* Single delete confirmation */}
      <Dialog.Root
        open={deletingId !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDeletingId(null);
          }
        }}
      >
        <ConfirmDialog onConfirm={handleDeleteConfirm} variant="danger-light" icon={<WarningCircle />}>
          {formatMessage({
            id: getTranslation('submissions.delete.confirm'),
            defaultMessage:
              'Are you sure you want to delete this submission? This action cannot be undone.',
          })}
        </ConfirmDialog>
      </Dialog.Root>

      {/* Bulk delete confirmation */}
      <Dialog.Root open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <ConfirmDialog onConfirm={handleBulkDeleteConfirm} variant="danger-light" icon={<WarningCircle />}>
          {formatMessage(
            {
              id: getTranslation('submissions.bulkDelete.confirm'),
              defaultMessage:
                'Are you sure you want to delete {count} submission(s)? This action cannot be undone.',
            },
            { count: selectedIds.length }
          )}
        </ConfirmDialog>
      </Dialog.Root>
    </Page.Main>
  );
};
