import { useEffect, useState, useCallback } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { API, Form, ApiResponse, FormsQueryParams } from '../utils/api';

interface UseFormsReturn {
  forms: Form[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  deleteForm: (documentId: string) => Promise<void>;
  duplicateForm: (documentId: string) => Promise<Form>;
}

/**
 * Hook for managing the forms list
 * Provides CRUD operations and state management for forms
 */
export const useForms = (queryParams?: FormsQueryParams): UseFormsReturn => {
  const { get, post, del } = useFetchClient();
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchForms = useCallback(async () => {
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

      const response = await get<ApiResponse<Form[]>>(`${API.forms}${queryString}`);
      setForms(response.data.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch forms';
      setError(new Error(errorMessage));
      setForms([]);
    } finally {
      setIsLoading(false);
    }
  }, [get, queryParams]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const deleteForm = useCallback(
    async (documentId: string) => {
      await del(API.form(documentId));
      // Optimistically update the local state
      setForms((prev) => prev.filter((form) => form.documentId !== documentId));
    },
    [del]
  );

  const duplicateForm = useCallback(
    async (documentId: string): Promise<Form> => {
      const response = await post<ApiResponse<Form>>(API.duplicateForm(documentId), {});
      const newForm = response.data.data;
      // Add the new form to the local state
      setForms((prev) => [newForm, ...prev]);
      return newForm;
    },
    [post]
  );

  return {
    forms,
    isLoading,
    error,
    refetch: fetchForms,
    deleteForm,
    duplicateForm,
  };
};
