/* SPDX-License-Identifier: LicenseRef-FormFlow-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import { useEffect, useState } from 'react';

import { useFetchClient } from '@strapi/strapi/admin';

import { PLUGIN_ID } from '../../pluginId';
import { LicenseContext, type LicenseContextValue } from '../context/LicenseContext';
import type { FeatureKey } from '../feature-map';

/**
 * Deserialized response from `GET /${PLUGIN_ID}/license` (the server's
 * `license.snapshot()`). `graceUntil` arrives as an ISO string (or null) after
 * JSON serialization. `features` is precomputed server-side so the admin never
 * re-derives tier logic.
 */
export interface LicenseSnapshot {
  tier: string;
  state: string;
  graceUntil: string | null;
  features: Record<FeatureKey, boolean>;
}

/**
 * Fetches the license snapshot once on mount and caches it in context for the
 * lifetime of the admin session (a page refresh re-fetches naturally). On any
 * failure — network error, non-2xx, or parse error — it sets `error` and falls
 * through to the free default: it never throws and never blocks the editor.
 */
const LicenseProvider = ({ children }: { children: React.ReactNode }) => {
  const { get } = useFetchClient();
  const [snapshot, setSnapshot] = useState<LicenseSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    get<LicenseSnapshot>(`/${PLUGIN_ID}/license`)
      .then(({ data }) => {
        setSnapshot(data);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });
    // One fetch on mount is the entire caching strategy — no polling, no retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: LicenseContextValue = {
    can: (feature) => snapshot?.features[feature] ?? false,
    tier: () => snapshot?.tier ?? 'free',
    state: () => snapshot?.state ?? 'free',
    graceUntil: () => snapshot?.graceUntil ?? null,
    isLoading,
    error,
  };

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
};

export { LicenseProvider };
