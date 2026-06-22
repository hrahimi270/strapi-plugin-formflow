/* SPDX-License-Identifier: LicenseRef-StrapiForms-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
export * from './feature-map';

export const __EE_ADMIN__ = '__EE_ADMIN__'; // sentinel for T18 dist grep — string so it survives DCE via LicenseContext.displayName

export { LicenseContext } from './context/LicenseContext';
export { LicenseProvider } from './providers/LicenseProvider';
export { useLicense } from './hooks/useLicense';

// --- gating primitives ---
export { ProBadge } from './components/ProBadge';
export type { ProBadgeProps } from './components/ProBadge';
export { UpsellCard, PURCHASE_URL } from './components/UpsellCard';
export type { UpsellCardProps } from './components/UpsellCard';
export { LockedSection } from './components/LockedSection';
export type { LockedSectionProps } from './components/LockedSection';
export { GatedButton } from './components/GatedButton';
export type { GatedButtonProps } from './components/GatedButton';
export { FieldTypeLockState } from './components/FieldTypeLockState';
export type { FieldTypeLockStateProps } from './components/FieldTypeLockState';

// --- FormBuilder EE components ---
export { StepsManager } from './components/FormBuilder/StepsManager';
export type { StepsManagerProps } from './components/FormBuilder/StepsManager';
export { ConditionalLogicBuilder } from './components/FormBuilder/ConditionalLogicBuilder';
export type { ConditionalLogicBuilderProps } from './components/FormBuilder/ConditionalLogicBuilder';

// --- Analytics (Pro) ---
export { useAnalytics } from './hooks/useAnalytics';
export type { AnalyticsStats, UseAnalyticsResult } from './hooks/useAnalytics';
export { AnalyticsPage } from './pages/AnalyticsPage';
export type { AnalyticsPageProps } from './pages/AnalyticsPage';

// --- Compliance (Business) ---
export { CompliancePage } from './pages/CompliancePage';

// --- Approval workflows (Business) ---
export { default as ApprovalWorkflow } from './components/ApprovalWorkflow';
export type { ApprovalWorkflowProps } from './components/ApprovalWorkflow';

// --- Pre-built integrations (Pro) ---
export { IntegrationsSettings } from '../components/FormSettings/IntegrationsSettings';
export type { IntegrationsSettingsProps } from '../components/FormSettings/IntegrationsSettings';
