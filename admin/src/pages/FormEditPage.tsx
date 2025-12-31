import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Main,
  Box,
  Flex,
  Grid,
  Typography,
  Button,
  Tabs,
  Field,
  TextInput,
  Textarea,
  Toggle,
  Loader,
  Link,
} from '@strapi/design-system';
import { ArrowLeft, Check } from '@strapi/icons';
import { Page, useNotification } from '@strapi/strapi/admin';

import { useForm } from '../hooks';
import { FormBuilder } from '../components/FormBuilder';
import { FormSettings } from '../components/FormSettings';
import { EmailSettings } from '../components/FormSettings/EmailSettings';
import { WebhookSettings } from '../components/FormSettings/WebhookSettings';
import { PLUGIN_ID } from '../pluginId';
import type {
  FormField,
  FormSettings as FormSettingsType,
  FormPayload,
  EmailNotification,
  WebhookConfig,
} from '../utils/api';

/**
 * Default form settings used when creating a new form
 */
const getDefaultSettings = (): Partial<FormSettingsType> => ({
  submitButtonText: 'Submit',
  resetButtonText: 'Reset',
  showResetButton: false,
  layout: 'single',
  emailNotifications: [],
  webhooks: [],
  spam: {
    honeypot: true,
    honeypotFieldName: '_gotcha',
  },
});

/**
 * Form data structure for local state management
 */
interface FormData {
  title: string;
  slug: string;
  description: string;
  fields: FormField[];
  settings: Partial<FormSettingsType>;
  successMessage: string;
  redirectUrl: string;
  isActive: boolean;
}

/**
 * Default empty form data for creating new forms
 */
const getEmptyFormData = (): FormData => ({
  title: '',
  slug: '',
  description: '',
  fields: [],
  settings: getDefaultSettings(),
  successMessage: 'Thank you for your submission!',
  redirectUrl: '',
  isActive: true,
});

/**
 * Generates a URL-friendly slug from a title string
 */
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

/**
 * Form Edit Page - Used for creating new forms and editing existing ones
 * Features tabbed interface for Form Builder, Settings, and Notifications
 */
export const FormEditPage = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { toggleNotification } = useNotification();

  // Determine if we're creating or editing
  const isCreating = !id;
  const documentId = isCreating ? undefined : id;

  // Use the form hook for data fetching and mutations
  const { form, isLoading, isSaving, error, createForm, updateForm } = useForm(documentId);

  // Local form state
  const [formData, setFormData] = useState<FormData>(getEmptyFormData());
  const [hasChanges, setHasChanges] = useState(false);

  // Load form data when editing an existing form
  useEffect(() => {
    if (form && !isCreating) {
      setFormData({
        title: form.title,
        slug: form.slug,
        description: form.description || '',
        fields: form.fields || [],
        settings: form.settings || getDefaultSettings(),
        successMessage: form.successMessage || 'Thank you for your submission!',
        redirectUrl: form.redirectUrl || '',
        isActive: form.isActive ?? true,
      });
      setHasChanges(false);
    }
  }, [form, isCreating]);

  // Generic field update handler
  const updateField = useCallback(<K extends keyof FormData>(name: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setHasChanges(true);
  }, []);

  // Title change handler with auto-slug generation for new forms
  const handleTitleChange = useCallback(
    (value: string) => {
      updateField('title', value);
      if (isCreating) {
        updateField('slug', generateSlug(value));
      }
    },
    [isCreating, updateField]
  );

  // Navigation handlers
  const handleBack = useCallback(() => {
    navigate(`/plugins/${PLUGIN_ID}`);
  }, [navigate]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!formData.title.trim()) {
      toggleNotification({
        type: 'warning',
        message: 'Please enter a form title',
      });
      return;
    }

    try {
      const payload: FormPayload = {
        title: formData.title,
        slug: formData.slug || generateSlug(formData.title),
        description: formData.description || undefined,
        fields: formData.fields,
        settings: formData.settings as FormSettingsType,
        successMessage: formData.successMessage,
        redirectUrl: formData.redirectUrl || undefined,
        isActive: formData.isActive,
      };

      if (isCreating) {
        const newForm = await createForm(payload);
        toggleNotification({
          type: 'success',
          message: 'Form created successfully',
        });
        // Navigate to edit the newly created form
        navigate(`/plugins/${PLUGIN_ID}/forms/${newForm.documentId}/edit`);
      } else {
        await updateForm(payload);
        toggleNotification({
          type: 'success',
          message: 'Form saved successfully',
        });
        setHasChanges(false);
      }
    } catch {
      toggleNotification({
        type: 'danger',
        message: isCreating ? 'Failed to create form' : 'Failed to save form',
      });
    }
  }, [formData, isCreating, createForm, updateForm, toggleNotification, navigate]);

  // Loading state
  if (isLoading && !isCreating) {
    return (
      <Page.Main>
        <Page.Title>{isCreating ? 'Create Form' : 'Edit Form'}</Page.Title>
        <Flex justifyContent="center" alignItems="center" height="400px">
          <Loader>Loading form...</Loader>
        </Flex>
      </Page.Main>
    );
  }

  // Error state
  if (error && !isCreating) {
    return (
      <Page.Main>
        <Page.Title>Error</Page.Title>
        <Box padding={8}>
          <Flex direction="column" alignItems="center" gap={4}>
            <Typography textColor="danger600">{error.message}</Typography>
            <Button onClick={handleBack} variant="secondary">
              Back to Forms
            </Button>
          </Flex>
        </Box>
      </Page.Main>
    );
  }

  return (
    <Main>
      <Page.Title>{isCreating ? 'Create Form' : 'Edit Form'}</Page.Title>

      {/* Header */}
      <Box padding={8} background="neutral100">
        <Flex justifyContent="space-between" alignItems="center">
          <Flex gap={4} alignItems="center">
            <Link startIcon={<ArrowLeft />} onClick={handleBack} tag="button">
              Back
            </Link>
            <Box>
              <Typography variant="alpha" fontWeight="bold">
                {isCreating ? 'Create Form' : 'Edit Form'}
              </Typography>
              <Typography variant="epsilon" textColor="neutral600">
                {isCreating
                  ? 'Build a new form with custom fields'
                  : 'Modify your form configuration'}
              </Typography>
            </Box>
          </Flex>
          <Flex gap={2} alignItems="center">
            {/* Active/Inactive Toggle */}
            <Flex gap={2} alignItems="center" paddingRight={4}>
              <Toggle
                checked={formData.isActive}
                onCheckedChange={(checked: boolean) => updateField('isActive', checked)}
              />
              <Typography textColor={formData.isActive ? 'success600' : 'neutral600'}>
                {formData.isActive ? 'Active' : 'Inactive'}
              </Typography>
            </Flex>

            <Button variant="secondary" onClick={handleBack}>
              Cancel
            </Button>
            <Button
              startIcon={<Check />}
              onClick={handleSave}
              loading={isSaving}
              disabled={isSaving || (!hasChanges && !isCreating)}
            >
              {isCreating ? 'Create' : 'Save'}
            </Button>
          </Flex>
        </Flex>
      </Box>

      {/* Content with Tabs */}
      <Box padding={8}>
        <Tabs.Root defaultValue="builder">
          <Tabs.List>
            <Tabs.Trigger value="builder">Form Builder</Tabs.Trigger>
            <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
            <Tabs.Trigger value="notifications">Notifications</Tabs.Trigger>
          </Tabs.List>

          <Box marginTop={6}>
            {/* Form Builder Tab */}
            <Tabs.Content value="builder">
              {/* Basic Info Fields */}
              <Box
                marginBottom={6}
                padding={6}
                background="neutral0"
                hasRadius
                shadow="tableShadow"
                borderColor="neutral150"
              >
                <Typography variant="delta" fontWeight="bold" marginBottom={4}>
                  Basic Information
                </Typography>

                <Grid.Root gap={4} gridCols={12}>
                  <Grid.Item col={6}>
                    <Field.Root name="title" required>
                      <Field.Label>Form Title</Field.Label>
                      <TextInput
                        value={formData.title}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleTitleChange(e.target.value)
                        }
                        placeholder="Contact Form"
                      />
                      <Field.Hint>A descriptive name for your form</Field.Hint>
                    </Field.Root>
                  </Grid.Item>

                  <Grid.Item col={6}>
                    <Field.Root name="slug" required>
                      <Field.Label>Slug</Field.Label>
                      <TextInput
                        value={formData.slug}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateField('slug', e.target.value)
                        }
                        placeholder="contact-form"
                        disabled={!isCreating}
                      />
                      <Field.Hint>
                        {isCreating
                          ? 'URL-friendly identifier (auto-generated from title)'
                          : 'Cannot be changed after creation'}
                      </Field.Hint>
                    </Field.Root>
                  </Grid.Item>

                  <Grid.Item col={12}>
                    <Field.Root name="description">
                      <Field.Label>Description (Optional)</Field.Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          updateField('description', e.target.value)
                        }
                        placeholder="A brief description of what this form is for..."
                      />
                      <Field.Hint>Internal description for your reference</Field.Hint>
                    </Field.Root>
                  </Grid.Item>
                </Grid.Root>
              </Box>

              {/* Form Builder Component */}
              <FormBuilder
                fields={formData.fields}
                onChange={(fields) => updateField('fields', fields)}
              />
            </Tabs.Content>

            {/* Settings Tab */}
            <Tabs.Content value="settings">
              <FormSettings
                settings={formData.settings}
                successMessage={formData.successMessage}
                redirectUrl={formData.redirectUrl}
                showResetButton={formData.settings.showResetButton ?? false}
                onSettingsChange={(settings) => updateField('settings', settings)}
                onSuccessMessageChange={(value) => updateField('successMessage', value)}
                onRedirectUrlChange={(value) => updateField('redirectUrl', value)}
                onShowResetButtonChange={(value) =>
                  updateField('settings', { ...formData.settings, showResetButton: value })
                }
              />
            </Tabs.Content>

            {/* Notifications Tab */}
            <Tabs.Content value="notifications">
              <Flex direction="column" gap={6}>
                {/* Email Notifications */}
                <Box
                  padding={6}
                  background="neutral0"
                  hasRadius
                  shadow="tableShadow"
                  borderColor="neutral150"
                >
                  <EmailSettings
                    notifications={formData.settings.emailNotifications || []}
                    onChange={(emailNotifications: EmailNotification[]) =>
                      updateField('settings', { ...formData.settings, emailNotifications })
                    }
                  />
                </Box>

                {/* Webhooks */}
                <Box
                  padding={6}
                  background="neutral0"
                  hasRadius
                  shadow="tableShadow"
                  borderColor="neutral150"
                >
                  <WebhookSettings
                    webhooks={formData.settings.webhooks || []}
                    onChange={(webhooks: WebhookConfig[]) =>
                      updateField('settings', { ...formData.settings, webhooks })
                    }
                  />
                </Box>
              </Flex>
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Box>
    </Main>
  );
};
