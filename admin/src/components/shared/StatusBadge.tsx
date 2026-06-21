import { Badge } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { SubmissionStatus } from '../../utils/api';
import { getTranslation } from '../../utils/getTranslation';

/**
 * Badge variant accepted by the design-system Badge component.
 */
type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'alternative';

/**
 * Per-status visual + i18n configuration.
 */
interface StatusConfig {
  /** i18n message id (already namespaced, e.g. `strapi-forms.status.new`). */
  labelId: string;
  /** Fallback label used if no translation is available. */
  defaultLabel: string;
  variant: BadgeVariant;
}

/**
 * Status configuration for each submission status.
 */
const STATUS_CONFIGS: Record<SubmissionStatus, StatusConfig> = {
  new: {
    labelId: getTranslation('status.new'),
    defaultLabel: 'New',
    variant: 'primary',
  },
  read: {
    labelId: getTranslation('status.read'),
    defaultLabel: 'Read',
    variant: 'secondary',
  },
  processed: {
    labelId: getTranslation('status.processed'),
    defaultLabel: 'Processed',
    variant: 'success',
  },
  archived: {
    labelId: getTranslation('status.archived'),
    defaultLabel: 'Archived',
    variant: 'alternative',
  },
  spam: {
    labelId: getTranslation('status.spam'),
    defaultLabel: 'Spam',
    variant: 'danger',
  },
};

interface StatusBadgeProps {
  status: SubmissionStatus;
}

/**
 * StatusBadge component for displaying a submission status.
 * Maps each of the five statuses to a consistent Badge variant and an
 * i18n-aware label.
 */
export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const { formatMessage } = useIntl();
  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.new;

  return (
    <Badge variant={config.variant}>
      {formatMessage({ id: config.labelId, defaultMessage: config.defaultLabel })}
    </Badge>
  );
};
