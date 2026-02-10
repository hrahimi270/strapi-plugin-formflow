import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Flex,
  Typography,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Searchbar,
  Loader,
  Link,
  EmptyStateLayout,
} from '@strapi/design-system';
import { Plus, Trash, Eye, Duplicate, Files, WarningCircle } from '@strapi/icons';
import { Page, useNotification } from '@strapi/strapi/admin';

import { useForms } from '../hooks';
import type { Form } from '../utils/api';
import TooltipIconButton from '../components/shared/TooltipIconButton';
import TableTypography from '../components/shared/TableTypography';
import TableBadge from '../components/shared/TableBadge';
import Heading from '../components/shared/Heading';
import SubHeading from '../components/shared/SubHeading';
import BackButton from '../components/shared/BackButton';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import EmptyState from '../components/shared/EmptyState';
import HeadingContainer from '../components/shared/HeadingContainer';
import AddNewButton from '../components/shared/AddNewButton';
import AddMoreButton from '../components/shared/AddMoreButton';

/**
 * Forms List Page - Main landing page for the plugin
 * Displays all forms in a table with search, status badges, and actions
 */
export const FormsListPage = () => {
  const navigate = useNavigate();
  const { toggleNotification } = useNotification();

  const { forms, isLoading, error, refetch, deleteForm, duplicateForm } = useForms();
  const numberOfForms = forms.length;

  // Hard-coded data
  const TABLE_HEADERS = ['Title', 'Slug', 'Submissions', 'Status', 'Actions'];
  const ENTRY_SINGULAR = 'entry';
  const ENTRY_PLURAL = 'entries';

  // Search state
  const [searchValue, setSearchValue] = useState('');

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<Form | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Duplicate loading state
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Filtered forms based on search
  const filteredForms = useMemo(() => {
    if (!searchValue.trim()) {
      return forms;
    }
    const searchLower = searchValue.toLowerCase();
    return forms.filter(
      (form) =>
        form.title.toLowerCase().includes(searchLower) ||
        form.slug.toLowerCase().includes(searchLower)
    );
  }, [forms, searchValue]);

  const handleBack = useCallback(() => {
    navigate(`/`);
  }, [navigate]);

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  // Handle search clear
  const handleSearchClear = useCallback(() => {
    setSearchValue('');
  }, []);

  // Navigation handlers
  const handleCreateForm = useCallback(() => {
    navigate('forms/create');
  }, [navigate]);

  const handleEditForm = useCallback(
    (form: Form) => {
      navigate(`forms/${form.documentId}/edit`);
    },
    [navigate]
  );

  const handleViewSubmissions = useCallback(
    (form: Form) => {
      navigate(`forms/${form.documentId}/submissions`);
    },
    [navigate]
  );

  // Duplicate form handler
  const handleDuplicateForm = useCallback(
    async (form: Form) => {
      setIsDuplicating(form.documentId);
      try {
        await duplicateForm(form.documentId);
        toggleNotification({
          type: 'success',
          message: `Form "${form.title}" duplicated successfully`,
        });
      } catch {
        toggleNotification({
          type: 'danger',
          message: 'Failed to duplicate form',
        });
      } finally {
        setIsDuplicating(null);
      }
    },
    [duplicateForm, toggleNotification]
  );

  // Delete form handlers
  const handleDeleteClick = useCallback((form: Form) => {
    setFormToDelete(form);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
    setFormToDelete(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!formToDelete) return;

    setIsDeleting(true);
    try {
      await deleteForm(formToDelete.documentId);
      toggleNotification({
        type: 'success',
        message: `Form "${formToDelete.title}" deleted successfully`,
      });
      setDeleteDialogOpen(false);
      setFormToDelete(null);
    } catch {
      toggleNotification({
        type: 'danger',
        message: 'Failed to delete form',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [formToDelete, deleteForm, toggleNotification]);

  // Loading state
  if (isLoading) {
    return (
      <Page.Main>
        <Page.Title>Forms</Page.Title>
        <Flex justifyContent="center" alignItems="center" height="400px">
          <Loader>Loading forms...</Loader>
        </Flex>
      </Page.Main>
    );
  }

  // Error state
  if (error) {
    return (
      <Page.Main>
        <Page.Title>Forms</Page.Title>
        <Box padding={8}>
          <EmptyState
            text="Error loading forms"
            buttonText="Try again"
            // description={error.message}
            action={() => refetch()}
            // action={
            //   <Button onClick={() => refetch()} variant="secondary">
            //     Try again
            //   </Button>
            // }
          />
        </Box>
      </Page.Main>
    );
  }

  return (
    <Flex
      paddingLeft="56px"
      paddingRight="56px"
      paddingTop="24px"
      paddingBottom="24px"
      direction="column"
      gap="40px"
    >
      {/* Header Section */}
      <Flex direction="column" width="100%" gap="12px">
        <Box width="100%">
          <BackButton handleBack={handleBack} />
        </Box>
        <HeadingContainer>
          <Flex justifyContent="space-between" alignItems="center" width="100%">
            <Heading text="Forms" textColor="neutral800" />
            <AddNewButton text="Create form" onClick={handleCreateForm} />
          </Flex>
          <SubHeading
            text={`${numberOfForms} ${numberOfForms === 0 ? ENTRY_PLURAL : numberOfForms === 1 ? ENTRY_SINGULAR : ENTRY_PLURAL} found`}
          />
        </HeadingContainer>
      </Flex>

      {/* Content Section */}
      {numberOfForms === 0 ? (
        <>
          <Box width="100%">
            <EmptyStateLayout
              action={
                <Button
                  onClick={handleCreateForm}
                  variant="secondary" // color scheme
                  height="3.2rem"
                  startIcon={<Plus color="#271fe0" />}
                >
                  Create new form
                </Button>
              }
              content="No forms yet"
              icon={<Files color="#4945ff" width={96} height="auto" />}
            />
          </Box>
          {/* Empty State */}
          {/* <EmptyState
            text="No forms yet"
            buttonText="Create new form"
            action={handleCreateForm}
            shadow
          /> */}
        </>
      ) : (
        <Flex direction="column" gap="16px" alignItems="stretch" width="100%">
          {/* Search Bar */}
          <Flex>
            <Searchbar
              name="search"
              placeholder="Search forms..."
              value={searchValue}
              onChange={handleSearchChange} // Fix it later!
              onClear={handleSearchClear}
              clearLabel="Clear search"
            >
              Search
            </Searchbar>
          </Flex>

          {/* Forms Table */}
          {filteredForms.length === 0 ? (
            <EmptyState
              text="No forms found"
              buttonText="Clear search"
              // description={`No forms match "${searchValue}"`}
              action={handleSearchClear}
              // action={
              //   <Button variant="secondary" height="3.2rem" onClick={handleSearchClear}>
              //     Clear search
              //   </Button>
              // }
            />
          ) : (
            <Table
              footer={
                <>
                  <AddMoreButton text="Add another form" onClick={handleCreateForm} />
                  {/* Showing {filteredForms.length} of {forms.length} forms */}
                </>
              }
            >
              <Thead>
                <Tr display="flex" width="100%">
                  {TABLE_HEADERS.map((header) => (
                    <Th key={header} flex="1" display="flex">
                      <Flex width="100%" height="100%" alignItems="center">
                        <Typography variant="sigma" textColor="neutral600">
                          {header}
                        </Typography>
                      </Flex>
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {filteredForms.map((form) => {
                  const isActive = form.isActive;
                  const formActions = [
                    {
                      label: 'View submissions',
                      icon: <Eye />,
                      handler: () => handleViewSubmissions(form),
                    },
                    {
                      label: 'Duplicate form',
                      icon: <Duplicate />,
                      handler: () => handleDuplicateForm(form),
                    },
                    {
                      label: 'Delete form',
                      icon: <Trash />,
                      handler: () => handleDeleteClick(form),
                    },
                  ];

                  return (
                    <Tr
                      key={form.documentId}
                      onClick={() => handleEditForm(form)}
                      cursor="pointer"
                      title="Edit form"
                      display="flex"
                      width="100%"
                    >
                      <TableTypography text={form.title} />
                      <TableTypography text={form.slug} />
                      <TableBadge text={`${form.submissionCount}`} badgeVariant="neutral" />
                      <TableBadge
                        text={isActive ? 'Active' : 'Inactive'}
                        badgeVariant={isActive ? 'success' : 'danger'}
                      />
                      <Td flex="1">
                        <Flex gap="4px">
                          {formActions.map((formAction, index) => (
                            <TooltipIconButton
                              key={index}
                              label={formAction.label}
                              onClick={(event: MouseEvent) => {
                                event.stopPropagation();
                                formAction.handler();
                              }}
                            >
                              {formAction.icon}
                            </TooltipIconButton>
                          ))}
                        </Flex>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          )}
        </Flex>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Form Confirmation"
        message={`Are you sure you want to delete "${formToDelete?.title}"? This will also delete all associated submissions. This action cannot be undone.`}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        variant="danger"
        isConfirming={isDeleting}
        icon={<WarningCircle width={24} height={24} fill="danger600" />}
      />
    </Flex>
  );
};
