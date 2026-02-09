import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { useNotification } from '@strapi/strapi/admin';
import {
  Main,
  Box,
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
  Loader,
  Pagination,
  PreviousLink,
  NextLink,
  PageLink,
  Dots,
} from '@strapi/design-system';
import { ArrowLeft, Trash, Download, Eye } from '@strapi/icons';

import { useSubmissions } from '../hooks/useSubmissions';
import { useForm } from '../hooks/useForm';
import { PLUGIN_ID } from '../pluginId';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { StatusBadge } from '../components/shared/StatusBadge';
import EmptyState from '../components/shared/EmptyState';
import { SubmissionStatus } from '../utils/api';

/**
 * Status options for the filter dropdown
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
 * Get a preview of submission data (first 2 fields)
 */
const getPreview = (data: Record<string, unknown>): string => {
  const entries = Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 2);

  if (entries.length === 0) {
    return 'No data';
  }

  return entries
    .map(([key, value]) => {
      const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const truncated = strValue.length > 30 ? `${strValue.slice(0, 30)}...` : strValue;
      return `${key}: ${truncated}`;
    })
    .join(' | ');
};

/**
 * Generate pagination page numbers with ellipsis
 */
const generatePageNumbers = (currentPage: number, pageCount: number): (number | 'dots')[] => {
  const pages: (number | 'dots')[] = [];
  const delta = 2;

  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || (i >= currentPage - delta && i <= currentPage + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'dots') {
      pages.push('dots');
    }
  }

  return pages;
};

export const SubmissionsListPage = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();

  // Fetch form details
  const { form, isLoading: isLoadingForm } = useForm(formId);

  // Fetch submissions with pagination
  const {
    submissions,
    pagination,
    isLoading,
    isDeleting,
    isExporting,
    error,
    filters,
    setFilters,
    setPage,
    deleteSubmission,
    bulkDelete,
    exportSubmissions,
    refetch,
  } = useSubmissions(formId!);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Toggle single selection
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // Toggle all selections on current page
  const toggleAll = () => {
    if (selectedIds.length === submissions.length && submissions.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(submissions.map((s) => s.documentId));
    }
  };

  // Handle single delete
  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      await deleteSubmission(deletingId);
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: 'strapi-forms.submissions.delete.success',
          defaultMessage: 'Submission deleted successfully',
        }),
      });
      setSelectedIds((prev) => prev.filter((id) => id !== deletingId));
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: 'strapi-forms.submissions.delete.error',
          defaultMessage: 'Failed to delete submission',
        }),
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  // Handle bulk delete
  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;

    try {
      const result = await bulkDelete(selectedIds);
      toggleNotification({
        type: 'success',
        message: formatMessage(
          {
            id: 'strapi-forms.submissions.bulkDelete.success',
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
          id: 'strapi-forms.submissions.bulkDelete.error',
          defaultMessage: 'Failed to delete submissions',
        }),
      });
    } finally {
      setBulkDeleteDialogOpen(false);
    }
  };

  // Handle export
  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    try {
      await exportSubmissions(format, filters.status);
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: 'strapi-forms.submissions.export.success',
          defaultMessage: 'Export started',
        }),
      });
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: 'strapi-forms.submissions.export.error',
          defaultMessage: 'Failed to export submissions',
        }),
      });
    }
  };

  // Handle status filter change
  const handleStatusFilterChange = (value: string | number) => {
    setFilters({ status: (value as SubmissionStatus) || undefined });
    setSelectedIds([]); // Clear selection when filter changes
  };

  // Clear status filter
  const handleClearStatusFilter = () => {
    setFilters({ status: undefined });
    setSelectedIds([]);
  };

  // Navigate to submission detail
  const handleViewSubmission = (documentId: string) => {
    navigate(`/plugins/${PLUGIN_ID}/submissions/${documentId}`);
  };

  // Navigate back to forms
  const handleBack = () => {
    navigate(`/plugins/${PLUGIN_ID}`);
  };

  // Loading state
  if (isLoading && submissions.length === 0) {
    return (
      <Main>
        <Box padding={8}>
          <Flex justifyContent="center" alignItems="center" minHeight="400px">
            <Loader>Loading submissions...</Loader>
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
            text="Error loading submissions"
            buttonText='Try again'
            // description={error.message}
            action={() => refetch()}
            // action={
            //   <Button onClick={() => refetch()} variant="secondary">
            //     Try again
            //   </Button>
            // }
          />
        </Box>
      </Main>
    );
  }

  const isAllSelected = selectedIds.length === submissions.length && submissions.length > 0;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < submissions.length;

  return (
    <Main>
      {/* Header */}
      <Box padding={8} background="neutral100">
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap={4}>
            <IconButton label="Back to forms" onClick={handleBack} variant="tertiary" withTooltip={false}>
              <ArrowLeft />
            </IconButton>
            <Box>
              <Typography variant="alpha" as="h1">
                Submissions
              </Typography>
              <Typography variant="epsilon" textColor="neutral600">
                {isLoadingForm ? 'Loading...' : form?.title || 'Unknown form'}
              </Typography>
            </Box>
          </Flex>
          <Flex gap={2}>
            <Button
              variant="secondary"
              startIcon={<Download />}
              onClick={() => handleExport('csv')}
              loading={isExporting}
              disabled={submissions.length === 0}
            >
              Export CSV
            </Button>
          </Flex>
        </Flex>
      </Box>

      {/* Filters and Bulk Actions */}
      <Box padding={8}>
        <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
          <Flex gap={4} alignItems="center">
            <SingleSelect
              placeholder="Filter by status"
              value={filters.status || ''}
              onChange={handleStatusFilterChange}
              onClear={handleClearStatusFilter}
            >
              {STATUS_OPTIONS.map((option) => (
                <SingleSelectOption key={option.value} value={option.value}>
                  {option.label}
                </SingleSelectOption>
              ))}
            </SingleSelect>

            {pagination && (
              <Typography textColor="neutral600" variant="pi">
                {pagination.total} submission{pagination.total !== 1 ? 's' : ''}
              </Typography>
            )}
          </Flex>

          {selectedIds.length > 0 && (
            <Flex gap={2} alignItems="center">
              <Typography textColor="neutral600">{selectedIds.length} selected</Typography>
              <Button
                variant="danger-light"
                startIcon={<Trash />}
                onClick={() => setBulkDeleteDialogOpen(true)}
                loading={isDeleting}
              >
                Delete selected
              </Button>
            </Flex>
          )}
        </Flex>

        {/* Empty state */}
        {submissions.length === 0 ? (
          <EmptyState
            text="No submissions yet"
            buttonText='Clear filter'
            // description={
            //   filters.status
            //     ? `No submissions with status "${filters.status}" found.`
            //     : 'This form has not received any submissions yet.'
            // }
            action={handleClearStatusFilter}
            // action={
            //   filters.status ? (
            //     <Button onClick={handleClearStatusFilter} variant="secondary">
            //       Clear filter
            //     </Button>
            //   ) : undefined
            // }
          />
        ) : (
          <>
            {/* Submissions Table */}
            <Table colCount={5} rowCount={submissions.length}>
              <Thead>
                <Tr>
                  <Th>
                    <Checkbox
                      aria-label="Select all"
                      checked={isAllSelected}
                      indeterminate={isIndeterminate}
                      onCheckedChange={toggleAll}
                    />
                  </Th>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      Status
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      Submitted
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      Preview
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      Actions
                    </Typography>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {submissions.map((submission) => (
                  <Tr key={submission.documentId}>
                    <Td>
                      <Checkbox
                        aria-label={`Select submission ${submission.documentId}`}
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
                    <Td>
                      <Flex gap={1}>
                        <IconButton
                          label="View submission"
                          onClick={() => handleViewSubmission(submission.documentId)}
                          variant="ghost"
                          withTooltip={false}
                        >
                          <Eye />
                        </IconButton>
                        <IconButton
                          label="Delete submission"
                          onClick={() => {
                            setDeletingId(submission.documentId);
                            setDeleteDialogOpen(true);
                          }}
                          variant="ghost"
                          withTooltip={false}
                        >
                          <Trash />
                        </IconButton>
                      </Flex>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            {/* Pagination */}
            {pagination && pagination.pageCount > 1 && (
              <Box marginTop={4}>
                <Flex justifyContent="space-between" alignItems="center">
                  <Typography textColor="neutral600" variant="pi">
                    Page {pagination.page} of {pagination.pageCount}
                  </Typography>
                  <Pagination activePage={pagination.page} pageCount={pagination.pageCount}>
                    <PreviousLink
                      onClick={() => setPage(Math.max(1, pagination.page - 1))}
                      disabled={pagination.page <= 1}
                    >
                      Previous
                    </PreviousLink>
                    {generatePageNumbers(pagination.page, pagination.pageCount).map(
                      (page, index) =>
                        page === 'dots' ? (
                          <Dots key={`dots-${index}`} />
                        ) : (
                          <PageLink key={page} number={page} onClick={() => setPage(page)}>
                            {page}
                          </PageLink>
                        )
                    )}
                    <NextLink
                      onClick={() => setPage(Math.min(pagination.pageCount, pagination.page + 1))}
                      disabled={pagination.page >= pagination.pageCount}
                    >
                      Next
                    </NextLink>
                  </Pagination>
                </Flex>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Single Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingId(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Submission"
        message="Are you sure you want to delete this submission? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isConfirming={isDeleting}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title="Delete Submissions"
        message={`Are you sure you want to delete ${selectedIds.length} submission(s)? This action cannot be undone.`}
        confirmLabel="Delete All"
        variant="danger"
        isConfirming={isDeleting}
      />
    </Main>
  );
};
