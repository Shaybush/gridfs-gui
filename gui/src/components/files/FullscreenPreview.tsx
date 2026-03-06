import { useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Download, FileX, X } from 'lucide-react'
import { isOfficeDocument, resolveContentType } from '@src/common/utils/content-type'
import { formatFileSize } from '@src/common/utils/format-file-size'
import { Badge } from '@src/components/ui/badge'
import { Button } from '@src/components/ui/button'
import { Dialog, DialogContent } from '@src/components/ui/dialog'
import { cn } from '@src/lib/utils'
import type { FileInfo } from '@src/types/file'
import { DocumentPreview } from './previews/DocumentPreview'
import { HTMLPreview } from './previews/HTMLPreview'
import { TextPreview } from './previews/TextPreview'

interface FullscreenPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileInfo: FileInfo
  previewUrl: string
  downloadUrl: string
  // Navigation
  files: FileInfo[]
  currentIndex: number
  onNavigate: (file: FileInfo) => void
  // URL generators
  getPreviewUrl: (fileId: string) => string
  getDownloadUrl: (fileId: string) => string
}

// ---------------------------------------------------------------------------
// Preview content — renders based on resolved content type
// ---------------------------------------------------------------------------
function FullscreenPreviewContent(props: {
  fileInfo: FileInfo
  previewUrl: string
  downloadUrl: string
}) {
  const { fileInfo, previewUrl, downloadUrl } = props
  const contentType = resolveContentType(fileInfo.content_type, fileInfo.filename)

  if (isOfficeDocument(contentType)) {
    return (
      <DocumentPreview
        previewUrl={previewUrl}
        filename={fileInfo.filename}
        downloadUrl={downloadUrl}
        fullscreen
      />
    )
  }

  if (contentType === 'text/csv') {
    return (
      <HTMLPreview
        previewUrl={previewUrl}
        filename={fileInfo.filename}
        fullscreen
        paginated
      />
    )
  }

  if (contentType === 'text/markdown') {
    return (
      <HTMLPreview
        previewUrl={previewUrl}
        filename={fileInfo.filename}
        fullscreen
      />
    )
  }

  if (contentType.startsWith('image/')) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/20 p-4">
        <img
          src={previewUrl}
          alt={fileInfo.filename}
          className="max-h-full max-w-full object-contain rounded"
        />
      </div>
    )
  }

  if (contentType === 'application/pdf') {
    return (
      <iframe
        src={previewUrl}
        title={fileInfo.filename}
        className="h-full w-full border-0"
      />
    )
  }

  if (
    contentType.startsWith('text/') ||
    contentType === 'application/json' ||
    contentType === 'application/xml'
  ) {
    return (
      <div className="h-full overflow-hidden p-4">
        <TextPreview previewUrl={previewUrl} fullscreen />
      </div>
    )
  }

  if (contentType.startsWith('video/')) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black p-4">
        <video
          src={previewUrl}
          controls
          className="max-h-full max-w-full"
        >
          Your browser does not support the video element.
        </video>
      </div>
    )
  }

  if (contentType.startsWith('audio/')) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8">
        <audio src={previewUrl} controls className="w-full max-w-md">
          Your browser does not support the audio element.
        </audio>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center p-8">
      <FileX className="size-16 text-muted-foreground opacity-40" />
      <p className="text-base text-muted-foreground">Preview not available for this file type</p>
      <Button variant="outline" asChild>
        <a href={downloadUrl} download={fileInfo.filename}>
          <Download className="mr-1.5 size-4" />
          Download to view
        </a>
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function FullscreenPreview(props: FullscreenPreviewProps) {
  const {
    open,
    onOpenChange,
    fileInfo,
    previewUrl,
    downloadUrl,
    files,
    currentIndex,
    onNavigate,
    getPreviewUrl,
    getDownloadUrl,
  } = props

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < files.length - 1

  const handlePrev = useCallback(() => {
    if (!hasPrev) return
    const prevFile = files[currentIndex - 1]
    if (prevFile) onNavigate(prevFile)
  }, [hasPrev, files, currentIndex, onNavigate])

  const handleNext = useCallback(() => {
    if (!hasNext) return
    const nextFile = files[currentIndex + 1]
    if (nextFile) onNavigate(nextFile)
  }, [hasNext, files, currentIndex, onNavigate])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      // Don't interfere when focus is inside an input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handlePrev, handleNext])

  // Resolve the active preview/download URLs (they may differ from props when
  // the parent hasn't re-rendered yet after navigation, but since we call
  // getPreviewUrl/getDownloadUrl with the current fileInfo.id they'll always
  // be correct regardless).
  const activePreviewUrl = getPreviewUrl(fileInfo.id) || previewUrl
  const activeDownloadUrl = getDownloadUrl(fileInfo.id) || downloadUrl

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex flex-col gap-0 p-0 rounded-none border-none',
          'h-[100dvh] max-h-[100dvh] min-h-[100dvh]',
          'w-screen max-w-[100vw] sm:max-w-[100vw]',
        )}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Header bar                                                        */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex shrink-0 items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur">
          {/* Prev button */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 shrink-0"
            disabled={!hasPrev}
            onClick={handlePrev}
            aria-label="Previous file"
            title="Previous file (←)"
          >
            <ChevronLeft className="size-4" />
          </Button>

          {/* Center: file info */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="min-w-0 truncate text-sm font-medium text-foreground"
              title={fileInfo.filename}
            >
              {fileInfo.filename}
            </span>
            <Badge variant="secondary" className="shrink-0 text-xs font-normal">
              {formatFileSize(fileInfo.length)}
            </Badge>
            {fileInfo.content_type && (
              <Badge variant="outline" className="shrink-0 text-xs font-normal hidden sm:inline-flex">
                {fileInfo.content_type}
              </Badge>
            )}
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-1">
            {/* Download */}
            <Button variant="ghost" size="icon-sm" className="size-8" asChild>
              <a
                href={activeDownloadUrl}
                download={fileInfo.filename}
                aria-label="Download file"
                title="Download"
              >
                <Download className="size-4" />
              </a>
            </Button>

            {/* Next button */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8"
              disabled={!hasNext}
              onClick={handleNext}
              aria-label="Next file"
              title="Next file (→)"
            >
              <ChevronRight className="size-4" />
            </Button>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8"
              onClick={() => onOpenChange(false)}
              aria-label="Close fullscreen preview"
              title="Close (Esc)"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Preview area — fills remaining height                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="min-h-0 flex-1 overflow-hidden bg-background">
          <FullscreenPreviewContent
            fileInfo={fileInfo}
            previewUrl={activePreviewUrl}
            downloadUrl={activeDownloadUrl}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
