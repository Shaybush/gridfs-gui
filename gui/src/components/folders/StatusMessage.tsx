import { cn } from '@src/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatusMessageProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  variant?: 'default' | 'error';
}

export function StatusMessage({ icon: Icon, title, description, variant = 'default' }: StatusMessageProps) {
  const isError = variant === 'error';

  return (
    <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
      <div
        className={cn(
          'flex size-14 items-center justify-center rounded-full',
          isError ? 'bg-destructive/10' : 'bg-muted',
        )}
      >
        <Icon className={cn('size-7', isError ? 'text-destructive opacity-70' : 'text-muted-foreground opacity-50')} />
      </div>
      <div className='space-y-1'>
        <p className='text-sm font-medium text-foreground'>{title}</p>
        {description && <p className='max-w-xs text-xs text-muted-foreground'>{description}</p>}
      </div>
    </div>
  );
}
