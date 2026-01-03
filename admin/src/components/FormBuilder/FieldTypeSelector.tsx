import { useMemo } from 'react';
import { Modal, Box, Flex, Grid, Typography, Button } from '@strapi/design-system';
import {
  Pencil,
  Mail,
  Phone,
  Link as LinkIcon,
  Lock,
  ChevronDown,
  Check,
  Calendar,
  Clock,
  File,
  Eye,
  Minus,
} from '@strapi/icons';

import type { FieldType } from '../../utils/api';

interface FieldTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
  fieldTypes: FieldType[];
  isLoading?: boolean;
}

/**
 * Category display order and labels
 */
const CATEGORY_ORDER = ['basic', 'choice', 'datetime', 'advanced', 'layout'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  basic: 'Basic Fields',
  choice: 'Choice Fields',
  datetime: 'Date & Time',
  advanced: 'Advanced',
  layout: 'Layout Elements',
};

/**
 * Icon mapping for each field type
 * Using available Strapi icons
 */
const getFieldIcon = (type: string) => {
  const icons: Record<string, JSX.Element> = {
    text: <Pencil />,
    textarea: <Pencil />,
    email: <Mail />,
    number: <Pencil />,
    phone: <Phone />,
    url: <LinkIcon />,
    password: <Lock />,
    select: <ChevronDown />,
    radio: <Check />,
    checkbox: <Check />,
    boolean: <Check />,
    date: <Calendar />,
    time: <Clock />,
    datetime: <Calendar />,
    file: <File />,
    hidden: <Eye />,
    heading: <Pencil />,
    paragraph: <Pencil />,
    divider: <Minus />,
  };

  return icons[type] || <Pencil />;
};

/**
 * FieldTypeSelector modal component
 * Displays available field types organized by category for selection
 */
export const FieldTypeSelector = ({
  isOpen,
  onClose,
  onSelect,
  fieldTypes,
  isLoading = false,
}: FieldTypeSelectorProps) => {
  // Group field types by category
  const groupedTypes = useMemo(() => {
    const groups: Record<string, FieldType[]> = {};

    for (const fieldType of fieldTypes) {
      if (!groups[fieldType.category]) {
        groups[fieldType.category] = [];
      }
      groups[fieldType.category].push(fieldType);
    }

    return groups;
  }, [fieldTypes]);

  // Handle field type selection
  const handleSelect = (type: string) => {
    onSelect(type);
    onClose();
  };

  // Handle modal open state change
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Modal.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Add Field</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isLoading ? (
            <Box padding={8} textAlign="center">
              <Typography textColor="neutral600">Loading field types...</Typography>
            </Box>
          ) : fieldTypes.length === 0 ? (
            <Box padding={8} textAlign="center">
              <Typography textColor="neutral600">No field types available</Typography>
            </Box>
          ) : (
            <Flex direction="column" gap={6}>
              {CATEGORY_ORDER.map((category) => {
                const types = groupedTypes[category];
                if (!types?.length) return null;

                return (
                  <Box key={category}>
                    <Typography
                      variant="sigma"
                      textColor="neutral600"
                      textTransform="uppercase"
                      fontWeight="bold"
                    >
                      {CATEGORY_LABELS[category]}
                    </Typography>
                    <Box marginTop={3}>
                      <Grid.Root gap={3} gridCols={3}>
                        {types.map((fieldType) => (
                          <Grid.Item key={fieldType.type} col={1}>
                            <Box
                              as="button"
                              type="button"
                              background="neutral0"
                              borderColor="neutral200"
                              borderStyle="solid"
                              borderWidth="1px"
                              hasRadius
                              padding={4}
                              width="100%"
                              cursor="pointer"
                              onClick={() => handleSelect(fieldType.type)}
                              _hover={{
                                borderColor: 'primary600',
                                background: 'primary100',
                              }}
                              style={{
                                transition: 'all 0.2s ease-in-out',
                              }}
                            >
                              <Flex direction="column" alignItems="center" gap={2}>
                                <Box color="primary600">{getFieldIcon(fieldType.type)}</Box>
                                <Typography
                                  variant="pi"
                                  fontWeight="bold"
                                  textAlign="center"
                                  textColor="neutral800"
                                >
                                  {fieldType.label}
                                </Typography>
                              </Flex>
                            </Box>
                          </Grid.Item>
                        ))}
                      </Grid.Root>
                    </Box>
                  </Box>
                );
              })}
            </Flex>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Cancel</Button>
          </Modal.Close>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};
