import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@src/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@src/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@src/components/ui/select'
import type { BucketInfo } from '@src/types/bucket'
import type { FileInfo } from '@src/types/file'

interface CopyMoveDialogProps {
  open: boolean
  mode: 'copy' | 'move'
  file: FileInfo | null
  buckets: BucketInfo[]
  currentBucket: string
  onConfirm: (targetBucket: string) => void
  onCancel: () => void
  isLoading: boolean
}

export function CopyMoveDialog(props: CopyMoveDialogProps) {
  const { open, mode, file, buckets, currentBucket, onConfirm, onCancel, isLoading } = props

  const [targetBucket, setTargetBucket] = useState<string>('')

  const availableBuckets = buckets.filter((b) => b.name !== currentBucket)
  const title = mode === 'copy' ? 'Copy File' : 'Move File'
  const confirmLabel = mode === 'copy' ? 'Copy' : 'Move'

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTargetBucket('')
      onCancel()
    }
  }

  const handleConfirm = () => {
    if (!targetBucket) return
    onConfirm(targetBucket)
    setTargetBucket('')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {file && (
            <p className="text-sm text-muted-foreground">
              File:{' '}
              <span className="font-medium text-foreground break-all">{file.filename}</span>
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Target bucket</p>
            {availableBuckets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other buckets available. Create a bucket first.
              </p>
            ) : (
              <Select value={targetBucket} onValueChange={setTargetBucket}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a bucket" />
                </SelectTrigger>
                <SelectContent>
                  {availableBuckets.map((bucket) => (
                    <SelectItem key={bucket.name} value={bucket.name}>
                      {bucket.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!targetBucket || isLoading || availableBuckets.length === 0}
          >
            {isLoading && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
