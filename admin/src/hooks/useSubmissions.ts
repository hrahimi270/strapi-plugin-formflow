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
  ScheduledExportConfig,
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
  getScheduledExport: () => Promise<ScheduledExportConfig | null>;
  saveScheduledExport: (config: ScheduledExportConfig) => Promise<void>;
  removeScheduledExport: () => Promise<void>;
}

/**
 * Hook for managing form submissions with pagination, filtering, and export.
 * Provides list, update, delete, bulk, and export operations.
 */
export const useSubmissions = (
  formId: string,
  initialQueryParams?: SubmissionsQueryParams
): UseSubmissionsReturn => {
  const { get, post, put, del } = useFetchClient();
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
   * Recompute pagination counts after `removed` rows are deleted.
   *
   * This deliberately does NOT touch the current page. The URL (owned by the
   * page component) is the single source of truth for the page number, and it
   * is responsible for stepping back when a non-first page is emptied — driving
   * a refetch through `setPage`. Mutating `page` here as well caused a
   * double-decrement.
   *
   * @param removed Number of rows that were deleted.
   */
  const reconcileAfterDelete = useCallback((removed: number) => {
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
  }, []);

  const deleteSubmission = useCallback(
    async (documentId: string): Promise<void> => {
      setIsDeleting(true);
      try {
        await del(API.submission(documentId));

        setSubmissions((prev) => prev.filter((sub) => sub.documentId !== documentId));
        reconcileAfterDelete(1);
      } finally {
        setIsDeleting(false);
      }
    },
    [del, reconcileAfterDelete]
  );

  const bulkDelete = useCallback(
    async (documentIds: string[]): Promise<BulkDeleteResult> => {
      if (documentIds.length === 0) {
        return { deleted: 0 };
      }

      setIsDeleting(true);
      try {
        // Single batch request to the server's bulk-delete endpoint. This is a
        // POST (not DELETE) because Koa does not parse a DELETE request body, so
        // `{ ids }` must travel as a POST payload. Going through `useFetchClient`'s
        // `post` also routes this through Strapi's auth/refresh lifecycle.
        const response = await post<ApiResponse<{ success?: boolean; deleted?: number }>>(
          API.bulkDeleteSubmissions(formId),
          { ids: documentIds }
        );

        const reported = response.data?.data?.deleted;
        const deletedCount = typeof reported === 'number' ? reported : documentIds.length;

        const idSet = new Set(documentIds);
        setSubmissions((prev) => prev.filter((sub) => !idSet.has(sub.documentId)));
        reconcileAfterDelete(deletedCount);

        return { deleted: deletedCount };
      } finally {
        setIsDeleting(false);
      }
    },
    [post, formId, reconcileAfterDelete]
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
   * The export endpoint returns a raw text/csv (or JSON text) body. We must use
   * `rawRequest` here rather than `useFetchClient`: the latter always calls
   * `response.json()` and, for a `text/csv` body, swallows the resulting
   * SyntaxError and returns `data: []` — discarding the export. It also exposes
   * no `responseType`/`text` option (see {@link rawRequest}). The trade-off is
   * that `rawRequest` does not share Strapi's 401-refresh lifecycle, so an
   * expired token surfaces a clear "session expired, reload" error here.
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

        const accept =
          format === 'csv'
            ? 'text/csv'
            : format === 'xlsx'
              ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              : format === 'pdf'
                ? 'application/pdf'
                : 'application/json';

        // xlsx/pdf are binary and must be read as a Blob (reading them as text
        // corrupts the bytes); csv/json are text. `useFetchClient` always
        // JSON-parses the body, which would discard a text/csv or binary export,
        // so go through `rawRequest`. It throws on a non-ok response (the
        // server's message — including the 402 upsell — or a clear "session
        // expired" message on a 401 token-expiry).
        const isBinary = format === 'xlsx' || format === 'pdf';
        const response = await rawRequest(
          `${API.exportSubmissions(formId)}?${params.toString()}`,
          {
            method: 'GET',
            accept,
            responseType: isBinary ? 'blob' : 'text',
          }
        );

        const blob =
          isBinary && response.blob
            ? response.blob
            : new Blob([response.text], {
                type:
                  format === 'csv'
                    ? 'text/csv;charset=utf-8'
                    : 'application/json;charset=utf-8',
              });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Include the status (and form id) in the filename so exports of
        // different status filters (e.g. "spam" vs "new") do not overwrite each
        // other in the browser's downloads folder.
        const date = new Date().toISOString().split('T')[0];
        const statusPart = status ?? 'all';
        const formPart = formId ? `${formId}-` : '';
        link.download = `submissions-${formPart}${statusPart}-${date}.${format}`;

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

  /**
   * Read the form's active scheduled-export config (Pro feature). Returns null
   * when no schedule is saved. Not gated client-side — the server allows reading.
   */
  const getScheduledExport = useCallback(async (): Promise<ScheduledExportConfig | null> => {
    const { data } = await get<{ data: ScheduledExportConfig | null }>(
      API.scheduleExport(formId)
    );
    return data.data ?? null;
  }, [formId, get]);

  /**
   * Save (create/replace) the form's scheduled-export config. The server gates
   * this behind `export.advanced` and returns 402 when unentitled.
   */
  const saveScheduledExport = useCallback(
    async (config: ScheduledExportConfig): Promise<void> => {
      await post(API.scheduleExport(formId), config);
    },
    [formId, post]
  );

  /** Remove the form's scheduled-export config and its cron entry. */
  const removeScheduledExport = useCallback(async (): Promise<void> => {
    await del(API.scheduleExport(formId));
  }, [formId, del]);

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
    getScheduledExport,
    saveScheduledExport,
    removeScheduledExport,
  };
};

// Re-export so consumers can type export options if they construct them externally.
export type { ExportOptions };
