import { Main, Box, Typography, Flex, Button, Link } from '@strapi/design-system';
import { ArrowLeft, Download } from '@strapi/icons';
import { useParams, useNavigate } from 'react-router-dom';

export const SubmissionsListPage = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  return (
    <Main>
      <Box padding={8} background="neutral100">
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap={4}>
            <Link startIcon={<ArrowLeft />} onClick={() => navigate('/plugins/strapi-forms')}>
              Back to Forms
            </Link>
            <Box>
              <Typography variant="alpha" as="h1">
                Submissions
              </Typography>
              <Typography variant="epsilon" textColor="neutral600">
                View and manage form submissions
              </Typography>
            </Box>
          </Flex>
          <Button startIcon={<Download />} variant="secondary">
            Export CSV
          </Button>
        </Flex>
      </Box>
      <Box padding={8}>
        <Typography>Submissions for form {formId} coming soon...</Typography>
      </Box>
    </Main>
  );
};
