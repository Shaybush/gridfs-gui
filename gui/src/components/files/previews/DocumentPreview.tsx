import { useEffect, useState } from 'react'
import { Download, FileX, Loader2 } from 'lucide-react'
import { Button } from '@src/components/ui/button'
import { cn } from '@src/lib/utils'

interface DocumentPreviewProps {
  previewUrl: string
  filename: string
  downloadUrl: string
  fullscreen?: boolean
}

export function DocumentPreview(props: DocumentPreviewProps) {
  const { previewUrl, filename, downloadUrl, fullscreen = false } = props
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    setIsLoading(true)
    setHasError(false)
    setBlobUrl(null)

    async function loadDocument() {
      try {
        const res = await fetch(previewUrl, { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to fetch document preview')
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) {
          setBlobUrl(objectUrl)
          setIsLoading(false)
        }
      } catch {
        if (!cancelled) {
          setHasError(true)
          setIsLoading(false)
        }
      }
    }

    loadDocument()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [previewUrl])

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-md bg-muted/50 text-sm text-muted-foreground',
          fullscreen ? 'h-full' : 'h-96',
        )}
      >
        <Loader2 className="size-6 animate-spin" />
        <span>Converting document...</span>
      </div>
    )
  }

  if (hasError || !blobUrl) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-md bg-muted/50 text-center',
          fullscreen ? 'h-full p-8' : 'h-96 py-10',
        )}
      >
        <FileX className={cn('text-muted-foreground opacity-50', fullscreen ? 'size-16' : 'size-10')} />
        <p className="text-sm text-muted-foreground">Failed to convert document for preview</p>
        <Button variant="outline" size={fullscreen ? 'default' : 'sm'} asChild>
          <a href={downloadUrl} download={filename}>
            <Download className="mr-1.5 size-4" />
            Download to view
          </a>
        </Button>
      </div>
    )
  }

  return (
    <iframe
      src={blobUrl}
      title={filename}
      className={cn(
        'border-0',
        fullscreen ? 'h-full w-full' : 'h-96 w-full rounded-md border',
      )}
    />
  )
}
