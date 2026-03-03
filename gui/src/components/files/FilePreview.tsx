import { useEffect, useState } from 'react'
import { Download, FileX, Maximize2 } from 'lucide-react'
import { resolveContentType } from '@src/common/utils/content-type'
import { Button } from '@src/components/ui/button'
import { cn } from '@src/lib/utils'
import type { FileInfo } from '@src/types/file'

interface FilePreviewProps {
  fileInfo: FileInfo
  previewUrl: string
  downloadUrl: string
  onExpandClick?: () => void
}

function TextPreview(props: { previewUrl: string; fullscreen?: boolean }) {
  const { previewUrl, fullscreen } = props
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setHasError(false)

    async function loadContent() {
      try {
        const res = await fetch(previewUrl, { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to fetch')
        const text = await res.text()
        if (!cancelled) setContent(text)
      } catch {
        if (!cancelled) setHasError(true)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadContent()
    return () => { cancelled = true }
  }, [previewUrl])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Loading preview...
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Failed to load preview
      </div>
    )
  }

  return (
    <pre
      className={cn(
        'overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap break-words',
        fullscreen ? 'h-full' : 'max-h-80',
      )}
    >
      <code>{content}</code>
    </pre>
  )
}

export function FilePreview(props: FilePreviewProps) {
  const { fileInfo, previewUrl, downloadUrl, onExpandClick } = props
  const contentType = resolveContentType(fileInfo.content_type, fileInfo.filename)

  const expandButton = onExpandClick ? (
    <Button
      variant="secondary"
      size="icon-sm"
      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity size-7 z-10"
      onClick={onExpandClick}
      aria-label="Fullscreen preview"
      title="Fullscreen preview"
    >
      <Maximize2 className="size-3.5" />
    </Button>
  ) : null

  if (contentType.startsWith('image/')) {
    return (
      <div className="group relative flex items-center justify-center rounded-md bg-muted/50 p-2">
        {expandButton}
        <img
          src={previewUrl}
          alt={fileInfo.filename}
          className="max-h-80 max-w-full rounded object-contain"
        />
      </div>
    )
  }

  if (contentType === 'application/pdf') {
    return (
      <div className="group relative">
        {expandButton}
        <iframe
          src={previewUrl}
          title={fileInfo.filename}
          className="h-96 w-full rounded-md border"
        />
      </div>
    )
  }

  if (
    contentType.startsWith('text/') ||
    contentType === 'application/json' ||
    contentType === 'application/xml'
  ) {
    return (
      <div className="group relative">
        {expandButton}
        <TextPreview previewUrl={previewUrl} />
      </div>
    )
  }

  if (contentType.startsWith('video/')) {
    return (
      <div className="group relative">
        {expandButton}
        <video
          src={previewUrl}
          controls
          className="w-full rounded-md"
          style={{ maxHeight: '320px' }}
        >
          Your browser does not support the video element.
        </video>
      </div>
    )
  }

  if (contentType.startsWith('audio/')) {
    return (
      <div className="group relative">
        {expandButton}
        <audio src={previewUrl} controls className="w-full">
          Your browser does not support the audio element.
        </audio>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md bg-muted/50 py-10 text-center">
      <FileX className="size-10 text-muted-foreground opacity-50" />
      <p className="text-sm text-muted-foreground">Preview not available for this file type</p>
      <Button variant="outline" size="sm" asChild>
        <a href={downloadUrl} download={fileInfo.filename}>
          <Download className="mr-1.5 size-4" />
          Download to view
        </a>
      </Button>
    </div>
  )
}
