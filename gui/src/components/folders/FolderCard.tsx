import { Folder } from 'lucide-react';
import { cn } from '@src/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface FolderCardProps {
  name: string;
  subtitle?: string;
  secondarySubtitle?: string;
  icon?: LucideIcon;
  selected?: boolean;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onClick?: () => void;
}

export function FolderCard(props: FolderCardProps) {
  const {
    name,
    subtitle,
    secondarySubtitle,
    icon: Icon = Folder,
    selected = false,
    onDoubleClick,
    onContextMenu,
    onClick,
  } = props;

  function handleContextMenu(e: React.MouseEvent) {
    e.stopPropagation();
    onContextMenu?.(e);
  }

  return (
    <button
      type='button'
      className={cn(
        'group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center',
        'transition-all duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'cursor-default select-none',
        selected ? 'border-primary ring-2 ring-primary shadow-sm' : 'border-border shadow-sm hover:border-border',
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={handleContextMenu}
      aria-label={name}
      aria-pressed={selected}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-lg p-2 transition-colors duration-200',
          selected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
        )}
      >
        <Icon className='size-12' strokeWidth={1.5} />
      </div>

      <div className='w-full space-y-0.5'>
        <p
          className={cn(
            'truncate text-xs font-medium leading-tight',
            selected ? 'text-primary' : 'text-card-foreground',
          )}
          title={name}
        >
          {name}
        </p>

        {subtitle && (
          <p className='truncate text-xs text-muted-foreground' title={subtitle}>
            {subtitle}
          </p>
        )}

        {secondarySubtitle && (
          <p className='truncate text-xs text-muted-foreground opacity-70' title={secondarySubtitle}>
            {secondarySubtitle}
          </p>
        )}
      </div>
    </button>
  );
}
