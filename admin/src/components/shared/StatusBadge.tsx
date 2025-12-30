import { Badge } from '@strapi/design-system';
import { SubmissionStatus } from '../../utils/api';

/**
 * Status configuration with visual styling
 */
interface StatusConfig {
  label: string;
  variant: 'primary' | 'secondary' | 'success' | 'danger' | 'alternative';
}

/**
 * Status configurations for each submission status
 */
const STATUS_CONFIGS: Record<SubmissionStatus, StatusConfig> = {
  new: {
    label: 'New',
    variant: 'primary',
  },
  read: {
    label: 'Read',
    variant: 'secondary',
  },
  processed: {
    label: 'Processed',
    variant: 'success',
  },
  archived: {
    label: 'Archived',
    variant: 'alternative',
  },
  spam: {
    label: 'Spam',
    variant: 'danger',
  },
};

interface StatusBadgeProps {
  status: SubmissionStatus;
}

/**
 * StatusBadge component for displaying submission status
 * Uses consistent colors across the application
 */
export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.new;

  return <Badge variant={config.variant}>{config.label}</Badge>;
};
