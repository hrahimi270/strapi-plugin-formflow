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
  IconButton,
  Badge,
  Searchbar,
  Loader,
} from '@strapi/design-system';
import { Plus, Pencil, Trash, Eye, Duplicate, Files } from '@strapi/icons';
import { Page, useNotification } from '@strapi/strapi/admin';

import { useForms } from '../hooks';
import { EmptyState, ConfirmDialog } from '../components/shared';
import type { Form } from '../utils/api';

/**
 * Forms List Page - Main landing page for the plugin
 * Displays all forms in a table with search, status badges, and actions
 */
export const FormsListPage = () => {
  const navigate = useNavigate();
  const { toggleNotification } = useNotification();

  const { forms, isLoading, error, refetch, deleteForm, duplicateForm } = useForms();

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
            title="Error loading forms"
            description={error.message}
            action={
              <Button onClick={() => refetch()} variant="secondary">
                Try again
              </Button>
            }
          />
        </Box>
      </Page.Main>
    );
  }

  // Column count for table
  const colCount = 5;
  const rowCount = filteredForms.length;

  return (
    <Flex paddingLeft="56px" paddingRight="56px" paddingTop="24px" direction="column" gap="40px">
      {/* Header Section */}
      <Flex direction="column" alignItems="start" gap="12px" width="100%">
        <Flex justifyContent="space-between" alignItems="center" width="100%">
          <Typography fontSize="3.2rem" variant="delta" as="h1">
            Forms
          </Typography>
          <Button height="3.2rem" startIcon={<Plus color="white" />} onClick={handleCreateForm}>
            Create Form
          </Button>
        </Flex>
        <Typography fontSize="1.6rem" variant="epsilon" textColor="#666687">
          Create and manage your forms
        </Typography>
      </Flex>

      {/* Content Section */}
      {forms.length === 0 ? (
        <>
          {/* Empty State */}
          <EmptyState
            title="No forms yet"
            description="Create your first form to start collecting submissions"
            icon={<Files color="#4945ff" width={96} height="auto" />}
            action={
              <Button
                variant="secondary" // color scheme
                height="3.2rem"
                startIcon={<Plus color="#271fe0" />}
                onClick={handleCreateForm}
              >
                Create new form
              </Button>
            }
          />
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
            <>
              <EmptyState
                title="No forms found"
                description={`No forms match "${searchValue}"`}
                action={
                  <Button variant="secondary" height="3.2rem" onClick={handleSearchClear}>
                    Clear search
                  </Button>
                }
              />
            </>
          ) : (
            <Table
              footer={
                <Flex
                  gap="12px"
                  cursor="pointer"
                  background="primary100"
                  padding="20px"
                  onClick={handleCreateForm}
                >
                  <Flex
                    justifyContent="center"
                    alignItems="center"
                    width="2.4rem"
                    height="2.4rem"
                    background="primary200"
                    borderRadius="50%"
                  >
                    <Plus color="primary600" width="1rem" height="1rem" />
                  </Flex>
                  <Typography variant="pi" fontWeight="bold" textColor="#4945ff">
                    {/* Showing {filteredForms.length} of {forms.length} forms */}
                    Add another form
                  </Typography>
                </Flex>
              }
            >
              <Thead>
                <Tr>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      Title
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      Slug
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      Submissions
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      Status
                    </Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma" textColor="neutral600">
                      Actions
                    </Typography>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredForms.map((form) => (
                  <Tr key={form.documentId}>
                    <Td>
                      <Typography fontWeight="bold">{form.title}</Typography>
                    </Td>
                    <Td>
                      <Typography textColor="neutral600">{form.slug}</Typography>
                    </Td>
                    <Td>
                      <Badge>{form.submissionCount}</Badge>
                    </Td>
                    <Td>
                      <Badge variant={form.isActive ? 'success' : 'secondary'}>
                        {form.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </Td>
                    <Td>
                      <Flex gap={1}>
                        <IconButton
                          label="View submissions"
                          onClick={() => handleViewSubmissions(form)}
                          variant="ghost"
                          withTooltip={false}
                        >
                          <Eye />
                        </IconButton>
                        <IconButton
                          label="Edit form"
                          onClick={() => handleEditForm(form)}
                          variant="ghost"
                          withTooltip={false}
                        >
                          <Pencil />
                        </IconButton>
                        <IconButton
                          label="Duplicate form"
                          onClick={() => handleDuplicateForm(form)}
                          variant="ghost"
                          withTooltip={false}
                          disabled={isDuplicating === form.documentId}
                        >
                          <Duplicate />
                        </IconButton>
                        <IconButton
                          label="Delete form"
                          onClick={() => handleDeleteClick(form)}
                          variant="ghost"
                          withTooltip={false}
                        >
                          <Trash />
                        </IconButton>
                      </Flex>
                    </Td>
                  </Tr>
                ))}
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
        title="Delete Form"
        message={`Are you sure you want to delete "${formToDelete?.title}"? This will also delete all associated submissions. This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isConfirming={isDeleting}
      />
    </Flex>
  );
};
