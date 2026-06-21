import { useEffect, useState, useCallback, useRef } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import {
  API,
  Form,
  ApiResponse,
  PaginatedForms,
  PaginationMeta,
  FormsQueryParams,
} from '../utils/api';

export interface UseFormsReturn {
  forms: Form[];
  pagination: PaginationMeta | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  deleteForm: (documentId: string) => Promise<void>;
  duplicateForm: (documentId: string) => Promise<Form>;
}

/**
 * Stable serialization of query params so an inline-object argument
 * (e.g. `useForms({ page: 1 })`) does not trigger an endless refetch loop.
 */
const serializeParams = (params?: FormsQueryParams): string => {
  if (!params) {
    return '';
  }
  return JSON.stringify({
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    _q: params._q,
  });
};

const buildQueryString = (params?: FormsQueryParams): string => {
  if (!params) {
    return '';
  }
  const search = new URLSearchParams();
  if (params.page !== undefined) {
    search.append('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    search.append('pageSize', String(params.pageSize));
  }
  if (params.sort) {
    search.append('sort', params.sort);
  }
  if (params._q) {
    search.append('_q', params._q);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

/**
 * Hook for managing the forms list
 * Provides CRUD operations and state management for forms.
 *
 * Accepts optional query params (page/pageSize/sort/_q). Pagination meta is
 * exposed via `pagination` when the server returns it. The `forms` array is
 * always returned (backward-compatible).
 */
export const useForms = (queryParams?: FormsQueryParams): UseFormsReturn => {
  const { get, post, del } = useFetchClient();
  const [forms, setForms] = useState<Form[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize params by value so callers can pass inline objects without
  // re-triggering the fetch effect on every render.
  const paramsKey = serializeParams(queryParams);
  const paramsRef = useRef(queryParams);
  paramsRef.current = queryParams;

  const fetchForms = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const queryString = buildQueryString(paramsRef.current);
      const response = await get<PaginatedForms | ApiResponse<Form[]>>(
        `${API.forms}${queryString}`
      );

      setForms(response.data.data);
      // Tolerate both paginated (`meta.pagination`) and plain responses.
      const meta = (response.data as PaginatedForms).meta;
      setPagination(meta?.pagination ?? null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch forms';
      setError(new Error(errorMessage));
      setForms([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [get, paramsKey]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const deleteForm = useCallback(
    async (documentId: string) => {
      await del(API.form(documentId));
      // Optimistically update the local state
      setForms((prev) => prev.filter((form) => form.documentId !== documentId));
      setPagination((prev) =>
        prev
          ? {
              ...prev,
              total: Math.max(0, prev.total - 1),
              pageCount: Math.max(1, Math.ceil(Math.max(0, prev.total - 1) / prev.pageSize)),
            }
          : null
      );
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
    pagination,
    isLoading,
    error,
    refetch: fetchForms,
    deleteForm,
    duplicateForm,
  };
};
