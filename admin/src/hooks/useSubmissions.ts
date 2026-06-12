import { useEffect, useState, useCallback, useMemo } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import {
  API,
  rawRequest,
  FormSubmission,
  SubmissionUpdatePayload,
  SubmissionStatus,
  ApiResponse,
  PaginatedResponse,
  PaginationMeta,
  SubmissionsQueryParams,
  ExportFormat,
  ExportOptions,
} from '../utils/api';

/**
 * Filter state for submissions
 */
export interface SubmissionFilters {
  status?: SubmissionStatus;
}

/**
 * Response payload from the batch delete endpoint
 */
export interface BulkDeleteResult {
  deleted: number;
}

export interface UseSubmissionsReturn {
  submissions: FormSubmission[];
  pagination: PaginationMeta | null;
  isLoading: boolean;
  isDeleting: boolean;
  isUpdating: boolean;
  isExporting: boolean;
  error: Error | null;
  filters: SubmissionFilters;
  setFilters: (filters: SubmissionFilters) => void;
  setPage: (page: number) => void;
  refetch: () => Promise<void>;
  updateSubmission: (documentId: string, data: SubmissionUpdatePayload) => Promise<FormSubmission>;
  deleteSubmission: (documentId: string) => Promise<void>;
  bulkDelete: (documentIds: string[]) => Promise<BulkDeleteResult>;
  bulkUpdateStatus: (documentIds: string[], status: SubmissionStatus) => Promise<FormSubmission[]>;
  markAsRead: (documentId: string) => Promise<FormSubmission>;
  markAsArchived: (documentId: string) => Promise<FormSubmission>;
  exportSubmissions: (
    format?: ExportFormat,
    status?: SubmissionStatus,
    options?: { includeIp?: boolean }
  ) => Promise<void>;
}

/**
 * Hook for managing form submissions with pagination, filtering, and export.
 * Provides list, update, delete, bulk, and export operations.
 */
export const useSubmissions = (
  formId: string,
  initialQueryParams?: SubmissionsQueryParams
): UseSubmissionsReturn => {
  const { get, put, del } = useFetchClient();
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Internal query state
  const [queryParams, setQueryParams] = useState<SubmissionsQueryParams>(
    initialQueryParams || { page: 1, pageSize: 25 }
  );

  // Memoized filters for external access
  const filters = useMemo<SubmissionFilters>(
    () => ({
      status: queryParams.status,
    }),
    [queryParams.status]
  );

  const fetchSubmissions = useCallback(async () => {
    if (!formId) {
      setSubmissions([]);
      setPagination(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (queryParams.page) {
        params.append('page', String(queryParams.page));
      }
      if (queryParams.pageSize) {
        params.append('pageSize', String(queryParams.pageSize));
      }
      if (queryParams.status) {
        params.append('status', queryParams.status);
      }
      if (queryParams.sort) {
        params.append('sort', queryParams.sort);
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';

      const response = await get<PaginatedResponse<FormSubmission[]>>(
        `${API.submissions(formId)}${queryString}`
      );

      setSubmissions(response.data.data);
      setPagination(response.data.meta?.pagination || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch submissions';
      setError(new Error(errorMessage));
      setSubmissions([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [get, formId, queryParams]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Set filters and reset to page 1
  const setFilters = useCallback((newFilters: SubmissionFilters) => {
    setQueryParams((prev) => ({
      ...prev,
      ...newFilters,
      page: 1, // Reset to first page when filters change
    }));
  }, []);

  // Set page number
  const setPage = useCallback((page: number) => {
    setQueryParams((prev) => ({
      ...prev,
      page,
    }));
  }, []);

  const updateSubmission = useCallback(
    async (documentId: string, data: SubmissionUpdatePayload): Promise<FormSubmission> => {
      setIsUpdating(true);
      try {
        const response = await put<ApiResponse<FormSubmission>>(API.submission(documentId), data);
        const updated = response.data.data;

        // Update local state
        setSubmissions((prev) =>
          prev.map((sub) => (sub.documentId === documentId ? updated : sub))
        );

        return updated;
      } finally {
        setIsUpdating(false);
      }
    },
    [put]
  );

  /**
   * Recompute pagination after `removed` rows are deleted, and—when the current
   * page has been emptied and is not the first page—step back one page so the
   * user is not left staring at an empty list.
   *
   * @param removed         Number of rows that were deleted.
   * @param remainingOnPage Number of rows still rendered on the current page
   *                        after the deletion (used to decide the page step-back).
   */
  const reconcileAfterDelete = useCallback((removed: number, remainingOnPage: number) => {
    setPagination((prev) => {
      if (!prev) {
        return null;
      }
      const total = Math.max(0, prev.total - removed);
      return {
        ...prev,
        total,
        pageCount: Math.max(1, Math.ceil(total / prev.pageSize)),
      };
    });

    // If the page is now empty and we are not on the first page, go back one.
    // Changing `page` triggers a refetch of the previous page.
    if (remainingOnPage === 0) {
      setQueryParams((prev) => {
        const currentPage = prev.page ?? 1;
        return currentPage > 1 ? { ...prev, page: currentPage - 1 } : prev;
      });
    }
  }, []);

  const deleteSubmission = useCallback(
    async (documentId: string): Promise<void> => {
      setIsDeleting(true);
      try {
        await del(API.submission(documentId));

        // Compute the remaining-on-page count from the currently rendered list
        // (snapshot in scope) so the page step-back decision does not depend on
        // setState timing.
        const remaining = submissions.filter((sub) => sub.documentId !== documentId).length;

        setSubmissions((prev) => prev.filter((sub) => sub.documentId !== documentId));
        reconcileAfterDelete(1, remaining);
      } finally {
        setIsDeleting(false);
      }
    },
    [del, submissions, reconcileAfterDelete]
  );

  const bulkDelete = useCallback(
    async (documentIds: string[]): Promise<BulkDeleteResult> => {
      if (documentIds.length === 0) {
        return { deleted: 0 };
      }

      setIsDeleting(true);
      try {
        // Single batch request to the server's deleteMany endpoint.
        // `useFetchClient`'s `del` cannot carry a request body, so use the
        // native-fetch helper which sends `{ ids }` as the DELETE payload.
        const response = await rawRequest(API.submissions(formId), {
          method: 'DELETE',
          body: { ids: documentIds },
        });

        if (!response.ok) {
          throw new Error('Failed to delete submissions');
        }

        let deletedCount = documentIds.length;
        try {
          const parsed = JSON.parse(response.text) as ApiResponse<{ deleted?: number }>;
          if (typeof parsed?.data?.deleted === 'number') {
            deletedCount = parsed.data.deleted;
          }
        } catch {
          // Fall back to the requested count if the body is not JSON.
        }

        // Compute remaining-on-page from the rendered list snapshot.
        const idSet = new Set(documentIds);
        const remaining = submissions.filter((sub) => !idSet.has(sub.documentId)).length;

        setSubmissions((prev) => prev.filter((sub) => !idSet.has(sub.documentId)));
        reconcileAfterDelete(deletedCount, remaining);

        return { deleted: deletedCount };
      } finally {
        setIsDeleting(false);
      }
    },
    [formId, submissions, reconcileAfterDelete]
  );

  const bulkUpdateStatus = useCallback(
    async (documentIds: string[], status: SubmissionStatus): Promise<FormSubmission[]> => {
      if (documentIds.length === 0) {
        return [];
      }

      setIsUpdating(true);
      try {
        // No batch status endpoint on the server; update per-item.
        const updated = await Promise.all(
          documentIds.map(async (id) => {
            const response = await put<ApiResponse<FormSubmission>>(API.submission(id), { status });
            return response.data.data;
          })
        );

        const updatedById = new Map(updated.map((s) => [s.documentId, s]));
        setSubmissions((prev) => prev.map((sub) => updatedById.get(sub.documentId) ?? sub));

        return updated;
      } finally {
        setIsUpdating(false);
      }
    },
    [put]
  );

  const markAsRead = useCallback(
    async (documentId: string): Promise<FormSubmission> => {
      return updateSubmission(documentId, { status: 'read' });
    },
    [updateSubmission]
  );

  const markAsArchived = useCallback(
    async (documentId: string): Promise<FormSubmission> => {
      return updateSubmission(documentId, { status: 'archived' });
    },
    [updateSubmission]
  );

  /**
   * Export submissions as CSV or JSON. Triggers a file download in the browser.
   *
   * The export endpoint returns a raw text/csv (or JSON text) body, so the
   * request asks for a `text` response type and builds the Blob from the
   * returned string rather than letting the fetch client parse JSON.
   */
  const exportSubmissions = useCallback(
    async (
      format: ExportFormat = 'csv',
      status?: SubmissionStatus,
      options?: { includeIp?: boolean }
    ): Promise<void> => {
      setIsExporting(true);
      try {
        const params = new URLSearchParams();
        params.append('format', format);
        if (status) {
          params.append('status', status);
        }
        if (options?.includeIp) {
          params.append('includeIp', 'true');
        }

        const accept = format === 'csv' ? 'text/csv' : 'application/json';

        // `useFetchClient` always JSON-parses the response body, which would
        // discard a `text/csv` export, so request the raw text via native fetch.
        const response = await rawRequest(
          `${API.exportSubmissions(formId)}?${params.toString()}`,
          {
            method: 'GET',
            accept,
          }
        );

        if (!response.ok) {
          throw new Error('Failed to export submissions');
        }

        const body = response.text;

        const blob = new Blob([body], {
          type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
        });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const date = new Date().toISOString().split('T')[0];
        link.download = `submissions-${date}.${format}`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } finally {
        setIsExporting(false);
      }
    },
    [formId]
  );

  return {
    submissions,
    pagination,
    isLoading,
    isDeleting,
    isUpdating,
    isExporting,
    error,
    filters,
    setFilters,
    setPage,
    refetch: fetchSubmissions,
    updateSubmission,
    deleteSubmission,
    bulkDelete,
    bulkUpdateStatus,
    markAsRead,
    markAsArchived,
    exportSubmissions,
  };
};

// Re-export so consumers can type export options if they construct them externally.
export type { ExportOptions };
