import { useEffect, useState, useCallback } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import {
  API,
  FormSubmissionDetail,
  SubmissionStatus,
  ApiResponse,
} from '../utils/api';

export interface UseSubmissionReturn {
  submission: FormSubmissionDetail | null;
  isLoading: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateStatus: (status: SubmissionStatus) => Promise<FormSubmissionDetail>;
  deleteSubmission: () => Promise<void>;
}

/**
 * Hook for managing a single submission (detail view).
 *
 * Fetches the submission via GET /strapi-forms/submissions/:id, updates its
 * status via PUT, and deletes it via DELETE. Replaces the inline fetch logic
 * previously living in the submission detail page.
 */
export const useSubmission = (documentId?: string): UseSubmissionReturn => {
  const { get, put, del } = useFetchClient();
  const [submission, setSubmission] = useState<FormSubmissionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubmission = useCallback(async () => {
    if (!documentId) {
      setSubmission(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await get<ApiResponse<FormSubmissionDetail>>(API.submission(documentId));
      setSubmission(response.data.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch submission';
      setError(new Error(errorMessage));
      setSubmission(null);
    } finally {
      setIsLoading(false);
    }
  }, [get, documentId]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  const updateStatus = useCallback(
    async (status: SubmissionStatus): Promise<FormSubmissionDetail> => {
      if (!documentId) {
        throw new Error('Cannot update submission without a documentId');
      }

      setIsUpdating(true);
      try {
        const response = await put<ApiResponse<FormSubmissionDetail>>(API.submission(documentId), {
          status,
        });
        const updated = response.data.data;
        setSubmission(updated);
        return updated;
      } finally {
        setIsUpdating(false);
      }
    },
    [put, documentId]
  );

  const deleteSubmission = useCallback(async (): Promise<void> => {
    if (!documentId) {
      throw new Error('Cannot delete submission without a documentId');
    }

    setIsDeleting(true);
    try {
      await del(API.submission(documentId));
      setSubmission(null);
    } finally {
      setIsDeleting(false);
    }
  }, [del, documentId]);

  return {
    submission,
    isLoading,
    isUpdating,
    isDeleting,
    error,
    refetch: fetchSubmission,
    updateStatus,
    deleteSubmission,
  };
};
