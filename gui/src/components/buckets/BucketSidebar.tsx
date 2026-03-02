import { useState } from 'react'
import { FolderOpen, FolderPlus, HardDrive, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@src/lib/utils'
import { Button } from '@src/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@src/components/ui/dialog'
import { Input } from '@src/components/ui/input'
import { Label } from '@src/components/ui/label'
import { useBuckets } from '@src/hooks/useBuckets'
import { formatFileSize } from '@src/common/utils/format-file-size'
import type { BucketInfo } from '@src/types/bucket'

interface BucketSidebarProps {
  connId: string
  dbName: string
  selectedBucket: string | null
  onSelectBucket: (bucket: string) => void
}

function BucketSkeletonItem() {
  return (
    <div className="flex animate-pulse flex-col gap-1 rounded-md p-2.5">
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
    </div>
  )
}

interface CreateBucketDialogProps {
  onCreateBucket: (name: string) => Promise<void>
}

function CreateBucketDialog(props: CreateBucketDialogProps) {
  const { onCreateBucket } = props

  const [open, setOpen] = useState(false)
  const [bucketName, setBucketName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    const trimmed = bucketName.trim()
    if (!trimmed) return

    setIsCreating(true)
    try {
      await onCreateBucket(trimmed)
      toast.success(`Bucket "${trimmed}" created successfully`)
      setBucketName('')
      setOpen(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create bucket')
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCreate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Create bucket">
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Bucket</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bucket-name">Bucket name</Label>
            <Input
              id="bucket-name"
              placeholder="e.g. images, documents"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!bucketName.trim() || isCreating}
          >
            {isCreating && <Loader2 className="size-4 animate-spin" />}
            Create Bucket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface BucketItemProps {
  bucket: BucketInfo
  isSelected: boolean
  onClick: () => void
}

function BucketItem(props: BucketItemProps) {
  const { bucket, isSelected, onClick } = props

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-0.5 rounded-md p-2.5 text-left transition-colors',
        isSelected
          ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]'
          : 'hover:bg-[var(--sidebar-accent)]/60 text-[var(--sidebar-foreground)]',
      )}
    >
      <div className="flex items-center gap-2">
        <FolderOpen className="size-3.5 shrink-0 opacity-70" />
        <span className="truncate text-sm font-medium">{bucket.name}</span>
      </div>
      <div className="flex items-center gap-3 pl-5.5">
        <span className="text-xs opacity-60">
          {bucket.file_count} {bucket.file_count === 1 ? 'file' : 'files'}
        </span>
        <span className="text-xs opacity-60">{formatFileSize(bucket.total_size)}</span>
      </div>
    </button>
  )
}

export function BucketSidebar(props: BucketSidebarProps) {
  const { connId, dbName, selectedBucket, onSelectBucket } = props

  const { buckets, isLoading, error, createBucket } = useBuckets(connId, dbName)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <HardDrive className="size-3.5 text-[var(--sidebar-foreground)] opacity-50" />
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--sidebar-foreground)] opacity-50">
            Buckets
          </p>
        </div>
        <CreateBucketDialog onCreateBucket={createBucket} />
      </div>

      <div className="flex flex-col gap-0.5">
        {isLoading && (
          <>
            <BucketSkeletonItem />
            <BucketSkeletonItem />
            <BucketSkeletonItem />
          </>
        )}

        {!isLoading && error && (
          <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>
        )}

        {!isLoading && !error && buckets.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <FolderPlus className="size-6 text-[var(--sidebar-foreground)] opacity-30" />
            <p className="text-xs text-[var(--sidebar-foreground)] opacity-50">
              No buckets yet.
              <br />
              Create one to get started.
            </p>
          </div>
        )}

        {!isLoading && !error && buckets.map((bucket) => (
          <BucketItem
            key={bucket.name}
            bucket={bucket}
            isSelected={selectedBucket === bucket.name}
            onClick={() => onSelectBucket(bucket.name)}
          />
        ))}
      </div>
    </div>
  )
}
