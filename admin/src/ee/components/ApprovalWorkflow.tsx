/* SPDX-License-Identifier: LicenseRef-FormFlow-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import { useState } from 'react';
import {
  Box,
  Flex,
  Typography,
  Badge,
  Field,
  SingleSelect,
  SingleSelectOption,
  Textarea,
  Button,
} from '@strapi/design-system';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { useIntl } from 'react-intl';

import { API, APPROVAL_STATUSES, type ApprovalStatus } from '../../utils/api';
import { getTranslation } from '../../utils/getTranslation';
import { useLicense } from '../hooks/useLicense';
import { UpsellCard } from './UpsellCard';

export interface ApprovalWorkflowProps {
  /** Submission documentId the approval decision applies to. */
  submissionId: string;
  /** Current approval status (defaults to `pending` when absent). */
  approvalStatus?: ApprovalStatus;
  /** Current approval note (pre-fills the textarea). */
  approvalNote?: string;
  /** Called after a successful save so the parent can refetch the submission. */
  onUpdated?: () => void;
}

/** Badge variant for each approval status. */
const STATUS_VARIANTS: Record<ApprovalStatus, 'secondary' | 'success' | 'danger'> = {
  pending: 'secondary',
  approved: 'success',
  rejected: 'danger',
};

/**
 * Approval workflow panel (Business feature) for a single submission.
 *
 * Display gating: when `can('approval')` is false (free/pro tier, or while the
 * license is still loading — the safe over-restrictive default) an UpsellCard is
 * rendered. The server is the authoritative gate (402 on the approve endpoint);
 * this is purely UX. When entitled, shows the current status badge, a status
 * selector, an optional decision note and a save button.
 */
const ApprovalWorkflow = ({
  submissionId,
  approvalStatus = 'pending',
  approvalNote = '',
  onUpdated,
}: ApprovalWorkflowProps) => {
  const { formatMessage } = useIntl();
  const { can } = useLicense();
  const { put } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [status, setStatus] = useState<ApprovalStatus>(approvalStatus);
  const [note, setNote] = useState<string>(approvalNote);
  const [isSaving, setIsSaving] = useState(false);

  const title = formatMessage({
    id: getTranslation('approval.title'),
    defaultMessage: 'Approval',
  });

  if (!can('approval')) {
    return (
      <UpsellCard
        feature="approval"
        description={formatMessage({
          id: getTranslation('approval.upsell'),
          defaultMessage: 'Approval workflows require a Business license',
        })}
      />
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await put(API.approveSubmission(submissionId), {
        approvalStatus: status,
        approvalNote: note,
      });
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: getTranslation('submission.status.updated'),
          defaultMessage: 'Status updated successfully',
        }),
      });
      onUpdated?.();
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('common.error'),
          defaultMessage: 'Something went wrong',
        }),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box background="neutral0" hasRadius shadow="tableShadow" padding={6}>
      <Flex justifyContent="space-between" alignItems="center">
        <Typography variant="delta" fontWeight="bold" tag="h2">
          {title}
        </Typography>
        <Badge variant={STATUS_VARIANTS[approvalStatus]}>
          {formatMessage({
            id: getTranslation(`approval.status.${approvalStatus}`),
            defaultMessage: approvalStatus,
          })}
        </Badge>
      </Flex>

      <Box marginTop={3}>
        <Field.Root name="approvalStatus">
          <Field.Label>
            {formatMessage({
              id: getTranslation('approval.title'),
              defaultMessage: 'Approval',
            })}
          </Field.Label>
          <SingleSelect
            value={status}
            onChange={(value: string | number) => setStatus(value as ApprovalStatus)}
            disabled={isSaving}
          >
            {APPROVAL_STATUSES.map((value) => (
              <SingleSelectOption key={value} value={value}>
                {formatMessage({
                  id: getTranslation(`approval.status.${value}`),
                  defaultMessage: value,
                })}
              </SingleSelectOption>
            ))}
          </SingleSelect>
        </Field.Root>
      </Box>

      <Box marginTop={3}>
        <Field.Root name="approvalNote">
          <Field.Label>
            {formatMessage({
              id: getTranslation('approval.note.label'),
              defaultMessage: 'Approval note',
            })}
          </Field.Label>
          <Textarea
            value={note}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
              setNote(event.target.value)
            }
            placeholder={formatMessage({
              id: getTranslation('approval.note.placeholder'),
              defaultMessage: 'Optional note for this decision',
            })}
            disabled={isSaving}
          />
        </Field.Root>
      </Box>

      <Box marginTop={4}>
        <Button onClick={handleSave} loading={isSaving} disabled={isSaving}>
          {formatMessage({
            id: getTranslation('approval.save'),
            defaultMessage: 'Save decision',
          })}
        </Button>
      </Box>
    </Box>
  );
};

export default ApprovalWorkflow;
