import { FolderOpen, RefreshCw } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@src/components/ui/context-menu';

interface DatabaseContextMenuProps {
  children: React.ReactNode;
  onOpen: () => void;
  onRefresh: () => void;
}

export function DatabaseContextMenu(props: DatabaseContextMenuProps) {
  const { children, onOpen, onRefresh } = props;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onOpen}>
          <FolderOpen />
          Open
        </ContextMenuItem>
        <ContextMenuItem onSelect={onRefresh}>
          <RefreshCw />
          Refresh
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
