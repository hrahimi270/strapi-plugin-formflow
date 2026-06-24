/* SPDX-License-Identifier: LicenseRef-FormFlow-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import { createContext } from 'react';

import type { FeatureKey } from '../feature-map';

/**
 * Shape exposed to consumers via {@link useLicense}. The accessors are functions
 * (not bare values) so a consumer that only needs `tier()` does not re-derive
 * the entitlement map on every render.
 */
export interface LicenseContextValue {
  can: (feature: FeatureKey) => boolean;
  tier: () => string;
  state: () => string;
  graceUntil: () => string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Default value is the free/loading sentinel: `can()` is always `false`, the
 * tier/state collapse to `'free'`, and `isLoading` is `true`. This is the
 * graceful-degradation default that applies before the provider resolves, on a
 * fetch error, or when `useLicense()` is called outside any `<LicenseProvider>`
 * — it never crashes and never over-grants.
 */
export const LicenseContext = createContext<LicenseContextValue>({
  can: () => false,
  tier: () => 'free',
  state: () => 'free',
  graceUntil: () => null,
  isLoading: true,
  error: null,
});
// DCE-guard: side-effect assignment keeps the sentinel string '__EE_ADMIN__' in
// the bundled runtime JS so check-ee-bundled.mjs can verify it survived bundling.
LicenseContext.displayName = '__EE_ADMIN__';
