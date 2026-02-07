// Source: https://github.com/strapi/strapi/issues/21823#issuecomment-2410564868
// Modified to fit current project needs

import * as Tooltip from '@radix-ui/react-tooltip';
import { Typography, Box, IconButton } from '@strapi/design-system';

interface TooltipIconButtonProps {
  children: React.ReactNode;
  label: string;
  onClick?: (event: MouseEvent) => void;
}

const TooltipIconButton = ({ children, label, onClick }: TooltipIconButtonProps) => {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger>
          <IconButton variant="ghost" onClick={onClick} withTooltip={false}>
            {children}
          </IconButton>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={5}>
            <Box
              background="neutral900"
              padding="8px"
              borderRadius="4px"
              fontSize="1.2rem"
              fontWeight={600}
            >
              <Typography variant="pi" textColor="#fff">{label}</Typography>
            </Box>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default TooltipIconButton;
