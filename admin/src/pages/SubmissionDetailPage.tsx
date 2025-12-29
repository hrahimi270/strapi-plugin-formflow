import { Main, Box, Typography, Flex, Button, Link } from '@strapi/design-system';
import { ArrowLeft, Trash } from '@strapi/icons';
import { useParams, useNavigate } from 'react-router-dom';

export const SubmissionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <Main>
      <Box padding={8} background="neutral100">
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap={4}>
            <Link startIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
              Back
            </Link>
            <Box>
              <Typography variant="alpha" as="h1">
                Submission Details
              </Typography>
              <Typography variant="epsilon" textColor="neutral600">
                View submission data and metadata
              </Typography>
            </Box>
          </Flex>
          <Button startIcon={<Trash />} variant="danger-light">
            Delete
          </Button>
        </Flex>
      </Box>
      <Box padding={8}>
        <Typography>Submission {id} details coming soon...</Typography>
      </Box>
    </Main>
  );
};
