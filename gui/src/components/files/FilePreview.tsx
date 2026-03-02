import { useEffect, useState } from 'react'
import { Download, FileX } from 'lucide-react'
import { Button } from '@src/components/ui/button'
import type { FileInfo } from '@src/types/file'

interface FilePreviewProps {
  fileInfo: FileInfo
  previewUrl: string
  downloadUrl: string
}

function TextPreview(props: { previewUrl: string }) {
  const { previewUrl } = props
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
    <pre className="overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed max-h-80 whitespace-pre-wrap break-words">
      <code>{content}</code>
    </pre>
  )
}

export function FilePreview(props: FilePreviewProps) {
  const { fileInfo, previewUrl, downloadUrl } = props
  const contentType = fileInfo.content_type ?? ''

  if (contentType.startsWith('image/')) {
    return (
      <div className="flex items-center justify-center rounded-md bg-muted/50 p-2">
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
      <iframe
        src={previewUrl}
        title={fileInfo.filename}
        className="h-96 w-full rounded-md border"
      />
    )
  }

  if (
    contentType.startsWith('text/') ||
    contentType === 'application/json' ||
    contentType === 'application/xml'
  ) {
    return <TextPreview previewUrl={previewUrl} />
  }

  if (contentType.startsWith('video/')) {
    return (
      <video
        src={previewUrl}
        controls
        className="w-full rounded-md"
        style={{ maxHeight: '320px' }}
      >
        Your browser does not support the video element.
      </video>
    )
  }

  if (contentType.startsWith('audio/')) {
    return (
      <audio src={previewUrl} controls className="w-full">
        Your browser does not support the audio element.
      </audio>
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
