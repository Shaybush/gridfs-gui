import { useState } from 'react';
import { Download, FolderOpen, Info, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { formatFileSize } from '@src/common/utils/format-file-size';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@src/components/ui/alert-dialog';
import { Button } from '@src/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@src/components/ui/context-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@src/components/ui/dialog';
import { Input } from '@src/components/ui/input';
import { Label } from '@src/components/ui/label';
import type { BucketStats } from '@src/types/bucket';

interface BucketContextMenuProps {
  children: React.ReactNode;
  bucketName: string;
  onOpen: () => void;
  onRename: (newName: string) => Promise<void>;
  onUpload: () => void;
  onExport: () => Promise<void>;
  onDelete: () => Promise<void>;
  getBucketStats: (name: string) => Promise<BucketStats>;
}

export function BucketContextMenu(props: BucketContextMenuProps) {
  const { children, bucketName, onOpen, onRename, onUpload, onExport, onDelete, getBucketStats } = props;

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [bucketStats, setBucketStats] = useState<BucketStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isExporting, setIsExporting] = useState(false);

  function handleRenameOpen() {
    setRenameValue(bucketName);
    setIsRenameOpen(true);
  }

  function handleRenameClose() {
    setIsRenameOpen(false);
    setRenameValue('');
  }

  async function handleRenameSubmit() {
    const trimmed = renameValue.trim();
    if (!trimmed) return;

    setIsRenaming(true);
    try {
      await onRename(trimmed);
      toast.success(`Bucket renamed to "${trimmed}"`);
      handleRenameClose();
    } catch {
      toast.error('Failed to rename bucket');
    } finally {
      setIsRenaming(false);
    }
  }

  async function handlePropertiesOpen() {
    setIsPropertiesOpen(true);
    setBucketStats(null);
    setIsLoadingStats(true);
    try {
      const stats = await getBucketStats(bucketName);
      setBucketStats(stats);
    } catch {
      toast.error('Failed to load bucket properties');
    } finally {
      setIsLoadingStats(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await onExport();
      toast.success('Export completed');
    } catch {
      toast.error('Failed to export bucket');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete();
      toast.success(`Bucket "${bucketName}" deleted`);
      setIsDeleteOpen(false);
    } catch {
      toast.error('Failed to delete bucket');
    } finally {
      setIsDeleting(false);
    }
  }

  const isRenameValid = renameValue.trim().length > 0;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

        <ContextMenuContent className='w-52'>
          <ContextMenuItem onSelect={onOpen}>
            <FolderOpen />
            Open
          </ContextMenuItem>

          <ContextMenuItem onSelect={handleRenameOpen}>
            <Pencil />
            Rename
          </ContextMenuItem>

          <ContextMenuItem onSelect={onUpload}>
            <Upload />
            Upload Files Here
          </ContextMenuItem>

          <ContextMenuItem onSelect={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className='animate-spin' /> : <Download />}
            Export All
          </ContextMenuItem>

          <ContextMenuItem onSelect={handlePropertiesOpen}>
            <Info />
            Properties
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem variant='destructive' onSelect={() => setIsDeleteOpen(true)}>
            <Trash2 />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={(open) => !open && handleRenameClose()}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>Rename Bucket</DialogTitle>
          </DialogHeader>

          <div className='flex flex-col gap-1.5 py-2'>
            <Label htmlFor='rename-input'>New name</Label>
            <Input
              id='rename-input'
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isRenameValid && !isRenaming) {
                  handleRenameSubmit();
                }
              }}
              placeholder='Bucket name'
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={handleRenameClose} disabled={isRenaming}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit} disabled={!isRenameValid || isRenaming}>
              {isRenaming && <Loader2 className='mr-1.5 size-4 animate-spin' />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Properties Dialog */}
      <Dialog open={isPropertiesOpen} onOpenChange={setIsPropertiesOpen}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>Bucket Properties</DialogTitle>
          </DialogHeader>

          <div className='py-2'>
            {isLoadingStats && (
              <div className='flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground'>
                <Loader2 className='size-4 animate-spin' />
                Loading...
              </div>
            )}

            {!isLoadingStats && bucketStats && (
              <dl className='flex flex-col gap-3 text-sm'>
                <div className='flex items-center justify-between gap-4'>
                  <dt className='text-muted-foreground'>Name</dt>
                  <dd className='break-all text-right font-medium'>{bucketStats.name}</dd>
                </div>
                <div className='flex items-center justify-between gap-4'>
                  <dt className='text-muted-foreground'>File count</dt>
                  <dd className='font-medium'>{bucketStats.file_count.toLocaleString()}</dd>
                </div>
                <div className='flex items-center justify-between gap-4'>
                  <dt className='text-muted-foreground'>Total size</dt>
                  <dd className='font-medium'>{formatFileSize(bucketStats.total_size)}</dd>
                </div>
                <div className='flex items-center justify-between gap-4'>
                  <dt className='text-muted-foreground'>Avg file size</dt>
                  <dd className='font-medium'>{formatFileSize(bucketStats.avg_file_size)}</dd>
                </div>
              </dl>
            )}

            {!isLoadingStats && !bucketStats && (
              <p className='py-4 text-center text-sm text-muted-foreground'>Could not load bucket properties.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setIsPropertiesOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{bucketName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete bucket {bucketName}? This will permanently delete all files in this
              bucket.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className='mr-1.5 size-4 animate-spin' />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
