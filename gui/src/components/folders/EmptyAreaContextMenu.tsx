import { useState } from 'react';
import { ArrowUpDown, Clipboard, FolderPlus, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@src/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@src/components/ui/context-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@src/components/ui/dialog';
import { Input } from '@src/components/ui/input';
import { Label } from '@src/components/ui/label';
import type { SortField } from '@src/hooks/useSortPreference';

interface EmptyAreaContextMenuProps {
  children: React.ReactNode;
  onCreateBucket: (name: string) => Promise<void>;
  onRefresh: () => void;
  sortField: SortField;
  onSortFieldChange: (field: SortField) => void;
}

export function EmptyAreaContextMenu(props: EmptyAreaContextMenuProps) {
  const { children, onCreateBucket, onRefresh, sortField, onSortFieldChange } = props;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [bucketName, setBucketName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  function handleOpenDialog() {
    setBucketName('');
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    if (isCreating) return;
    setIsDialogOpen(false);
    setBucketName('');
  }

  async function handleCreateBucket() {
    const trimmedName = bucketName.trim();
    if (!trimmedName) {
      toast.error('Bucket name cannot be empty.');
      return;
    }

    setIsCreating(true);
    try {
      await onCreateBucket(trimmedName);
      toast.success(`Bucket "${trimmedName}" created successfully.`);
      setIsDialogOpen(false);
      setBucketName('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create bucket.';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  }

  const isNameValid = bucketName.trim().length > 0;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

        <ContextMenuContent className='w-48'>
          <ContextMenuItem onSelect={handleOpenDialog}>
            <FolderPlus />
            New Bucket
          </ContextMenuItem>

          <ContextMenuItem onSelect={onRefresh}>
            <RefreshCw />
            Refresh
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ArrowUpDown />
              Sort by
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className='w-40'>
              <ContextMenuRadioGroup value={sortField} onValueChange={(v) => onSortFieldChange(v as SortField)}>
                <ContextMenuRadioItem value='name'>Name</ContextMenuRadioItem>
                <ContextMenuRadioItem value='file_count'>File Count</ContextMenuRadioItem>
                <ContextMenuRadioItem value='total_size'>Total Size</ContextMenuRadioItem>
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          <ContextMenuItem disabled className='cursor-not-allowed opacity-50'>
            <Clipboard />
            Paste
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Create Bucket</DialogTitle>
          </DialogHeader>

          <div className='flex flex-col gap-3 py-2'>
            <Label htmlFor='bucket-name'>Bucket Name</Label>
            <Input
              id='bucket-name'
              placeholder='e.g. my-bucket'
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating) {
                  handleCreateBucket();
                }
              }}
              disabled={isCreating}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={handleCloseDialog} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateBucket} disabled={isCreating || !isNameValid}>
              {isCreating && <Loader2 className='mr-1.5 size-4 animate-spin' />}
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
