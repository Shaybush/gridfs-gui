import type { ReactNode } from 'react';

interface FolderEmptyAreaProps {
  children: ReactNode;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function FolderEmptyArea({ children, onContextMenu }: FolderEmptyAreaProps) {
  return (
    <div className='min-h-full w-full' onContextMenu={onContextMenu}>
      {children}
    </div>
  );
}
