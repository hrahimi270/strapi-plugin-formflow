import { useEffect, useState, useCallback } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import {
  API,
  FormSubmission,
  SubmissionUpdatePayload,
  ApiResponse,
  SubmissionsQueryParams,
} from '../utils/api';

interface UseSubmissionsReturn {
  submissions: FormSubmission[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateSubmission: (documentId: string, data: SubmissionUpdatePayload) => Promise<FormSubmission>;
  deleteSubmission: (documentId: string) => Promise<void>;
  bulkDelete: (documentIds: string[]) => Promise<void>;
  markAsRead: (documentId: string) => Promise<FormSubmission>;
  markAsArchived: (documentId: string) => Promise<FormSubmission>;
}

/**
 * Hook for managing form submissions
 * Provides list, update, and delete operations
 */
export const useSubmissions = (
  formId: string,
  queryParams?: SubmissionsQueryParams
): UseSubmissionsReturn => {
  const { get, put, del } = useFetchClient();
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubmissions = useCallback(async () => {
    if (!formId) {
      setSubmissions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const queryString = queryParams
        ? `?${new URLSearchParams(
            Object.entries(queryParams)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, String(v)])
          ).toString()}`
        : '';

      const response = await get<ApiResponse<FormSubmission[]>>(
        `${API.submissions(formId)}${queryString}`
      );
      setSubmissions(response.data.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch submissions';
      setError(new Error(errorMessage));
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [get, formId, queryParams]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

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
      await del(API.submission(documentId));

      // Remove from local state
      setSubmissions((prev) => prev.filter((sub) => sub.documentId !== documentId));
    },
    [del]
  );

  const bulkDelete = useCallback(
    async (documentIds: string[]): Promise<void> => {
      // Delete in parallel
      await Promise.all(documentIds.map((id) => del(API.submission(id))));

      // Remove from local state
      setSubmissions((prev) => prev.filter((sub) => !documentIds.includes(sub.documentId)));
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

  return {
    submissions,
    isLoading,
    error,
    refetch: fetchSubmissions,
    updateSubmission,
    deleteSubmission,
    bulkDelete,
    markAsRead,
    markAsArchived,
  };
};
