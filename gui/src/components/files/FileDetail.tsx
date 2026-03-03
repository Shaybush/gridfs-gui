import { useState, useRef, useEffect } from 'react'
import { Check, Copy, Download, Loader2, MoveRight, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@src/common/utils/format-date'
import { formatFileSize } from '@src/common/utils/format-file-size'
import { CopyMoveDialog } from '@src/components/files/CopyMoveDialog'
import { FilePreview } from '@src/components/files/FilePreview'
import { FullscreenPreview } from '@src/components/files/FullscreenPreview'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@src/components/ui/alert-dialog'
import { Badge } from '@src/components/ui/badge'
import { Button } from '@src/components/ui/button'
import { Input } from '@src/components/ui/input'
import { Separator } from '@src/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@src/components/ui/sheet'
import type { BucketInfo } from '@src/types/bucket'
import type { FileInfo } from '@src/types/file'

interface DetailRowProps {
  label: string
  value: string | null | undefined
}

function DetailRow(props: DetailRowProps) {
  const { label, value } = props
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground break-all">{value ?? '—'}</span>
    </div>
  )
}

interface FileDetailProps {
  file: FileInfo | null
  previewUrl: string
  downloadUrl: string
  onClose: () => void
  onDelete: (fileId: string) => Promise<void>
  onRename?: (fileId: string, newFilename: string) => Promise<FileInfo>
  onUpdateMetadata?: (fileId: string, metadata: Record<string, any>) => Promise<FileInfo>
  onCopy?: (fileId: string, targetBucket: string) => Promise<void>
  onMove?: (fileId: string, targetBucket: string) => Promise<void>
  buckets?: BucketInfo[]
  currentBucket?: string
  // Fullscreen navigation support
  files?: FileInfo[]
  onNavigate?: (file: FileInfo) => void
  getPreviewUrl?: (fileId: string) => string
  getDownloadUrl?: (fileId: string) => string
}

export function FileDetail(props: FileDetailProps) {
  const {
    file,
    previewUrl,
    downloadUrl,
    onClose,
    onDelete,
    onRename,
    onUpdateMetadata,
    onCopy,
    onMove,
    buckets = [],
    currentBucket = '',
    files = [],
    onNavigate,
    getPreviewUrl,
    getDownloadUrl,
  } = props

  const [isDeleting, setIsDeleting] = useState(false)
  const [copyMoveDialog, setCopyMoveDialog] = useState<{
    open: boolean
    mode: 'copy' | 'move'
  }>({ open: false, mode: 'copy' })
  const [isCopyMoveLoading, setIsCopyMoveLoading] = useState(false)

  // Fullscreen modal visibility
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleCopyMoveConfirm = async (targetBucket: string) => {
    if (!file) return
    const { mode } = copyMoveDialog
    setIsCopyMoveLoading(true)
    try {
      if (mode === 'copy' && onCopy) {
        await onCopy(file.id, targetBucket)
      } else if (mode === 'move' && onMove) {
        await onMove(file.id, targetBucket)
        onClose()
      }
      setCopyMoveDialog({ open: false, mode: 'copy' })
    } finally {
      setIsCopyMoveLoading(false)
    }
  }

  const handleCopyMoveCancel = () => {
    setCopyMoveDialog({ open: false, mode: 'copy' })
  }

  // Inline filename rename in sheet header
  const [isRenamingTitle, setIsRenamingTitle] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [isSavingRename, setIsSavingRename] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Metadata editor
  const [isEditingMetadata, setIsEditingMetadata] = useState(false)
  const [metadataValue, setMetadataValue] = useState('')
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [isSavingMetadata, setIsSavingMetadata] = useState(false)
  const metadataTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset edit states when the file changes
  useEffect(() => {
    setIsRenamingTitle(false)
    setRenameValue('')
    setIsEditingMetadata(false)
    setMetadataValue('')
    setMetadataError(null)
    // Do NOT reset isFullscreen here — when navigating in fullscreen the file
    // prop changes, but we want to stay in fullscreen mode.
  }, [file?.id])

  // Close fullscreen when the sheet closes
  useEffect(() => {
    if (!file) {
      setIsFullscreen(false)
    }
  }, [file])

  // Auto-focus rename input
  useEffect(() => {
    if (isRenamingTitle && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenamingTitle])

  // Auto-focus metadata textarea
  useEffect(() => {
    if (isEditingMetadata && metadataTextareaRef.current) {
      metadataTextareaRef.current.focus()
    }
  }, [isEditingMetadata])

  const handleDelete = async () => {
    if (!file) return
    setIsDeleting(true)
    try {
      await onDelete(file.id)
      toast.success('File deleted successfully')
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete file')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRenameStart = () => {
    if (!file) return
    setRenameValue(file.filename)
    setIsRenamingTitle(true)
  }

  const handleRenameCancel = () => {
    setIsRenamingTitle(false)
    setRenameValue('')
  }

  const handleRenameSave = async () => {
    if (!file || !onRename || !renameValue.trim()) {
      handleRenameCancel()
      return
    }
    setIsSavingRename(true)
    try {
      await onRename(file.id, renameValue.trim())
      setIsRenamingTitle(false)
      toast.success('File renamed successfully')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to rename file')
    } finally {
      setIsSavingRename(false)
    }
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSave()
    } else if (e.key === 'Escape') {
      handleRenameCancel()
    }
  }

  const handleMetadataEditStart = () => {
    if (!file) return
    const hasExistingMetadata = file.metadata && Object.keys(file.metadata).length > 0
    setMetadataValue(hasExistingMetadata ? JSON.stringify(file.metadata, null, 2) : '{}')
    setMetadataError(null)
    setIsEditingMetadata(true)
  }

  const handleMetadataCancel = () => {
    setIsEditingMetadata(false)
    setMetadataValue('')
    setMetadataError(null)
  }

  const handleMetadataSave = async () => {
    if (!file || !onUpdateMetadata) return

    let parsed: Record<string, any>
    try {
      parsed = JSON.parse(metadataValue)
    } catch {
      setMetadataError('Invalid JSON — please fix the syntax before saving.')
      return
    }

    setIsSavingMetadata(true)
    setMetadataError(null)
    try {
      await onUpdateMetadata(file.id, parsed)
      setIsEditingMetadata(false)
      toast.success('Metadata updated successfully')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update metadata')
    } finally {
      setIsSavingMetadata(false)
    }
  }

  const chunkCount = file && file.chunk_size > 0 ? Math.ceil(file.length / file.chunk_size) : 0
  const hasMetadata = Boolean(file?.metadata && Object.keys(file.metadata).length > 0)

  // Index of the currently selected file in the files array
  const currentIndex = file ? files.findIndex((f) => f.id === file.id) : -1

  // Whether fullscreen navigation is available
  const canFullscreen = Boolean(file && getPreviewUrl && getDownloadUrl)

  // Safe wrappers that always provide a string (never undefined)
  const safeGetPreviewUrl = (fileId: string) => getPreviewUrl?.(fileId) ?? ''
  const safeGetDownloadUrl = (fileId: string) => getDownloadUrl?.(fileId) ?? ''

  return (
    <>
    <Sheet open={file !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="px-6 pb-4">
          {isRenamingTitle ? (
            <div className="flex items-center gap-1.5 pr-6">
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                className="h-8 text-sm flex-1"
                disabled={isSavingRename}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleRenameSave}
                disabled={isSavingRename}
                aria-label="Save rename"
                title="Save"
                className="shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950"
              >
                {isSavingRename ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleRenameCancel}
                disabled={isSavingRename}
                aria-label="Cancel rename"
                title="Cancel"
                className="shrink-0"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/title pr-6">
              <SheetTitle className="break-all text-base leading-snug flex-1">
                {file?.filename ?? ''}
              </SheetTitle>
              {onRename && file && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0"
                  onClick={handleRenameStart}
                  aria-label="Rename file"
                  title="Rename"
                >
                  <Pencil className="size-3" />
                </Button>
              )}
            </div>
          )}
        </SheetHeader>

        {file && (
          <div className="flex flex-col gap-5 px-6">
            {/* Preview */}
            <FilePreview
              fileInfo={file}
              previewUrl={previewUrl}
              downloadUrl={downloadUrl}
              onExpandClick={canFullscreen ? () => setIsFullscreen(true) : undefined}
            />

            <Separator />

            {/* File details */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                File Details
              </p>
              <div className="space-y-2">
                <DetailRow label="Size" value={formatFileSize(file.length)} />
                <DetailRow label="Content Type" value={file.content_type} />
                <DetailRow label="Upload Date" value={formatDate(file.upload_date)} />
                <DetailRow label="Chunk Size" value={formatFileSize(file.chunk_size)} />
                <DetailRow label="Chunk Count" value={String(chunkCount)} />
                <DetailRow label="File ID" value={file.id} />
              </div>
            </div>

            {/* Metadata */}
            <Separator />
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Metadata
                </p>
                {onUpdateMetadata && !isEditingMetadata && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 text-xs px-2"
                    onClick={handleMetadataEditStart}
                  >
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                )}
              </div>

              {isEditingMetadata ? (
                <div className="space-y-2">
                  <textarea
                    ref={metadataTextareaRef}
                    value={metadataValue}
                    onChange={(e) => {
                      setMetadataValue(e.target.value)
                      setMetadataError(null)
                    }}
                    rows={8}
                    className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50"
                    disabled={isSavingMetadata}
                    spellCheck={false}
                  />
                  {metadataError && (
                    <p className="text-xs text-destructive">{metadataError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleMetadataSave}
                      disabled={isSavingMetadata}
                    >
                      {isSavingMetadata ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      ) : (
                        <Check className="mr-1 size-3" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleMetadataCancel}
                      disabled={isSavingMetadata}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : hasMetadata ? (
                <pre className="overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed max-h-40 whitespace-pre-wrap break-words">
                  {JSON.stringify(file.metadata, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic">No metadata</p>
              )}
            </div>

            {/* Content type badge */}
            {file.content_type && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs">
                  {file.content_type}
                </Badge>
              </div>
            )}

            <Separator />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pb-6">
              <Button asChild className="flex-1">
                <a href={downloadUrl} download={file.filename}>
                  <Download className="mr-1.5 size-4" />
                  Download
                </a>
              </Button>

              {onCopy && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCopyMoveDialog({ open: true, mode: 'copy' })}
                >
                  <Copy className="mr-1.5 size-4" />
                  Copy to...
                </Button>
              )}

              {onMove && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCopyMoveDialog({ open: true, mode: 'move' })}
                >
                  <MoveRight className="mr-1.5 size-4" />
                  Move to...
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1.5 size-4" />
                    )}
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete file?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete{' '}
                      <span className="font-medium text-foreground">{file.filename}</span>. This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>

    <CopyMoveDialog
      open={copyMoveDialog.open}
      mode={copyMoveDialog.mode}
      file={file}
      buckets={buckets}
      currentBucket={currentBucket}
      onConfirm={handleCopyMoveConfirm}
      onCancel={handleCopyMoveCancel}
      isLoading={isCopyMoveLoading}
    />

    {/* Fullscreen preview */}
    {canFullscreen && file && (
      <FullscreenPreview
        open={isFullscreen}
        onOpenChange={setIsFullscreen}
        fileInfo={file}
        previewUrl={safeGetPreviewUrl(file.id)}
        downloadUrl={safeGetDownloadUrl(file.id)}
        files={files}
        currentIndex={currentIndex >= 0 ? currentIndex : 0}
        onNavigate={(navigatedFile) => {
          onNavigate?.(navigatedFile)
        }}
        getPreviewUrl={safeGetPreviewUrl}
        getDownloadUrl={safeGetDownloadUrl}
      />
    )}
    </>
  )
}
