import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  Download,
  FileX,
  Loader2,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@src/components/ui/button'
import { Input } from '@src/components/ui/input'
import { Checkbox } from '@src/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@src/components/ui/table'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@src/components/ui/dropdown-menu'
import { CopyMoveDialog } from '@src/components/files/CopyMoveDialog'
import { formatDate } from '@src/common/utils/format-date'
import { formatFileSize } from '@src/common/utils/format-file-size'
import { Pagination } from '@src/components/files/Pagination'
import type { BucketInfo } from '@src/types/bucket'
import type { FileInfo, FileListResponse } from '@src/types/file'

type SortField = 'uploadDate' | 'filename' | 'length'
type SortOrder = 'asc' | 'desc'

interface FileTableProps {
  files: FileInfo[]
  fileListResponse: FileListResponse | null
  isLoading: boolean
  sortField: SortField
  sortOrder: SortOrder
  onSort: (field: SortField) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onDownload: (file: FileInfo) => void
  onDelete: (fileId: string) => Promise<void>
  onUploadClick: () => void
  onFileClick?: (file: FileInfo) => void
  onBulkDelete: (fileIds: string[]) => Promise<void>
  onBulkDownload: (fileIds: string[]) => Promise<void>
  onCopy?: (fileId: string, targetBucket: string) => Promise<void>
  onMove?: (fileId: string, targetBucket: string) => Promise<void>
  buckets?: BucketInfo[]
  currentBucket?: string
  onRename?: (fileId: string, newFilename: string) => Promise<FileInfo>
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell><div className="size-4 rounded bg-muted animate-pulse" /></TableCell>
      <TableCell><div className="h-4 w-48 rounded bg-muted animate-pulse" /></TableCell>
      <TableCell><div className="h-4 w-16 rounded bg-muted animate-pulse" /></TableCell>
      <TableCell><div className="h-4 w-28 rounded bg-muted animate-pulse" /></TableCell>
      <TableCell><div className="h-4 w-32 rounded bg-muted animate-pulse" /></TableCell>
      <TableCell><div className="flex gap-2"><div className="size-8 rounded bg-muted animate-pulse" /><div className="size-8 rounded bg-muted animate-pulse" /></div></TableCell>
    </TableRow>
  )
}

interface SortableHeaderProps {
  field: SortField
  label: string
  currentField: SortField
  currentOrder: SortOrder
  onClick: () => void
}

function SortIcon(props: { isActive: boolean; order: SortOrder }) {
  if (!props.isActive) return <ArrowUpDown className="size-3.5 opacity-40" />
  if (props.order === 'asc') return <ArrowUp className="size-3.5" />
  return <ArrowDown className="size-3.5" />
}

function SortableHeader(props: SortableHeaderProps) {
  const { field, label, currentField, currentOrder, onClick } = props

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
    >
      {label}
      <SortIcon isActive={currentField === field} order={currentOrder} />
    </button>
  )
}

export function FileTable(props: FileTableProps) {
  const {
    files,
    fileListResponse,
    isLoading,
    sortField,
    sortOrder,
    onSort,
    onPageChange,
    onPageSizeChange,
    onDownload,
    onDelete,
    onUploadClick,
    onFileClick,
    onBulkDelete,
    onBulkDownload,
    onRename,
    onCopy,
    onMove,
    buckets = [],
    currentBucket = '',
  } = props

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [isBulkLoading, setIsBulkLoading] = useState(false)

  // Keyboard shortcuts: Delete for selected files, Ctrl+A to select all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Delete' && selectedIds.size > 0 && !isBulkLoading) {
        e.preventDefault()
        handleBulkDelete()
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && files.length > 0) {
        e.preventDefault()
        setSelectedIds(new Set(files.map((f) => f.id)))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds.size, isBulkLoading, files])

  const [copyMoveDialog, setCopyMoveDialog] = useState<{
    open: boolean
    mode: 'copy' | 'move'
    file: FileInfo | null
  }>({ open: false, mode: 'copy', file: null })
  const [isCopyMoveLoading, setIsCopyMoveLoading] = useState(false)

  const handleCopyMoveConfirm = useCallback(
    async (targetBucket: string) => {
      if (!copyMoveDialog.file) return
      const { mode, file } = copyMoveDialog
      setIsCopyMoveLoading(true)
      try {
        if (mode === 'copy' && onCopy) {
          await onCopy(file.id, targetBucket)
        } else if (mode === 'move' && onMove) {
          await onMove(file.id, targetBucket)
        }
        setCopyMoveDialog({ open: false, mode: 'copy', file: null })
      } finally {
        setIsCopyMoveLoading(false)
      }
    },
    [copyMoveDialog, onCopy, onMove],
  )

  const handleCopyMoveCancel = useCallback(() => {
    setCopyMoveDialog({ open: false, mode: 'copy', file: null })
  }, [])

  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingId])

  const handleRenameStart = (file: FileInfo) => {
    setEditingId(file.id)
    setEditValue(file.filename)
  }

  const handleRenameCancel = () => {
    setEditingId(null)
    setEditValue('')
  }

  const handleRenameSave = async (fileId: string) => {
    if (!onRename || !editValue.trim()) {
      handleRenameCancel()
      return
    }
    setSavingId(fileId)
    try {
      await onRename(fileId, editValue.trim())
      setEditingId(null)
      setEditValue('')
      toast.success('File renamed successfully')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to rename file')
    } finally {
      setSavingId(null)
    }
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, fileId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSave(fileId)
    } else if (e.key === 'Escape') {
      handleRenameCancel()
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(files.map((f) => f.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (fileId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(fileId)
      } else {
        next.delete(fileId)
      }
      return next
    })
  }

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId)
    try {
      await onDelete(fileId)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(fileId)
        return next
      })
      toast.success('File deleted successfully')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete file')
    } finally {
      setDeletingId(null)
    }
  }

  const handleBulkDelete = async () => {
    setIsBulkLoading(true)
    try {
      await onBulkDelete(Array.from(selectedIds))
      setSelectedIds(new Set())
    } finally {
      setIsBulkLoading(false)
    }
  }

  const handleBulkDownload = async () => {
    setIsBulkLoading(true)
    try {
      await onBulkDownload(Array.from(selectedIds))
    } finally {
      setIsBulkLoading(false)
    }
  }

  const allSelected = files.length > 0 && selectedIds.size === files.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < files.length
  const checkboxState = someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'

  return (
    <div className="flex flex-col gap-4">
      {/* Bulk actions toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
          <span className="text-sm font-medium text-foreground px-1">
            {selectedIds.size} {selectedIds.size === 1 ? 'file' : 'files'} selected
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isBulkLoading}
              onClick={handleBulkDownload}
            >
              {isBulkLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download Selected
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isBulkLoading}
                >
                  {isBulkLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Delete Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedIds.size} {selectedIds.size === 1 ? 'file' : 'files'}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {selectedIds.size} {selectedIds.size === 1 ? 'file' : 'files'}. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              variant="ghost"
              size="sm"
              disabled={isBulkLoading}
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="size-4" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  data-state={checkboxState}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                  disabled={isLoading || files.length === 0}
                />
              </TableHead>
              <TableHead>
                <SortableHeader
                  field="filename"
                  label="Filename"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onClick={() => onSort('filename')}
                />
              </TableHead>
              <TableHead>
                <SortableHeader
                  field="length"
                  label="Size"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onClick={() => onSort('length')}
                />
              </TableHead>
              <TableHead className="hidden md:table-cell">Content Type</TableHead>
              <TableHead>
                <SortableHeader
                  field="uploadDate"
                  label="Upload Date"
                  currentField={sortField}
                  currentOrder={sortOrder}
                  onClick={() => onSort('uploadDate')}
                />
              </TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}

            {!isLoading && files.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <FileX className="size-10 text-muted-foreground opacity-50" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">No files in this bucket</p>
                      <p className="text-xs text-muted-foreground">
                        Upload files to get started
                      </p>
                    </div>
                    <Button size="sm" onClick={onUploadClick}>
                      Upload Files
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!isLoading && files.map((file) => (
              <TableRow
                key={file.id}
                data-state={selectedIds.has(file.id) ? 'selected' : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(file.id)}
                    onCheckedChange={(checked) => handleSelectOne(file.id, Boolean(checked))}
                    aria-label={`Select ${file.filename}`}
                  />
                </TableCell>
                <TableCell>
                  {editingId === file.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        ref={renameInputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleRenameKeyDown(e, file.id)}
                        className="h-7 max-w-[220px] text-sm py-0 px-2"
                        disabled={savingId === file.id}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRenameSave(file.id)}
                        disabled={savingId === file.id}
                        aria-label="Save rename"
                        title="Save"
                        className="shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        {savingId === file.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleRenameCancel}
                        disabled={savingId === file.id}
                        aria-label="Cancel rename"
                        title="Cancel"
                        className="shrink-0"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group/rename">
                      {onFileClick ? (
                        <button
                          className="max-w-[240px] truncate font-medium text-left hover:underline hover:text-primary transition-colors"
                          title={file.filename}
                          onClick={() => onFileClick(file)}
                          onDoubleClick={() => onRename && handleRenameStart(file)}
                          type="button"
                        >
                          {file.filename}
                        </button>
                      ) : (
                        <span
                          className="max-w-[240px] truncate font-medium"
                          title={file.filename}
                          onDoubleClick={() => onRename && handleRenameStart(file)}
                        >
                          {file.filename}
                        </span>
                      )}
                      {onRename && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-5 opacity-0 group-hover/rename:opacity-100 transition-opacity shrink-0"
                          onClick={() => handleRenameStart(file)}
                          aria-label={`Rename ${file.filename}`}
                          title="Rename"
                        >
                          <Pencil className="size-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatFileSize(file.length)}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  <span className="truncate" title={file.content_type ?? undefined}>
                    {file.content_type ?? '—'}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(file.upload_date)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end">
                    <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="File actions"
                            disabled={deletingId === file.id}
                          >
                            {deletingId === file.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onDownload(file)}>
                            <Download className="mr-2 size-4" />
                            Download
                          </DropdownMenuItem>
                          {onCopy && (
                            <DropdownMenuItem
                              onClick={() => setCopyMoveDialog({ open: true, mode: 'copy', file })}
                            >
                              <Copy className="mr-2 size-4" />
                              Copy to...
                            </DropdownMenuItem>
                          )}
                          {onMove && (
                            <DropdownMenuItem
                              onClick={() => setCopyMoveDialog({ open: true, mode: 'move', file })}
                            >
                              <MoveRight className="mr-2 size-4" />
                              Move to...
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete file?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete{' '}
                            <span className="font-medium text-foreground">
                              {file.filename}
                            </span>
                            . This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(file.id)}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && fileListResponse && fileListResponse.total > 0 && (
        <Pagination
          fileListResponse={fileListResponse}
          selectedCount={selectedIds.size}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}

      <CopyMoveDialog
        open={copyMoveDialog.open}
        mode={copyMoveDialog.mode}
        file={copyMoveDialog.file}
        buckets={buckets}
        currentBucket={currentBucket}
        onConfirm={handleCopyMoveConfirm}
        onCancel={handleCopyMoveCancel}
        isLoading={isCopyMoveLoading}
      />
    </div>
  )
}
