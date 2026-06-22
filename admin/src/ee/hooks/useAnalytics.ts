/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import { useState, useEffect } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';

import { API } from '../../utils/api';

export interface AnalyticsStats {
  views: number;
  starts: number;
  completions: number;
  drop_offs: number;
  conversionRate: number;
}

export interface UseAnalyticsResult {
  stats: AnalyticsStats | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetch aggregated analytics for a form from `GET /formflow/forms/:id/analytics`.
 *
 * The server Pro-gates this endpoint with a 402. A 402 is NOT surfaced as an
 * error here — the caller decides display via `can('analytics')` and renders the
 * UpsellCard — so on 402 we leave both `stats` and `error` null. Any other
 * failure sets `error` to a message string.
 */
export const useAnalytics = (formDocumentId: string): UseAnalyticsResult => {
  const { get } = useFetchClient();
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      if (!formDocumentId) {
        setStats(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await get<{ data: AnalyticsStats }>(API.formAnalytics(formDocumentId));
        if (!cancelled) {
          setStats(response.data.data);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        const fetchErr = err as {
          status?: number;
          response?: { status?: number; data?: { error?: { status?: number } } };
        };
        const status =
          fetchErr?.response?.data?.error?.status ??
          fetchErr?.response?.status ??
          fetchErr?.status;

        // 402 = unentitled. The caller renders an UpsellCard, not an error state.
        if (status === 402) {
          setStats(null);
          setError(null);
        } else {
          setStats(null);
          setError(err instanceof Error ? err.message : 'Failed to load analytics');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [get, formDocumentId]);

  return { stats, isLoading, error };
};
