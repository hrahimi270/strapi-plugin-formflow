import { Dialog, Button, Typography, Flex } from '@strapi/design-system';
import { WarningCircle } from '@strapi/icons';
import { ReactNode } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'success' | 'default';
  isConfirming?: boolean;
  icon?: ReactNode; // Not-optional in the future!
}

/**
 * Reusable confirmation dialog component
 * Used for destructive actions like delete operations
 */
export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isConfirming = false,
  icon,
}: ConfirmDialogProps) => {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
        <Dialog.Content>
          <Dialog.Header>{title}</Dialog.Header>
          <Dialog.Body>
            <Flex direction="column" alignItems="center" gap="8px">
              {icon && icon}
              <Typography textAlign="center" textColor="neutral800">
                {message}
              </Typography>
            </Flex>
          </Dialog.Body>
          <Dialog.Footer display="flex" gap="8px">
            <Dialog.Cancel flex="1" height="3.2rem">
              <Button variant="tertiary" disabled={isConfirming}>
                {cancelLabel}
              </Button>
            </Dialog.Cancel>
            <Dialog.Action flex="1" height="3.2rem">
              <Button
                variant={variant}
                onClick={handleConfirm}
                loading={isConfirming}
                disabled={isConfirming}
              >
                {confirmLabel}
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
};
