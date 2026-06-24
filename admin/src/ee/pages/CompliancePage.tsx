/* SPDX-License-Identifier: LicenseRef-FormFlow-EE — Commercial. See LICENSE-EE. Not covered by MIT. */
import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import {
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { Trash, Download } from '@strapi/icons';
import { Page, Layouts, BackButton, useFetchClient, useNotification } from '@strapi/strapi/admin';
import { useIntl } from 'react-intl';

import { PLUGIN_ID } from '../../pluginId';
import { getTranslation } from '../../utils/getTranslation';
import { COMPLIANCE_API, type AuditEntry, type SubjectExportResult } from '../../utils/api';
import { useLicense } from '../hooks/useLicense';
import { UpsellCard } from '../components/UpsellCard';

/**
 * Business-tier GDPR compliance page (route `compliance`). Two panels:
 *  - Subject Data Request: look up, export, or delete all submissions tied to an
 *    email (right of access / erasure).
 *  - Audit Log: the recent compliance audit trail.
 *
 * Display gating: when `can('compliance.consent')` / `can('compliance.audit')`
 * is false (free tier, or while the license loads), the panel renders an
 * UpsellCard and never fetches. The server is the authoritative gate (402 on the
 * endpoints); this is purely UX.
 */
export const CompliancePage = () => {
  const { formatMessage } = useIntl();
  const { can } = useLicense();

  const title = formatMessage({
    id: getTranslation('compliance.title'),
    defaultMessage: 'Compliance',
  });

  return (
    <Page.Main>
      <Page.Title>{title}</Page.Title>
      <Layouts.Header
        navigationAction={<BackButton disabled={false} fallback={`/plugins/${PLUGIN_ID}`} />}
        title={title}
      />
      <Layouts.Content>
        <Flex direction="column" alignItems="stretch" gap={6}>
          <SubjectPanel entitled={can('compliance.consent')} />
          <AuditPanel entitled={can('compliance.audit')} />
        </Flex>
      </Layouts.Content>
    </Page.Main>
  );
};

/** Subject Data Request panel — export/delete all submissions for an email. */
const SubjectPanel = ({ entitled }: { entitled: boolean }) => {
  const { formatMessage } = useIntl();
  const { get, del } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [email, setEmail] = useState('');
  const [result, setResult] = useState<SubjectExportResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleExport = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }
    try {
      const response = await get<{ data: SubjectExportResult }>(
        `${COMPLIANCE_API.subject}?email=${encodeURIComponent(trimmed)}`
      );
      setResult(response.data.data);
      setSearched(true);
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('common.error'),
          defaultMessage: 'Something went wrong',
        }),
      });
    }
  };

  const handleDeleteConfirm = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }
    try {
      const response = await del<{ data: { deleted: number } }>(
        `${COMPLIANCE_API.subject}?email=${encodeURIComponent(trimmed)}`
      );
      const deleted = response.data.data.deleted;
      toggleNotification({
        type: 'success',
        message: formatMessage(
          {
            id: getTranslation('compliance.subject.delete.success'),
            defaultMessage: '{count} submission(s) deleted',
          },
          { count: deleted }
        ),
      });
      setResult(null);
      setSearched(false);
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('common.error'),
          defaultMessage: 'Something went wrong',
        }),
      });
    } finally {
      setConfirmOpen(false);
    }
  };

  return (
    <Box
      background="neutral0"
      hasRadius
      borderColor="neutral200"
      padding={6}
      shadow="tableShadow"
    >
      <Flex direction="column" alignItems="stretch" gap={4}>
        <Typography variant="delta" fontWeight="bold">
          {formatMessage({
            id: getTranslation('compliance.subject.title'),
            defaultMessage: 'Subject Data Request',
          })}
        </Typography>

        {entitled ? (
          <>
            <Field.Root>
              <Field.Label>
                {formatMessage({
                  id: getTranslation('compliance.subject.email.label'),
                  defaultMessage: 'Subject Email',
                })}
              </Field.Label>
              <TextInput
                type="email"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder={formatMessage({
                  id: getTranslation('compliance.subject.email.placeholder'),
                  defaultMessage: 'Enter email address',
                })}
              />
            </Field.Root>

            <Flex gap={2}>
              <Button
                variant="secondary"
                startIcon={<Download />}
                onClick={handleExport}
                disabled={email.trim() === ''}
              >
                {formatMessage({
                  id: getTranslation('compliance.subject.export'),
                  defaultMessage: 'Export Data',
                })}
              </Button>
              <Button
                variant="danger-light"
                startIcon={<Trash />}
                onClick={() => setConfirmOpen(true)}
                disabled={email.trim() === ''}
              >
                {formatMessage({
                  id: getTranslation('compliance.subject.delete'),
                  defaultMessage: 'Delete All Data',
                })}
              </Button>
            </Flex>

            {searched ? <SubjectResults result={result} /> : null}

            <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
              <Dialog.Content>
                <Dialog.Header>
                  {formatMessage({
                    id: getTranslation('compliance.subject.delete.confirm.title'),
                    defaultMessage: 'Delete Subject Data',
                  })}
                </Dialog.Header>
                <Dialog.Body>
                  {formatMessage(
                    {
                      id: getTranslation('compliance.subject.delete.confirm.body'),
                      defaultMessage:
                        'This will permanently delete all submissions associated with "{email}". This cannot be undone.',
                    },
                    { email: email.trim() }
                  )}
                </Dialog.Body>
                <Dialog.Footer>
                  <Dialog.Cancel>
                    <Button variant="tertiary">
                      {formatMessage({
                        id: getTranslation('common.cancel'),
                        defaultMessage: 'Cancel',
                      })}
                    </Button>
                  </Dialog.Cancel>
                  <Button variant="danger-light" startIcon={<Trash />} onClick={handleDeleteConfirm}>
                    {formatMessage({
                      id: getTranslation('compliance.subject.delete'),
                      defaultMessage: 'Delete All Data',
                    })}
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Root>
          </>
        ) : (
          <UpsellCard
            feature="compliance.consent"
            description={formatMessage({
              id: getTranslation('compliance.upsell.description'),
              defaultMessage:
                'Subject data export/delete, consent capture, and audit logging require a Business plan.',
            })}
          />
        )}
      </Flex>
    </Box>
  );
};

/** Renders the export results table, or an empty-state message. */
const SubjectResults = ({ result }: { result: SubjectExportResult | null }) => {
  const { formatMessage } = useIntl();

  if (!result || result.submissions.length === 0) {
    return (
      <Typography variant="omega" textColor="neutral600">
        {formatMessage({
          id: getTranslation('compliance.subject.noResults'),
          defaultMessage: 'No submissions found for this email.',
        })}
      </Typography>
    );
  }

  return (
    <Table colCount={3} rowCount={result.submissions.length}>
      <Thead>
        <Tr>
          <Th>
            <Typography variant="sigma">ID</Typography>
          </Th>
          <Th>
            <Typography variant="sigma">
              {formatMessage({
                id: getTranslation('compliance.audit.columns.timestamp'),
                defaultMessage: 'Timestamp',
              })}
            </Typography>
          </Th>
          <Th>
            <Typography variant="sigma">Data</Typography>
          </Th>
        </Tr>
      </Thead>
      <Tbody>
        {result.submissions.map((submission) => (
          <Tr key={submission.documentId}>
            <Td>
              <Typography variant="pi" textColor="neutral600">
                {submission.documentId}
              </Typography>
            </Td>
            <Td>
              <Typography variant="omega">
                {new Date(submission.createdAt).toLocaleString()}
              </Typography>
            </Td>
            <Td>
              <Typography variant="pi" textColor="neutral600">
                {JSON.stringify(submission.data)}
              </Typography>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

/** Audit Log panel — recent compliance audit entries. */
const AuditPanel = ({ entitled }: { entitled: boolean }) => {
  const { formatMessage } = useIntl();
  const { get } = useFetchClient();

  const [entries, setEntries] = useState<AuditEntry[]>([]);

  const fetchAudit = useCallback(async () => {
    try {
      const response = await get<{ data: AuditEntry[] }>(COMPLIANCE_API.audit);
      setEntries(response.data.data.slice(0, 100));
    } catch {
      setEntries([]);
    }
  }, [get]);

  useEffect(() => {
    if (entitled) {
      fetchAudit();
    }
  }, [entitled, fetchAudit]);

  return (
    <Box
      background="neutral0"
      hasRadius
      borderColor="neutral200"
      padding={6}
      shadow="tableShadow"
    >
      <Flex direction="column" alignItems="stretch" gap={4}>
        <Typography variant="delta" fontWeight="bold">
          {formatMessage({
            id: getTranslation('compliance.audit.title'),
            defaultMessage: 'Audit Log',
          })}
        </Typography>

        {entitled ? (
          <Table colCount={5} rowCount={entries.length}>
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({
                      id: getTranslation('compliance.audit.columns.timestamp'),
                      defaultMessage: 'Timestamp',
                    })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({
                      id: getTranslation('compliance.audit.columns.action'),
                      defaultMessage: 'Action',
                    })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({
                      id: getTranslation('compliance.audit.columns.actor'),
                      defaultMessage: 'Actor',
                    })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({
                      id: getTranslation('compliance.audit.columns.target'),
                      defaultMessage: 'Target',
                    })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma">
                    {formatMessage({
                      id: getTranslation('compliance.audit.columns.count'),
                      defaultMessage: 'Count',
                    })}
                  </Typography>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {entries.map((entry, index) => (
                <Tr key={`${entry.timestamp}-${index}`}>
                  <Td>
                    <Typography variant="omega">
                      {new Date(entry.timestamp).toLocaleString()}
                    </Typography>
                  </Td>
                  <Td>
                    <Typography variant="omega">{entry.action}</Typography>
                  </Td>
                  <Td>
                    <Typography variant="omega">{entry.actor}</Typography>
                  </Td>
                  <Td>
                    <Typography variant="pi" textColor="neutral600">
                      {entry.target}
                    </Typography>
                  </Td>
                  <Td>
                    <Typography variant="omega">{entry.count ?? ''}</Typography>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <UpsellCard
            feature="compliance.audit"
            description={formatMessage({
              id: getTranslation('compliance.upsell.description'),
              defaultMessage:
                'Subject data export/delete, consent capture, and audit logging require a Business plan.',
            })}
          />
        )}
      </Flex>
    </Box>
  );
};
