import { Main, Box, Typography, Flex, Button } from '@strapi/design-system';
import { Plus } from '@strapi/icons';
import { useNavigate } from 'react-router-dom';

export const FormsListPage = () => {
  const navigate = useNavigate();

  return (
    <Main>
      <Box padding={8} background="neutral100">
        <Flex justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="alpha" as="h1">
              Forms
            </Typography>
            <Typography variant="epsilon" textColor="neutral600">
              Create and manage your forms
            </Typography>
          </Box>
          <Button startIcon={<Plus />} onClick={() => navigate('forms/create')}>
            Create Form
          </Button>
        </Flex>
      </Box>
      <Box padding={8}>
        <Typography>Forms list coming soon...</Typography>
      </Box>
    </Main>
  );
};
