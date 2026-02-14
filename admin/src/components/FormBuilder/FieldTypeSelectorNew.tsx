import { Modal, Button, Tabs, Typography, Flex, Divider } from '@strapi/design-system';
import FieldIcon from '../shared/FieldIcon';
import { useFieldTypes } from '../../hooks';

interface FieldTypeSelectorNewProps {
  trigger: React.ReactNode;
  onSelect: (type: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
}

const FieldTypeSelectorNew = ({
  trigger,
  onSelect,
  isOpen,
  onOpenChange,
  name,
}: FieldTypeSelectorNewProps) => {
  const { fieldTypesByCategory } = useFieldTypes();

  const defaultValue = Object.keys(fieldTypesByCategory)[0];

  const numberOfTypesPerCategory: number[] = [];
  Object.keys(fieldTypesByCategory).forEach((category) => {
    const numberOfTypes = fieldTypesByCategory[category].length;
    numberOfTypesPerCategory.push(numberOfTypes);
  });
  const maximumNumberOfTypesInAnyCategory = Math.max(...numberOfTypesPerCategory);

  return (
    <Modal.Root open={isOpen} onOpenChange={onOpenChange}>
      <Modal.Trigger>{trigger}</Modal.Trigger>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tabs.Root variant="simple" defaultValue={defaultValue}>
            <Flex justifyContent="space-between">
              <Typography variant="beta" tag="h2">
                Select a field for your form
              </Typography>
              <Tabs.List>
                {Object.keys(fieldTypesByCategory).map((category) => (
                  <Tabs.Trigger key={category} value={category}>
                    {category}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Flex>
            <Divider marginBottom="24px" />
            {Object.entries(fieldTypesByCategory).map(([category, items]) => (
              <Tabs.Content key={category} value={category}>
                <Flex gap="12px" wrap="wrap">
                  {items.map((item) => (
                    <Button
                      onClick={() => onSelect(item.type)}
                      cursor="pointer"
                      hasRadius
                      justifyContent="flex-start"
                      padding="16px"
                      variant="tertiary"
                      width="calc(calc(100% - 12px) / 2)"
                      key={item.type}
                    >
                      <Flex gap="16px">
                        <FieldIcon fiedlType={item.type} />
                        <Flex direction="column" alignItems="flex-start">
                          <Typography variant="omega" textColor="neutral800">
                            {item.label}
                          </Typography>
                          <Typography variant="pi" textColor="neutral600" fontWeight="400">
                            {item.label} Description
                          </Typography>
                        </Flex>
                      </Flex>
                    </Button>
                  ))}
                  {Array.from(
                    { length: maximumNumberOfTypesInAnyCategory - items.length },
                    (_, index) => (
                      <Flex
                        key={index}
                        borderWidth="1px"
                        borderColor="transparent"
                        direction="column"
                        padding="16px"
                        width="calc(calc(100% - 12px) / 2)"
                        style={{
                          visibility: 'hidden',
                        }}
                      >
                        <Flex direction="column">
                          <Typography variant="omega" textColor="neutral800">
                            Placeholder Title
                          </Typography>
                          <Typography variant="pi" textColor="neutral600" fontWeight="400">
                            Placeholder Description
                          </Typography>
                        </Flex>
                      </Flex>
                    )
                  )}
                </Flex>
              </Tabs.Content>
            ))}
          </Tabs.Root>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
};

export default FieldTypeSelectorNew;