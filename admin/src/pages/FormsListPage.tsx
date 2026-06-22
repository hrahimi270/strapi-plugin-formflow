import type * as React from 'react';
import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  Flex,
  Typography,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TFooter,
  IconButton,
  Status,
  Badge,
  Dialog,
  EmptyStateLayout,
  LinkButton,
  VisuallyHidden,
} from '@strapi/design-system';
import { Plus, Pencil, Trash, Eye, Duplicate, WarningCircle } from '@strapi/icons';
import { EmptyDocuments } from '@strapi/icons/symbols';
import {
  Page,
  Layouts,
  SearchInput,
  ConfirmDialog,
  useNotification,
  useQueryParams,
  useRBAC,
} from '@strapi/strapi/admin';

import { useForms } from '../hooks';
import { getTranslation } from '../utils/getTranslation';
import {
  FORM_PERMISSIONS,
  SUBMISSION_PERMISSIONS,
  buildPerFormPermissions,
  PER_FORM_RBAC_FEATURE,
} from '../permissions';
import { useLicense } from '../ee/hooks/useLicense';
import type { Form, FormsQueryParams } from '../utils/api';

interface FormRowProps {
  form: Form;
  /** When true, update/delete are scoped to this form via per-form RBAC. */
  isPerFormRbacActive: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReadSubmissions: boolean;
  isDuplicating: boolean;
  onEdit: (form: Form) => void;
  onViewSubmissions: (form: Form) => void;
  onDuplicate: (form: Form) => void;
  onDelete: (form: Form) => void;
}

/**
 * A single form table row.
 *
 * Extracted from the list so per-form RBAC can call `useRBAC` at a component's
 * top level (Rules of Hooks forbid calling it inside `.map`). When
 * `isPerFormRbacActive`, update/delete are gated by this form's per-document
 * permissions; otherwise the globally-derived flags are used. Creation and
 * submission-read stay global (no per-form scope for those).
 */
const FormRow = ({
  form,
  isPerFormRbacActive,
  canCreate,
  canUpdate,
  canDelete,
  canReadSubmissions,
  isDuplicating,
  onEdit,
  onViewSubmissions,
  onDuplicate,
  onDelete,
}: FormRowProps) => {
  const { formatMessage } = useIntl();

  // Always called (Rules of Hooks). The permissions passed are scoped to this
  // form only when per-form RBAC is active; the result is otherwise ignored.
  const {
    allowedActions: { canUpdate: canUpdatePerForm, canDelete: canDeletePerForm },
  } = useRBAC(buildPerFormPermissions(form.documentId));

  const rowCanUpdate = isPerFormRbacActive ? canUpdatePerForm : canUpdate;
  const rowCanDelete = isPerFormRbacActive ? canDeletePerForm : canDelete;

  return (
    <Tr
      onClick={rowCanUpdate ? () => onEdit(form) : undefined}
      style={rowCanUpdate ? { cursor: 'pointer' } : undefined}
    >
      <Td>
        <Typography fontWeight="bold" textColor="neutral800">
          {form.title}
        </Typography>
      </Td>
      <Td>
        <Typography textColor="neutral600">{form.slug}</Typography>
      </Td>
      <Td>
        <Badge>{form.submissionCount}</Badge>
      </Td>
      <Td>
        <Status variant={form.isActive ? 'success' : 'secondary'} size="S">
          <Typography variant="omega" fontWeight="bold">
            {form.isActive
              ? formatMessage({
                  id: getTranslation('forms.status.active'),
                  defaultMessage: 'Active',
                })
              : formatMessage({
                  id: getTranslation('forms.status.inactive'),
                  defaultMessage: 'Inactive',
                })}
          </Typography>
        </Status>
      </Td>
      <Td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <Flex gap={1} justifyContent="flex-end">
          {canReadSubmissions && (
            <IconButton
              label={formatMessage({
                id: getTranslation('forms.action.viewSubmissions'),
                defaultMessage: 'View submissions',
              })}
              onClick={() => onViewSubmissions(form)}
              variant="ghost"
            >
              <Eye />
            </IconButton>
          )}
          {rowCanUpdate && (
            <IconButton
              label={formatMessage({
                id: getTranslation('forms.action.edit'),
                defaultMessage: 'Edit form',
              })}
              onClick={() => onEdit(form)}
              variant="ghost"
            >
              <Pencil />
            </IconButton>
          )}
          {canCreate && (
            <IconButton
              label={formatMessage({
                id: getTranslation('forms.action.duplicate'),
                defaultMessage: 'Duplicate form',
              })}
              onClick={() => onDuplicate(form)}
              variant="ghost"
              disabled={isDuplicating}
            >
              <Duplicate />
            </IconButton>
          )}
          {rowCanDelete && (
            <IconButton
              label={formatMessage({
                id: getTranslation('forms.action.delete'),
                defaultMessage: 'Delete form',
              })}
              onClick={() => onDelete(form)}
              variant="ghost"
            >
              <Trash />
            </IconButton>
          )}
        </Flex>
      </Td>
    </Tr>
  );
};

/**
 * Forms List Page - Main landing page for the plugin.
 *
 * Displays all forms in a native Strapi table with server-driven search
 * (synced via `useQueryParams`), status badges, and row actions.
 */
export const FormsListPage = () => {
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();

  // Search term is the source of truth in the URL (`_q`), set by <SearchInput />.
  const [{ query }] = useQueryParams<{ _q?: string }>();
  const search = query._q ? decodeURIComponent(query._q) : undefined;

  const queryParams: FormsQueryParams = { _q: search };
  const { forms, isLoading, error, deleteForm, duplicateForm } = useForms(queryParams);

  // Gate write actions by the user's form permissions. `duplicate` reuses the
  // create permission (it creates a new form). Super-admins pass all checks.
  const {
    allowedActions: { canCreate, canUpdate, canDelete },
  } = useRBAC(FORM_PERMISSIONS);
  // Viewing submissions requires the submission-read permission (checked here so
  // the action is hidden up front; the submissions page also enforces it).
  const {
    allowedActions: { canRead: canReadSubmissions },
  } = useRBAC(SUBMISSION_PERMISSIONS);

  // Business tier: when entitled, row-level update/delete are scoped to per-form
  // permissions (evaluated per row in <FormRow>). Defaults to false (global
  // permissions) before the license resolves or in the free tier — UX only.
  const isPerFormRbacActive = useLicense().can(PER_FORM_RBAC_FEATURE);

  // Delete confirmation state
  const [formToDelete, setFormToDelete] = useState<Form | null>(null);

  // Duplicate loading state
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  const tabTitle = formatMessage({ id: getTranslation('forms.title'), defaultMessage: 'Forms' });

  const handleCreateForm = () => {
    navigate('forms/create');
  };

  const handleEditForm = (form: Form) => {
    navigate(`forms/${form.documentId}/edit`);
  };

  const handleViewSubmissions = (form: Form) => {
    navigate(`forms/${form.documentId}/submissions`);
  };

  const handleDuplicateForm = async (form: Form) => {
    setIsDuplicating(form.documentId);
    try {
      await duplicateForm(form.documentId);
      toggleNotification({
        type: 'success',
        message: formatMessage(
          {
            id: getTranslation('forms.duplicate.success'),
            defaultMessage: 'Form "{title}" duplicated successfully',
          },
          { title: form.title }
        ),
      });
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('forms.duplicate.error'),
          defaultMessage: 'Failed to duplicate form',
        }),
      });
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!formToDelete) {
      return;
    }
    try {
      await deleteForm(formToDelete.documentId);
      toggleNotification({
        type: 'success',
        message: formatMessage(
          {
            id: getTranslation('forms.delete.success'),
            defaultMessage: 'Form "{title}" deleted successfully',
          },
          { title: formToDelete.title }
        ),
      });
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage({
          id: getTranslation('forms.delete.error'),
          defaultMessage: 'Failed to delete form',
        }),
      });
    } finally {
      setFormToDelete(null);
    }
  };

  if (isLoading) {
    return <Page.Loading />;
  }

  if (error) {
    return <Page.Error />;
  }

  const numberOfForms = forms.length;
  // No forms exist at all (and the user is not actively filtering): full empty state.
  const isFilteredEmpty = numberOfForms === 0 && Boolean(search);

  return (
    <Page.Main>
      <Page.Title>{tabTitle}</Page.Title>
      <Layouts.Header
        title={tabTitle}
        subtitle={formatMessage({
          id: getTranslation('forms.subtitle'),
          defaultMessage: 'Create and manage your forms',
        })}
        primaryAction={
          canCreate ? (
            <Button startIcon={<Plus />} onClick={handleCreateForm}>
              {formatMessage({
                id: getTranslation('forms.create'),
                defaultMessage: 'Create form',
              })}
            </Button>
          ) : null
        }
      />
      <Layouts.Action
        startActions={
          <SearchInput
            label={formatMessage({
              id: getTranslation('forms.search.label'),
              defaultMessage: 'Search for a form',
            })}
            placeholder={formatMessage({
              id: getTranslation('forms.search.placeholder'),
              defaultMessage: 'Search forms...',
            })}
          />
        }
      />
      <Layouts.Content>
        {numberOfForms > 0 ? (
          <Table
            colCount={5}
            rowCount={numberOfForms + 1}
            footer={
              canCreate ? (
                <TFooter onClick={handleCreateForm} icon={<Plus />}>
                  {formatMessage({
                    id: getTranslation('forms.create'),
                    defaultMessage: 'Create form',
                  })}
                </TFooter>
              ) : undefined
            }
          >
            <Thead>
              <Tr>
                <Th>
                  <Typography variant="sigma" textColor="neutral600">
                    {formatMessage({
                      id: getTranslation('forms.column.title'),
                      defaultMessage: 'Title',
                    })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma" textColor="neutral600">
                    {formatMessage({
                      id: getTranslation('forms.column.slug'),
                      defaultMessage: 'Slug',
                    })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma" textColor="neutral600">
                    {formatMessage({
                      id: getTranslation('forms.column.submissions'),
                      defaultMessage: 'Submissions',
                    })}
                  </Typography>
                </Th>
                <Th>
                  <Typography variant="sigma" textColor="neutral600">
                    {formatMessage({
                      id: getTranslation('forms.column.status'),
                      defaultMessage: 'Status',
                    })}
                  </Typography>
                </Th>
                <Th>
                  <VisuallyHidden>
                    {formatMessage({
                      id: getTranslation('forms.column.actions'),
                      defaultMessage: 'Actions',
                    })}
                  </VisuallyHidden>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {forms.map((form) => (
                <FormRow
                  key={form.documentId}
                  form={form}
                  isPerFormRbacActive={isPerFormRbacActive}
                  canCreate={canCreate}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  canReadSubmissions={canReadSubmissions}
                  isDuplicating={isDuplicating === form.documentId}
                  onEdit={handleEditForm}
                  onViewSubmissions={handleViewSubmissions}
                  onDuplicate={handleDuplicateForm}
                  onDelete={setFormToDelete}
                />
              ))}
            </Tbody>
          </Table>
        ) : isFilteredEmpty ? (
          <EmptyStateLayout
            icon={<EmptyDocuments width="160px" />}
            content={formatMessage(
              {
                id: getTranslation('forms.search.empty'),
                defaultMessage: 'No forms match your search.',
              },
              { search }
            )}
          />
        ) : (
          <EmptyStateLayout
            icon={<EmptyDocuments width="160px" />}
            content={formatMessage({
              id: getTranslation('forms.empty'),
              defaultMessage: 'Create your first form to start collecting submissions',
            })}
            action={
              canCreate ? (
                <LinkButton
                  tag={NavLink}
                  to="forms/create"
                  variant="secondary"
                  startIcon={<Plus />}
                >
                  {formatMessage({
                    id: getTranslation('forms.create'),
                    defaultMessage: 'Create form',
                  })}
                </LinkButton>
              ) : null
            }
          />
        )}
      </Layouts.Content>

      <Dialog.Root
        open={formToDelete !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setFormToDelete(null);
          }
        }}
      >
        <ConfirmDialog onConfirm={handleDeleteConfirm} variant="danger-light" icon={<WarningCircle />}>
          {formatMessage(
            {
              id: getTranslation('forms.delete.confirm'),
              defaultMessage:
                'Are you sure you want to delete "{title}"? This will also delete all associated submissions. This action cannot be undone.',
            },
            { title: formToDelete?.title ?? '' }
          )}
        </ConfirmDialog>
      </Dialog.Root>
    </Page.Main>
  );
};
