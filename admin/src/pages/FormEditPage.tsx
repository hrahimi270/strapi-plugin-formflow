import { Main, Box, Typography, Flex, Button, Link } from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { useParams, useNavigate } from 'react-router-dom';

export const FormEditPage = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  return (
    <Main>
      <Box padding={8} background="neutral100">
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap={4}>
            <Link startIcon={<ArrowLeft />} onClick={() => navigate('/plugins/strapi-forms')}>
              Back
            </Link>
            <Box>
              <Typography variant="alpha" as="h1">
                {isEditing ? 'Edit Form' : 'Create Form'}
              </Typography>
              <Typography variant="epsilon" textColor="neutral600">
                {isEditing
                  ? 'Modify your form configuration'
                  : 'Build a new form with custom fields'}
              </Typography>
            </Box>
          </Flex>
          <Flex gap={2}>
            <Button variant="secondary" onClick={() => navigate('/plugins/strapi-forms')}>
              Cancel
            </Button>
            <Button>Save</Button>
          </Flex>
        </Flex>
      </Box>
      <Box padding={8}>
        <Typography>{isEditing ? `Editing form: ${id}` : 'Form builder coming soon...'}</Typography>
      </Box>
    </Main>
  );
};
