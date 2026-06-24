/* SPDX-License-Identifier: LicenseRef-FormFlow-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import { useContext } from 'react';

import { LicenseContext } from '../context/LicenseContext';

export { type LicenseContextValue } from '../context/LicenseContext';

/**
 * Read the license context. Outside any `<LicenseProvider>` this returns the
 * free-sentinel default (see {@link LicenseContext}) and never throws.
 */
export const useLicense = () => useContext(LicenseContext);
