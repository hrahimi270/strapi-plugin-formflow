import { useEffect, useState, useCallback, useMemo } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { API, FieldType, ApiResponse } from '../utils/api';

export interface UseFieldTypesReturn {
  fieldTypes: FieldType[];
  fieldTypesByCategory: Record<string, FieldType[]>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getFieldType: (type: string) => FieldType | undefined;
}

/**
 * Hook for fetching and managing field types
 * Used by the form builder to display available field types
 */
export const useFieldTypes = (): UseFieldTypesReturn => {
  const { get } = useFetchClient();
  const [fieldTypes, setFieldTypes] = useState<FieldType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFieldTypes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await get<ApiResponse<FieldType[]>>(API.fieldTypes);
      setFieldTypes(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch field types';
      setError(new Error(errorMessage));
      setFieldTypes([]);
    } finally {
      setIsLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchFieldTypes();
  }, [fetchFieldTypes]);

  /**
   * Group field types by category for the field type selector
   */
  const fieldTypesByCategory = useMemo(() => {
    return fieldTypes.reduce(
      (acc, fieldType) => {
        const category = fieldType.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(fieldType);
        return acc;
      },
      {} as Record<string, FieldType[]>
    );
  }, [fieldTypes]);

  /**
   * Get a specific field type by its type name
   */
  const getFieldType = useCallback(
    (type: string): FieldType | undefined => {
      return fieldTypes.find((ft) => ft.type === type);
    },
    [fieldTypes]
  );

  return {
    fieldTypes,
    fieldTypesByCategory,
    isLoading,
    error,
    refetch: fetchFieldTypes,
    getFieldType,
  };
};
