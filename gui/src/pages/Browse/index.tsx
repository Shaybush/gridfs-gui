import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  Database,
  LayoutGrid,
  LayoutList,
  ListFilter,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@src/lib/utils'
import { useActiveConnection } from '@src/contexts/ActiveConnectionContext'
import { useBuckets } from '@src/hooks/useBuckets'
import { useBrowseNavigation } from '@src/hooks/useBrowseNavigation'
import { useSortPreference } from '@src/hooks/useSortPreference'
import { useFiles } from '@src/hooks/useFiles'
import type { FileFilters } from '@src/hooks/useFiles'
import { Button } from '@src/components/ui/button'
import { Badge } from '@src/components/ui/badge'
import { BackButton } from '@src/components/navigation/BackButton'
import { BrowseBreadcrumb } from '@src/components/navigation/BrowseBreadcrumb'
import { DatabaseGrid } from '@src/components/folders/DatabaseGrid'
import { BucketGrid } from '@src/components/folders/BucketGrid'
import { FileTable } from '@src/components/files/FileTable'
import { FileGrid } from '@src/components/files/FileGrid'
import { FileDetail } from '@src/components/files/FileDetail'
import { FilterPanel } from '@src/components/files/FilterPanel'
import { SearchBar } from '@src/components/files/SearchBar'
import { UploadZone } from '@src/components/files/UploadZone'
import type { FileInfo } from '@src/types/file'

type FileSortField = 'uploadDate' | 'filename' | 'length'
type SortOrder = 'asc' | 'desc'
type ViewMode = 'table' | 'grid'

function countActiveFilters(filters: FileFilters): number {
  return Object.values(filters).filter((v) => v !== undefined && v !== null && v !== '').length
}

export default function BrowsePage() {
  const { connId } = useParams<{ connId: string }>()
  const navigate = useNavigate()
  const { activeConnection } = useActiveConnection()

  // Folder navigation state (URL-synced)
  const { currentLevel, selectedDatabase, selectedBucket, navigateTo, goBack, breadcrumbs } =
    useBrowseNavigation()

  // Folder sort preferences (localStorage-persisted)
  const { sortField: folderSortField, sortDirection: folderSortDirection, setSortField: setFolderSortField } =
    useSortPreference()

  const [showUpload, setShowUpload] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  // Filter state
  const [filters, setFilters] = useState<FileFilters>({})
  const [showFilters, setShowFilters] = useState(false)

  // Selected file for detail panel
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)

  // Pagination + sort state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [sortField, setSortField] = useState<FileSortField>('uploadDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Stable ref so fetchFiles doesn't cause infinite loops
  const fetchFilesRef = useRef<
    ((
      page?: number,
      limit?: number,
      sort?: FileSortField,
      order?: SortOrder,
      filters?: FileFilters,
    ) => Promise<void>) | null
  >(null)

  const filtersRef = useRef<FileFilters>(filters)
  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  const resolvedConnId = connId ?? activeConnection?.id

  const { buckets } = useBuckets(resolvedConnId, selectedDatabase ?? undefined)

  const {
    files,
    fileListResponse,
    isLoading: isLoadingFiles,
    uploadProgress,
    fetchFiles,
    uploadFiles,
    deleteFile,
    getDownloadUrl,
    getPreviewUrl,
    bulkDelete,
    bulkDownload,
    renameFile,
    updateMetadata,
    copyFile,
    moveFile,
  } = useFiles(resolvedConnId, selectedDatabase ?? undefined, selectedBucket ?? undefined)

  // Keep ref updated
  useEffect(() => {
    fetchFilesRef.current = fetchFiles
  }, [fetchFiles])

  // When bucket selection changes, reset page and close upload
  useEffect(() => {
    if (!selectedBucket) return
    setPage(1)
    setShowUpload(false)
  }, [selectedBucket, selectedDatabase])

  // Reset file-level state when navigating away from files
  useEffect(() => {
    if (currentLevel !== 'files') {
      setSelectedFile(null)
      setShowUpload(false)
      setShowFilters(false)
      setFilters({})
    }
  }, [currentLevel])

  // Refetch when page / limit / sort changes (skip first mount — useFiles auto-fetches)
  const isFirstMount = useRef(true)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    fetchFilesRef.current?.(page, limit, sortField, sortOrder, filtersRef.current)
  }, [page, limit, sortField, sortOrder])

  // If no active connection, redirect
  useEffect(() => {
    if (!resolvedConnId) {
      navigate('/')
    }
  }, [resolvedConnId, navigate])

  const activeFilterCount = countActiveFilters(filters)

  const handleSelectDatabase = useCallback(
    (dbName: string) => {
      navigateTo('buckets', dbName)
    },
    [navigateTo],
  )

  const handleSelectBucket = useCallback(
    (bucketName: string) => {
      navigateTo('files', bucketName)
    },
    [navigateTo],
  )

  const handleUploadToBucket = useCallback(
    (bucketName: string) => {
      navigateTo('files', bucketName)
      // Small delay to let the navigation settle before showing upload
      setTimeout(() => setShowUpload(true), 100)
    },
    [navigateTo],
  )

  const handleSort = useCallback(
    (field: FileSortField) => {
      if (field === sortField) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortOrder('desc')
      }
      setPage(1)
    },
    [sortField],
  )

  const handlePageSizeChange = useCallback((size: number) => {
    setLimit(size)
    setPage(1)
  }, [])

  const handleDownload = useCallback(
    (file: FileInfo) => {
      const url = getDownloadUrl(file.id)
      if (!url) return
      const a = document.createElement('a')
      a.href = url
      a.download = file.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    },
    [getDownloadUrl],
  )

  const handleDelete = useCallback(
    async (fileId: string) => {
      await deleteFile(fileId)
      await fetchFilesRef.current?.(page, limit, sortField, sortOrder, filtersRef.current)
    },
    [deleteFile, page, limit, sortField, sortOrder],
  )

  const handleCopy = useCallback(
    async (fileId: string, targetBucket: string) => {
      await copyFile(fileId, targetBucket)
      toast.success(`File copied to ${targetBucket}`)
    },
    [copyFile],
  )

  const handleMove = useCallback(
    async (fileId: string, targetBucket: string) => {
      await moveFile(fileId, targetBucket)
      toast.success(`File moved to ${targetBucket}`)
      await fetchFilesRef.current?.(page, limit, sortField, sortOrder, filtersRef.current)
    },
    [moveFile, page, limit, sortField, sortOrder],
  )

  const handleRename = useCallback(
    async (fileId: string, newFilename: string) => {
      const updated = await renameFile(fileId, newFilename)
      await fetchFilesRef.current?.(page, limit, sortField, sortOrder, filtersRef.current)
      setSelectedFile((prev) => (prev?.id === fileId ? { ...prev, filename: updated.filename } : prev))
      return updated
    },
    [renameFile, page, limit, sortField, sortOrder],
  )

  const handleUpdateMetadata = useCallback(
    async (fileId: string, metadata: Record<string, any>) => {
      const updated = await updateMetadata(fileId, metadata)
      await fetchFilesRef.current?.(page, limit, sortField, sortOrder, filtersRef.current)
      setSelectedFile((prev) => (prev?.id === fileId ? { ...prev, metadata: updated.metadata } : prev))
      return updated
    },
    [updateMetadata, page, limit, sortField, sortOrder],
  )

  const handleUpload = useCallback(
    async (filesToUpload: File[], metadata?: Record<string, any>) => {
      setIsUploading(true)
      try {
        await uploadFiles(filesToUpload, metadata)
        toast.success(
          `${filesToUpload.length} ${filesToUpload.length === 1 ? 'file' : 'files'} uploaded successfully`,
        )
        setShowUpload(false)
        await fetchFilesRef.current?.(1, limit, sortField, sortOrder, filtersRef.current)
        setPage(1)
      } catch (err: any) {
        toast.error(err?.message ?? 'Upload failed')
      } finally {
        setIsUploading(false)
      }
    },
    [uploadFiles, limit, sortField, sortOrder],
  )

  const handleSearch = useCallback(
    (value: string) => {
      const updatedFilters = { ...filtersRef.current, search: value || undefined }
      setFilters(updatedFilters)
      setPage(1)
      fetchFilesRef.current?.(1, limit, sortField, sortOrder, updatedFilters)
    },
    [limit, sortField, sortOrder],
  )

  const handleFiltersChange = useCallback(
    (updatedFilters: FileFilters) => {
      setFilters(updatedFilters)
      setPage(1)
      fetchFilesRef.current?.(1, limit, sortField, sortOrder, updatedFilters)
    },
    [limit, sortField, sortOrder],
  )

  const handleFileClick = useCallback((file: FileInfo) => {
    setSelectedFile(file)
  }, [])

  const handleDetailClose = useCallback(() => {
    setSelectedFile(null)
  }, [])

  const handleBulkDelete = useCallback(
    async (fileIds: string[]) => {
      const result = await bulkDelete(fileIds)
      const msg =
        result.errors.length > 0
          ? `Deleted ${result.deleted} files. ${result.errors.length} error(s).`
          : `${result.deleted} ${result.deleted === 1 ? 'file' : 'files'} deleted successfully`
      if (result.errors.length > 0) {
        toast.error(msg)
      } else {
        toast.success(msg)
      }
      await fetchFilesRef.current?.(page, limit, sortField, sortOrder, filtersRef.current)
    },
    [bulkDelete, page, limit, sortField, sortOrder],
  )

  const handleBulkDownload = useCallback(
    async (fileIds: string[]) => {
      await bulkDownload(fileIds)
      toast.success(`Downloading ${fileIds.length} ${fileIds.length === 1 ? 'file' : 'files'} as ZIP`)
    },
    [bulkDownload],
  )

  // No connection state
  if (!resolvedConnId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Database className="size-8 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold text-foreground">No Connection Selected</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Please select an active connection to browse files.
          </p>
        </div>
        <Button onClick={() => navigate('/')}>Go to Connections</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar: back button + breadcrumb + controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onGoBack={goBack} hidden={currentLevel === 'databases'} />
          <BrowseBreadcrumb
            breadcrumbs={breadcrumbs}
            onNavigate={navigateTo}
          />
        </div>

        {/* Controls - only visible at files level */}
        {currentLevel === 'files' && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => setShowUpload((prev) => !prev)}
              variant={showUpload ? 'outline' : 'default'}
            >
              {showUpload ? (
                <>
                  <X className="size-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Upload
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Upload zone - files level only */}
      {currentLevel === 'files' && showUpload && selectedBucket && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Upload Files</h3>
          <UploadZone
            uploadProgress={uploadProgress}
            isUploading={isUploading}
            onUpload={handleUpload}
            onClose={() => setShowUpload(false)}
          />
        </div>
      )}

      {/* Main content area - switches by level */}
      {currentLevel === 'databases' && (
        <DatabaseGrid
          connId={resolvedConnId}
          onSelectDatabase={handleSelectDatabase}
        />
      )}

      {currentLevel === 'buckets' && selectedDatabase && (
        <BucketGrid
          connId={resolvedConnId}
          dbName={selectedDatabase}
          onSelectBucket={handleSelectBucket}
          sortField={folderSortField}
          sortDirection={folderSortDirection}
          onSortFieldChange={setFolderSortField}
          onUploadToBucket={handleUploadToBucket}
        />
      )}

      {currentLevel === 'files' && selectedBucket && (
        <div className="flex flex-col gap-3">
          {/* Toolbar: search + filter toggle + view toggle */}
          <div className="flex items-center gap-2">
            <SearchBar
              onSearch={handleSearch}
              className="flex-1 max-w-sm"
            />

            {/* Filter toggle */}
            <div className="relative">
              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setShowFilters((prev) => !prev)}
              >
                <ListFilter className="size-4" />
                Filters
              </Button>
              {activeFilterCount > 0 && (
                <Badge
                  variant="default"
                  className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full p-0 text-[10px] leading-none"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </div>

            {/* View mode toggle */}
            <div className="flex items-center rounded-md border bg-background">
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn('h-8 w-8 rounded-r-none', viewMode === 'table' && 'bg-muted')}
                onClick={() => setViewMode('table')}
                aria-label="Table view"
                title="Table view"
              >
                <LayoutList className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn('h-8 w-8 rounded-l-none border-l', viewMode === 'grid' && 'bg-muted')}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                title="Grid view"
              >
                <LayoutGrid className="size-4" />
              </Button>
            </div>
          </div>

          {/* Collapsible filter panel */}
          {showFilters && (
            <FilterPanel filters={filters} onChange={handleFiltersChange} />
          )}

          {/* File view */}
          {viewMode === 'table' ? (
            <FileTable
              files={files}
              fileListResponse={fileListResponse}
              isLoading={isLoadingFiles}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onUploadClick={() => setShowUpload(true)}
              onFileClick={handleFileClick}
              onBulkDelete={handleBulkDelete}
              onBulkDownload={handleBulkDownload}
              onRename={handleRename}
              onCopy={handleCopy}
              onMove={handleMove}
              buckets={buckets}
              currentBucket={selectedBucket}
            />
          ) : (
            <FileGrid
              files={files}
              fileListResponse={fileListResponse}
              isLoading={isLoadingFiles}
              getPreviewUrl={getPreviewUrl}
              onFileClick={handleFileClick}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              onUploadClick={() => setShowUpload(true)}
            />
          )}
        </div>
      )}

      {/* File detail sheet - only relevant at files level */}
      {currentLevel === 'files' && (
        <FileDetail
          file={selectedFile}
          previewUrl={selectedFile ? getPreviewUrl(selectedFile.id) : ''}
          downloadUrl={selectedFile ? getDownloadUrl(selectedFile.id) : ''}
          onClose={handleDetailClose}
          onDelete={handleDelete}
          onRename={handleRename}
          onUpdateMetadata={handleUpdateMetadata}
          onCopy={handleCopy}
          onMove={handleMove}
          buckets={buckets}
          currentBucket={selectedBucket ?? ''}
          files={files}
          onNavigate={handleFileClick}
          getPreviewUrl={getPreviewUrl}
          getDownloadUrl={getDownloadUrl}
        />
      )}
    </div>
  )
}
