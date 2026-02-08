import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Flex,
  Typography,
  Button,
  Tabs,
  Field,
  TextInput,
  Textarea,
  Checkbox,
  Loader,
  Toggle,
  Grid,
} from '@strapi/design-system';
import { ArrowLeft, Check, Plus } from '@strapi/icons';
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
import Heading from '../components/shared/Heading';
import SubHeading from '../components/shared/SubHeading';
import HeadingContainer from '../components/shared/HeadingContainer';
import BackButton from '../components/shared/BackButton';

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
  const [isFormActive, setIsFormActive] = useState(false);

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

  const handleFormActivation = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setIsFormActive(checked);
  };

  return (
    <Flex
      paddingLeft="56px"
      paddingRight="56px"
      paddingTop="24px"
      paddingBottom="24px"
      direction="column"
      gap="56px"
    >
      {/* Save Button */}
      {/* <Button
        startIcon={<Check />}
        onClick={handleSave}
        loading={isSaving}
        disabled={isSaving || (!hasChanges && !isCreating)}
      >
        {isCreating ? 'Create' : 'Save'}
      </Button> */}

      {/* toggle switch button */}
      {/* <Checkbox
        checked={formData.isActive}
        onCheckedChange={(checked: boolean) => updateField('isActive', checked)}
      >
        <Typography textColor={formData.isActive ? 'success600' : 'neutral600'}>
          {formData.isActive ? 'Active' : 'Inactive'}
        </Typography>
      </Checkbox> */}

      {/* Header */}
      <Flex direction="column" width="100%" gap="12px">
        <BackButton handleBack={handleBack} />
        <HeadingContainer>
          <Heading text={isCreating ? 'Create Form' : 'Edit Form'} textColor="neutral800" />
          <SubHeading
            text={
              isCreating ? 'Build a new form with custom fields' : 'Modify your form configuration'
            }
          />
        </HeadingContainer>
      </Flex>

      <Grid.Root gap="16px" width="100%">
        <Grid.Item s={9}>
          <Flex width="100%" direction="column" gap="16px">
            <Box width="100%">
              <Toggle onLabel="Activate" offLabel="Deactivate" onChange={handleFormActivation} />
            </Box>
            {/* Content with Tabs */}
            <Tabs.Root defaultValue="builder">
              <Tabs.List>
                <Tabs.Trigger value="builder">Form Builder</Tabs.Trigger>
                <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
                <Tabs.Trigger value="notifications">Notifications</Tabs.Trigger>
              </Tabs.List>

              {/* Form Builder Tab */}
              <Tabs.Content value="builder">
                {/* Basic Info Fields */}
                <Box
                  marginBottom={6}
                  padding={6}
                  background="neutral0"
                  hasRadius
                  shadow="0px 1px 4px rgba(33, 33, 52, 0.1)"
                  borderColor="neutral150"
                >
                  <Box marginBottom={5}>
                    <Typography variant="delta" fontWeight="bold">
                      Basic Information
                    </Typography>
                  </Box>

                  <Flex direction="column" gap={5} width="100%">
                    {/* Title and Slug Row */}
                    <Flex gap={6} width="100%">
                      <Box flex="1">
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
                      </Box>

                      <Box flex="1">
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
                      </Box>
                    </Flex>

                    {/* Description - Full Width */}
                    <Box width="100%">
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
                    </Box>
                  </Flex>
                </Box>

                {/* Form Builder Component */}
                <FormBuilder
                  fields={formData.fields}
                  onChange={(fields) => updateField('fields', fields)}
                />
              </Tabs.Content>

              {/* Settings Tab */}
              <Tabs.Content value="settings">
                {/* new toggle switch button */}
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
                    shadowshadow="0px 1px 4px rgba(33, 33, 52, 0.1)"
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
                    shadow="0px 1px 4px rgba(33, 33, 52, 0.1)"
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
            </Tabs.Root>
          </Flex>
        </Grid.Item>
        <Grid.Item s={3}>
          <Box width="100%">
            <Flex direction="column" gap="12px" padding="16px" background="white">
              <Typography alignItems="start" variant="sigma" textColor="#666687">
                Entry
              </Typography>
              <Button
                height="3.2rem"
                width="100%"
                onClick={handleSave}
                loading={isSaving}
                disabled={isSaving || (!hasChanges && !isCreating)}
              >
                {isCreating ? 'Create' : 'Save'}
              </Button>
            </Flex>
          </Box>
        </Grid.Item>
      </Grid.Root>
    </Flex>
  );
};
