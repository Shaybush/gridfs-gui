import {
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  FileX,
  Upload,
} from 'lucide-react'
import { formatFileSize } from '@src/common/utils/format-file-size'
import { Pagination } from '@src/components/files/Pagination'
import { Button } from '@src/components/ui/button'
import type { FileInfo, FileListResponse } from '@src/types/file'

function FileTypeIcon(props: { contentType: string | null; className?: string }) {
  const { contentType, className = 'size-8 text-muted-foreground' } = props
  const ct = contentType ?? ''

  if (ct.startsWith('image/')) return <FileImage className={className} />
  if (ct.startsWith('video/')) return <FileVideo className={className} />
  if (ct.startsWith('audio/')) return <FileAudio className={className} />
  if (ct === 'application/pdf') return <FileText className={className} />
  if (ct.startsWith('text/') || ct === 'application/json') return <FileCode className={className} />
  return <FileText className={className} />
}

interface FileCardProps {
  file: FileInfo
  previewUrl: string
  onClick: (file: FileInfo) => void
}

function FileCard(props: FileCardProps) {
  const { file, previewUrl, onClick } = props
  const isImage = file.content_type?.startsWith('image/')

  return (
    <button
      className="group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onClick(file)}
      aria-label={`Open ${file.filename}`}
      type="button"
    >
      {/* Thumbnail */}
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
        {isImage ? (
          <img
            src={previewUrl}
            alt={file.filename}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <FileTypeIcon contentType={file.content_type} className="size-10 text-muted-foreground opacity-60" />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 p-2.5">
        <p
          className="truncate text-xs font-medium text-foreground"
          title={file.filename}
        >
          {file.filename}
        </p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.length)}</p>
      </div>
    </button>
  )
}

interface FileGridProps {
  files: FileInfo[]
  fileListResponse: FileListResponse | null
  isLoading: boolean
  getPreviewUrl: (fileId: string) => string
  onFileClick: (file: FileInfo) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onUploadClick: () => void
}

function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <div className="aspect-square bg-muted animate-pulse" />
      <div className="flex flex-col gap-1.5 p-2.5">
        <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
      </div>
    </div>
  )
}

export function FileGrid(props: FileGridProps) {
  const {
    files,
    fileListResponse,
    isLoading,
    getPreviewUrl,
    onFileClick,
    onPageChange,
    onPageSizeChange,
    onUploadClick,
  } = props

  return (
    <div className="flex flex-col gap-4">
      {/* Skeleton grid */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && files.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <FileX className="size-8 text-muted-foreground opacity-50" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No files in this bucket</p>
            <p className="text-xs text-muted-foreground">Upload files to get started</p>
          </div>
          <Button size="sm" onClick={onUploadClick}>
            <Upload className="mr-1.5 size-4" />
            Upload Files
          </Button>
        </div>
      )}

      {/* File cards */}
      {!isLoading && files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              previewUrl={getPreviewUrl(file.id)}
              onClick={onFileClick}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && fileListResponse && fileListResponse.total > 0 && (
        <Pagination
          fileListResponse={fileListResponse}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  )
}
