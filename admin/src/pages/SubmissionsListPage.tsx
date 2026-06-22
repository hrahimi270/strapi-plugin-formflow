import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
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
  TextInput,
  VisuallyHidden,
} from '@strapi/design-system';
import {
  Trash,
  Download,
  Eye,
  CheckCircle,
  Archive,
  CaretDown,
  WarningCircle,
  ChartCircle,
} from '@strapi/icons';
import { EmptyDocuments } from '@strapi/icons/symbols';
import {
  Page,
  Layouts,
  BackButton,
  Pagination,
  ConfirmDialog,
  useNotification,
  useQueryParams,
  useRBAC,
} from '@strapi/strapi/admin';

import { useSubmissions } from '../hooks/useSubmissions';
import { useForm } from '../hooks/useForm';
import { PLUGIN_ID } from '../pluginId';
import { getTranslation } from '../utils/getTranslation';
import { SUBMISSION_PERMISSIONS } from '../permissions';
import { StatusBadge } from '../components/shared/StatusBadge';
import { SubmissionStatus, ExportFormat, FormField, ScheduledExportConfig } from '../utils/api';
import { useLicense } from '../ee/hooks/useLicense';
import { ProBadge } from '../ee/components/ProBadge';

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
 * Sentinel value for the explicit "All" option in the status filter. Selecting
 * it clears the status filter (SingleSelectOption cannot use an empty `value`,
 * which the component reserves for its unselected/placeholder state).
 */
const ALL_STATUS_VALUE = 'all';

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
 *
 * Each data key is the field `name`; resolve it to the field's human-readable
 * `label` via the form's field definitions, falling back to the raw key when no
 * matching field is found (e.g. legacy data or a field removed from the form).
 */
/**
 * Render a stored value to a short preview string. File-field values are media
 * references ({ url, name, ... }) or arrays of them — show the file name(s)
 * rather than a raw JSON blob.
 */
const previewValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map(previewValue).join(', ');
  }
  if (value && typeof value === 'object') {
    const ref = value as { name?: unknown; url?: unknown };
    if (typeof ref.name === 'string') return ref.name;
    if (typeof ref.url === 'string') return ref.url;
    return JSON.stringify(value);
  }
  return String(value);
};

const getPreview = (data: Record<string, unknown>, fields?: FormField[]): string => {
  const labelByName = new Map((fields ?? []).map((f) => [f.name, f.label]));

  const entries = Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 2);

  if (entries.length === 0) {
    return '—';
  }

  return entries
    .map(([key, value]) => {
      const label = labelByName.get(key) || key;
      const strValue = previewValue(value);
      const truncated = strValue.length > 30 ? `${strValue.slice(0, 30)}...` : strValue;
      return `${label}: ${truncated}`;
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

  // License entitlement: advanced export (Excel/PDF/scheduled) is Pro-only.
  // Free-on-failure — outside the provider `can()` is false and the items lock.
  const { can } = useLicense();

  // Gate submission write/export actions. Super-admins pass all checks.
  const {
    allowedActions: { canUpdate, canDelete, canExport },
  } = useRBAC(SUBMISSION_PERMISSIONS);

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
    getScheduledExport,
    saveScheduledExport,
    removeScheduledExport,
  } = useSubmissions(formId, { page, pageSize, status });

  // Page changes flow through the URL; push them into the hook (no remount).
  // The hook already fetches the initial `page` from `initialQueryParams` on
  // mount, so skip the first run of this effect — otherwise it would call
  // `setPage(page)` with the same value, mutate the hook's query state, and
  // fire a redundant second fetch on every list load (and remount). Only
  // subsequent `page` changes (pagination clicks / URL edits) push through.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
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

  // Scheduled export (Pro). `scheduledConfig` is the saved schedule (or null);
  // the dialog fields are local until saved.
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduledConfig, setScheduledConfig] = useState<ScheduledExportConfig | null>(null);
  const [scheduleCron, setScheduleCron] = useState('0 8 * * 1');
  const [scheduleEmails, setScheduleEmails] = useState('');
  const [scheduleFormat, setScheduleFormat] = useState<'xlsx' | 'pdf' | 'csv'>('xlsx');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Load any saved schedule on mount when the user is entitled. Failures are
  // swallowed — an unentitled/empty state simply shows "No schedule configured".
  const canAdvancedExport = can('export.advanced');
  useEffect(() => {
    if (!canAdvancedExport) {
      return;
    }
    let cancelled = false;
    getScheduledExport()
      .then((config) => {
        if (!cancelled) {
          setScheduledConfig(config);
        }
      })
      .catch(() => {
        /* no saved schedule / not reachable — leave as null */
      });
    return () => {
      cancelled = true;
    };
  }, [canAdvancedExport, getScheduledExport]);

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

  const openScheduleDialog = () => {
    // Seed the dialog fields from the saved schedule when one exists.
    if (scheduledConfig) {
      setScheduleCron(scheduledConfig.cronExpression);
      setScheduleEmails(scheduledConfig.recipientEmails.join(', '));
      setScheduleFormat(scheduledConfig.format);
    }
    setScheduleDialogOpen(true);
  };

  const handleSaveSchedule = async () => {
    const recipientEmails = scheduleEmails
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);

    if (!scheduleCron.trim() || recipientEmails.length === 0) {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('submissions.export.error'),
          defaultMessage: 'Failed to export submissions',
        }),
      });
      return;
    }

    const config: ScheduledExportConfig = {
      cronExpression: scheduleCron.trim(),
      recipientEmails,
      format: scheduleFormat,
    };

    setIsSavingSchedule(true);
    try {
      await saveScheduledExport(config);
      setScheduledConfig(config);
      setScheduleDialogOpen(false);
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: getTranslation('submissions.export.schedule.active'),
          defaultMessage: 'Scheduled export active',
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
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleRemoveSchedule = async () => {
    setIsSavingSchedule(true);
    try {
      await removeScheduledExport();
      setScheduledConfig(null);
      setScheduleDialogOpen(false);
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: getTranslation('submissions.export.schedule.none'),
          defaultMessage: 'No schedule configured',
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
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleStatusFilterChange = (value: string | number) => {
    setSelectedIds([]);
    // `ALL_STATUS_VALUE` is the explicit "All" option (and the empty value used
    // by the SingleSelect's clear button); both clear the status filter.
    if (value && value !== ALL_STATUS_VALUE) {
      setQuery({ status: value as SubmissionStatus, page: '1' });
    } else {
      setQuery({ status: undefined, page: '1' });
    }
  };

  const handleViewSubmission = (documentId: string) => {
    navigate(`/plugins/${PLUGIN_ID}/submissions/${documentId}`);
  };

  // Analytics dashboard (Pro). The page is its own license-aware route; this is
  // the visible entry point. Disabled + ProBadge'd when not entitled.
  const canAnalytics = can('analytics');
  const handleViewAnalytics = () => {
    navigate(`/plugins/${PLUGIN_ID}/forms/${formId}/analytics`);
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
  // Row selection only matters if the user can act on the selection (bulk
  // status update or bulk delete). Hide it entirely for read-only viewers.
  const canSelect = canUpdate || canDelete;

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
        secondaryAction={
          canAnalytics ? (
            <Button variant="secondary" startIcon={<ChartCircle />} onClick={handleViewAnalytics}>
              {formatMessage({
                id: getTranslation('submissions.analytics'),
                defaultMessage: 'Analytics',
              })}
            </Button>
          ) : (
            <Button variant="secondary" startIcon={<ChartCircle />} disabled>
              <Flex gap={2} alignItems="center">
                {formatMessage({
                  id: getTranslation('submissions.analytics'),
                  defaultMessage: 'Analytics',
                })}
                <ProBadge tier="pro" />
              </Flex>
            </Button>
          )
        }
        primaryAction={
          canExport ? (
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
                {can('export.advanced') ? (
                  <>
                    <Menu.Item onSelect={() => handleExport('xlsx')}>
                      {formatMessage({
                        id: getTranslation('submissions.export.xlsx'),
                        defaultMessage: 'Export as Excel (.xlsx)',
                      })}
                    </Menu.Item>
                    <Menu.Item onSelect={() => handleExport('pdf')}>
                      {formatMessage({
                        id: getTranslation('submissions.export.pdf'),
                        defaultMessage: 'Export as PDF',
                      })}
                    </Menu.Item>
                    <Menu.Item onSelect={openScheduleDialog}>
                      {formatMessage({
                        id: getTranslation('submissions.export.schedule'),
                        defaultMessage: 'Schedule export…',
                      })}
                    </Menu.Item>
                  </>
                ) : (
                  <>
                    <Menu.Item disabled>
                      <Flex gap={2}>
                        {formatMessage({
                          id: getTranslation('submissions.export.xlsx'),
                          defaultMessage: 'Export as Excel (.xlsx)',
                        })}
                        <ProBadge tier="pro" />
                      </Flex>
                    </Menu.Item>
                    <Menu.Item disabled>
                      <Flex gap={2}>
                        {formatMessage({
                          id: getTranslation('submissions.export.pdf'),
                          defaultMessage: 'Export as PDF',
                        })}
                        <ProBadge tier="pro" />
                      </Flex>
                    </Menu.Item>
                  </>
                )}
              </Menu.Content>
            </Menu.Root>
          ) : null
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
              {canUpdate && (
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
              )}
              {canUpdate && (
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
              )}
              {canDelete && (
                <Button
                  variant="danger-light"
                  startIcon={<Trash />}
                  onClick={() => setBulkDeleteOpen(true)}
                  loading={isDeleting}
                >
                  {formatMessage({ id: getTranslation('common.delete'), defaultMessage: 'Delete' })}
                </Button>
              )}
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
                <SingleSelectOption value={ALL_STATUS_VALUE}>
                  {formatMessage({
                    id: getTranslation('submissions.filter.all'),
                    defaultMessage: 'All',
                  })}
                </SingleSelectOption>
                {STATUS_OPTIONS.map((option) => (
                  <SingleSelectOption key={option.value} value={option.value}>
                    {formatMessage({ id: option.labelId, defaultMessage: option.defaultLabel })}
                  </SingleSelectOption>
                ))}
              </SingleSelect>
            </Field.Root>

            {canExport && (
              <Field.Root name="include-ip">
                <Flex gap={2} alignItems="center" paddingBottom={2}>
                  <Switch
                    checked={includeIp}
                    onCheckedChange={(checked: boolean) => setIncludeIp(checked)}
                    onLabel={formatMessage({
                      id: getTranslation('common.on'),
                      defaultMessage: 'On',
                    })}
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
            )}
            </Flex>
          }
        />
      )}

      <Layouts.Content>
        {numberOfSubmissions > 0 ? (
          <>
            <Table
              colCount={5}
              rowCount={numberOfSubmissions + 1}
              aria-label={formatMessage({
                id: getTranslation('submissions.title'),
                defaultMessage: 'Submissions',
              })}
            >
              <Thead>
                <Tr>
                  <Th>
                    {canSelect ? (
                      <Checkbox
                        aria-label={formatMessage({
                          id: getTranslation('common.selectAll'),
                          defaultMessage: 'Select all entries',
                        })}
                        checked={isIndeterminate ? 'indeterminate' : isAllSelected}
                        onCheckedChange={toggleAll}
                      />
                    ) : null}
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
                      {canSelect ? (
                        <Checkbox
                          aria-label={`${formatMessage({
                            id: getTranslation('common.select'),
                            defaultMessage: 'Select',
                          })} ${submission.documentId}`}
                          checked={selectedIds.includes(submission.documentId)}
                          onCheckedChange={() => toggleSelection(submission.documentId)}
                        />
                      ) : null}
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
                        {getPreview(submission.data, form?.fields)}
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
                        {canDelete && (
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
                        )}
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

      {/* Scheduled export (Pro). Inline dialog — no separate page/component. */}
      <Dialog.Root open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <Dialog.Content>
          <Dialog.Header>
            {formatMessage({
              id: getTranslation('submissions.export.schedule.dialog.title'),
              defaultMessage: 'Schedule Export',
            })}
          </Dialog.Header>
          <Dialog.Body>
            <Flex direction="column" alignItems="stretch" gap={4} width="100%">
              <Typography variant="pi" textColor="neutral600">
                {scheduledConfig
                  ? formatMessage({
                      id: getTranslation('submissions.export.schedule.active'),
                      defaultMessage: 'Scheduled export active',
                    })
                  : formatMessage({
                      id: getTranslation('submissions.export.schedule.none'),
                      defaultMessage: 'No schedule configured',
                    })}
              </Typography>

              <Field.Root name="schedule-cron">
                <Field.Label>
                  {formatMessage({
                    id: getTranslation('submissions.export.schedule.cron'),
                    defaultMessage: 'Cron expression',
                  })}
                </Field.Label>
                <TextInput
                  value={scheduleCron}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setScheduleCron(e.target.value)
                  }
                  placeholder={formatMessage({
                    id: getTranslation('submissions.export.schedule.cron.placeholder'),
                    defaultMessage: '0 8 * * 1',
                  })}
                />
              </Field.Root>

              <Field.Root name="schedule-emails">
                <Field.Label>
                  {formatMessage({
                    id: getTranslation('submissions.export.schedule.emails'),
                    defaultMessage: 'Recipient email addresses (comma-separated)',
                  })}
                </Field.Label>
                <TextInput
                  value={scheduleEmails}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setScheduleEmails(e.target.value)
                  }
                  placeholder="alice@example.com, bob@example.com"
                />
              </Field.Root>

              <Field.Root name="schedule-format">
                <Field.Label>
                  {formatMessage({
                    id: getTranslation('submissions.export.schedule.format'),
                    defaultMessage: 'Export format',
                  })}
                </Field.Label>
                <SingleSelect
                  value={scheduleFormat}
                  onChange={(value: string | number) =>
                    setScheduleFormat(value as 'xlsx' | 'pdf' | 'csv')
                  }
                >
                  <SingleSelectOption value="xlsx">Excel (.xlsx)</SingleSelectOption>
                  <SingleSelectOption value="pdf">PDF</SingleSelectOption>
                  <SingleSelectOption value="csv">CSV</SingleSelectOption>
                </SingleSelect>
              </Field.Root>
            </Flex>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">
                {formatMessage({ id: getTranslation('common.cancel'), defaultMessage: 'Cancel' })}
              </Button>
            </Dialog.Cancel>
            <Flex gap={2}>
              {scheduledConfig && (
                <Button
                  variant="danger-light"
                  onClick={handleRemoveSchedule}
                  loading={isSavingSchedule}
                >
                  {formatMessage({
                    id: getTranslation('submissions.export.schedule.remove'),
                    defaultMessage: 'Remove schedule',
                  })}
                </Button>
              )}
              <Button onClick={handleSaveSchedule} loading={isSavingSchedule}>
                {formatMessage({
                  id: getTranslation('submissions.export.schedule.save'),
                  defaultMessage: 'Save schedule',
                })}
              </Button>
            </Flex>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Page.Main>
  );
};
