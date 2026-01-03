import { useEffect, useState, useCallback, useMemo } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import {
  API,
  FormSubmission,
  SubmissionUpdatePayload,
  ApiResponse,
  SubmissionsQueryParams,
} from '../utils/api';

/**
 * Pagination metadata from API response
 */
interface PaginationMeta {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

/**
 * Paginated API response structure
 */
interface PaginatedResponse<T> {
  data: T;
  meta: {
    pagination: PaginationMeta;
  };
}

/**
 * Filter state for submissions
 */
interface SubmissionFilters {
  status?: 'new' | 'read' | 'processed' | 'archived' | 'spam';
}

interface UseSubmissionsReturn {
  submissions: FormSubmission[];
  pagination: PaginationMeta | null;
  isLoading: boolean;
  isDeleting: boolean;
  isExporting: boolean;
  error: Error | null;
  filters: SubmissionFilters;
  setFilters: (filters: SubmissionFilters) => void;
  setPage: (page: number) => void;
  refetch: () => Promise<void>;
  updateSubmission: (documentId: string, data: SubmissionUpdatePayload) => Promise<FormSubmission>;
  deleteSubmission: (documentId: string) => Promise<void>;
  bulkDelete: (documentIds: string[]) => Promise<{ deleted: number }>;
  markAsRead: (documentId: string) => Promise<FormSubmission>;
  markAsArchived: (documentId: string) => Promise<FormSubmission>;
  exportSubmissions: (format?: 'csv' | 'json', status?: string) => Promise<void>;
}

/**
 * Hook for managing form submissions with pagination, filtering, and export
 * Provides list, update, delete, and export operations
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
      const response = await put<ApiResponse<FormSubmission>>(API.submission(documentId), data);
      const updated = response.data.data;

      // Update local state
      setSubmissions((prev) => prev.map((sub) => (sub.documentId === documentId ? updated : sub)));

      return updated;
    },
    [put]
  );

  const deleteSubmission = useCallback(
    async (documentId: string): Promise<void> => {
      setIsDeleting(true);
      try {
        await del(API.submission(documentId));

        // Remove from local state
        setSubmissions((prev) => prev.filter((sub) => sub.documentId !== documentId));

        // Update pagination total
        setPagination((prev) =>
          prev
            ? {
                ...prev,
                total: prev.total - 1,
                pageCount: Math.ceil((prev.total - 1) / prev.pageSize),
              }
            : null
        );
      } finally {
        setIsDeleting(false);
      }
    },
    [del]
  );

  const bulkDelete = useCallback(
    async (documentIds: string[]): Promise<{ deleted: number }> => {
      if (documentIds.length === 0) {
        return { deleted: 0 };
      }

      setIsDeleting(true);
      try {
        // Delete each submission individually
        // Using Promise.all for parallel deletion
        await Promise.all(documentIds.map((id) => del(API.submission(id))));

        const deletedCount = documentIds.length;

        // Remove from local state
        setSubmissions((prev) => prev.filter((sub) => !documentIds.includes(sub.documentId)));

        // Update pagination
        setPagination((prev) =>
          prev
            ? {
                ...prev,
                total: prev.total - deletedCount,
                pageCount: Math.ceil((prev.total - deletedCount) / prev.pageSize),
              }
            : null
        );

        return { deleted: deletedCount };
      } finally {
        setIsDeleting(false);
      }
    },
    [del]
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
   * Export submissions as CSV or JSON
   * Triggers a file download in the browser
   */
  const exportSubmissions = useCallback(
    async (format: 'csv' | 'json' = 'csv', status?: string): Promise<void> => {
      setIsExporting(true);
      try {
        const params = new URLSearchParams();
        params.append('format', format);
        if (status) {
          params.append('status', status);
        }

        // Use the get function to fetch the export data as text
        const response = await get<string>(`${API.exportSubmissions(formId)}?${params.toString()}`);

        // Create blob from the response data
        const blob = new Blob([response.data], {
          type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
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
    [get, formId]
  );

  return {
    submissions,
    pagination,
    isLoading,
    isDeleting,
    isExporting,
    error,
    filters,
    setFilters,
    setPage,
    refetch: fetchSubmissions,
    updateSubmission,
    deleteSubmission,
    bulkDelete,
    markAsRead,
    markAsArchived,
    exportSubmissions,
  };
};
