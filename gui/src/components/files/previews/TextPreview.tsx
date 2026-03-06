import { useEffect, useState } from 'react'
import { cn } from '@src/lib/utils'

interface TextPreviewProps {
  previewUrl: string
  fullscreen?: boolean
}

export function TextPreview(props: TextPreviewProps) {
  const { previewUrl, fullscreen = false } = props
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setHasError(false)
    setContent(null)

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
      <div
        className={cn(
          'flex items-center justify-center text-sm text-muted-foreground',
          fullscreen ? 'h-full' : 'h-48',
        )}
      >
        Loading preview...
      </div>
    )
  }

  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-sm text-muted-foreground',
          fullscreen ? 'h-full' : 'h-48',
        )}
      >
        Failed to load preview
      </div>
    )
  }

  return (
    <pre
      className={cn(
        'overflow-auto rounded-md bg-muted text-xs leading-relaxed whitespace-pre-wrap break-words',
        fullscreen ? 'h-full p-4' : 'max-h-80 p-3',
      )}
    >
      <code>{content}</code>
    </pre>
  )
}
