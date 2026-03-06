import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FileX, Loader2 } from 'lucide-react'
import { Button } from '@src/components/ui/button'
import { cn } from '@src/lib/utils'

interface HTMLPreviewProps {
  previewUrl: string
  filename: string
  fullscreen?: boolean
  paginated?: boolean
}

interface FetchedPage {
  html: string
  totalPages: number
}

const ROWS_PER_PAGE = 100

async function fetchHTMLPage(url: string, page: number, rowsPerPage: number): Promise<FetchedPage> {
  const fetchUrl = new URL(url, window.location.origin)
  fetchUrl.searchParams.set('page', String(page))
  fetchUrl.searchParams.set('rows_per_page', String(rowsPerPage))

  const res = await fetch(fetchUrl.toString(), { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch HTML preview')

  const totalPagesHeader = res.headers.get('X-Total-Pages')
  const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : 1
  const html = await res.text()

  return { html, totalPages }
}

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch HTML preview')
  return res.text()
}

export function HTMLPreview(props: HTMLPreviewProps) {
  const { previewUrl, filename, fullscreen = false, paginated = false } = props

  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const cancelledRef = useRef(false)

  const loadContent = useCallback(
    async (page: number) => {
      cancelledRef.current = false
      setIsLoading(true)
      setHasError(false)

      try {
        if (paginated) {
          const { html, totalPages: tp } = await fetchHTMLPage(previewUrl, page, ROWS_PER_PAGE)
          if (!cancelledRef.current) {
            setHtmlContent(html)
            setTotalPages(tp)
          }
        } else {
          const html = await fetchHTML(previewUrl)
          if (!cancelledRef.current) setHtmlContent(html)
        }
      } catch {
        if (!cancelledRef.current) setHasError(true)
      } finally {
        if (!cancelledRef.current) setIsLoading(false)
      }
    },
    [previewUrl, paginated],
  )

  useEffect(() => {
    cancelledRef.current = false
    setCurrentPage(1)
    setTotalPages(1)
    loadContent(1)

    return () => { cancelledRef.current = true }
  }, [loadContent])

  function handlePrevPage(): void {
    if (currentPage <= 1) return
    const newPage = currentPage - 1
    setCurrentPage(newPage)
    loadContent(newPage)
  }

  function handleNextPage(): void {
    if (currentPage >= totalPages) return
    const newPage = currentPage + 1
    setCurrentPage(newPage)
    loadContent(newPage)
  }

  // Create a blob URL from HTML content that is properly cleaned up
  const blobUrl = useMemo(() => {
    if (!htmlContent) return null
    return URL.createObjectURL(new Blob([htmlContent], { type: 'text/html' }))
  }, [htmlContent])

  // Revoke the blob URL when it changes or on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-md bg-muted/50 text-sm text-muted-foreground',
          fullscreen ? 'h-full' : 'h-96',
        )}
      >
        <Loader2 className="size-6 animate-spin" />
        <span>Loading preview...</span>
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
        <p className="text-sm text-muted-foreground">Failed to load preview</p>
      </div>
    )
  }

  const hasPrev = paginated && currentPage > 1
  const hasNext = paginated && currentPage < totalPages

  return (
    <div className={cn('flex flex-col', fullscreen ? 'h-full' : '')}>
      <iframe
        key={blobUrl}
        src={blobUrl}
        title={filename}
        sandbox="allow-same-origin"
        className={cn(
          'border-0',
          fullscreen ? 'h-full w-full flex-1 min-h-0' : 'h-96 w-full rounded-md border',
          paginated && !fullscreen ? 'rounded-b-none border-b-0' : '',
          paginated && fullscreen ? 'flex-1' : '',
        )}
      />

      {paginated && (
        <div
          className={cn(
            'flex items-center justify-between gap-2 bg-muted/50 px-3 py-2',
            fullscreen
              ? 'shrink-0 border-t'
              : 'rounded-b-md border border-t-0',
          )}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            disabled={!hasPrev}
            onClick={handlePrevPage}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>

          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            disabled={!hasNext}
            onClick={handleNextPage}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
