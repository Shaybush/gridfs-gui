import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  ChevronRight,
  Database,
  FolderOpen,
  LayoutGrid,
  LayoutList,
  ListFilter,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useActiveConnection } from '@src/contexts/ActiveConnectionContext'
import { useDatabases } from '@src/hooks/useDatabases'
import { useBuckets } from '@src/hooks/useBuckets'
import { useFiles } from '@src/hooks/useFiles'
import type { FileFilters } from '@src/hooks/useFiles'
import { Button } from '@src/components/ui/button'
import { Badge } from '@src/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@src/components/ui/select'
import { Separator } from '@src/components/ui/separator'
import { BucketSidebar } from '@src/components/buckets/BucketSidebar'
import { FileTable } from '@src/components/files/FileTable'
import { FileGrid } from '@src/components/files/FileGrid'
import { FileDetail } from '@src/components/files/FileDetail'
import { FilterPanel } from '@src/components/files/FilterPanel'
import { SearchBar } from '@src/components/files/SearchBar'
import { UploadZone } from '@src/components/files/UploadZone'
import type { FileInfo } from '@src/types/file'

type SortField = 'uploadDate' | 'filename' | 'length'
type SortOrder = 'asc' | 'desc'
type ViewMode = 'table' | 'grid'

function countActiveFilters(filters: FileFilters): number {
  return Object.values(filters).filter(
    (v) => v !== undefined && v !== null && v !== '',
  ).length
}

export default function BrowsePage() {
  const { connId } = useParams<{ connId: string }>()
  const navigate = useNavigate()
  const { activeConnection } = useActiveConnection()

  const [selectedDb, setSelectedDb] = useState<string | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
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
  const [sortField, setSortField] = useState<SortField>('uploadDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Stable ref so fetchFiles doesn't cause infinite loops
  const fetchFilesRef = useRef<
    ((
      page?: number,
      limit?: number,
      sort?: SortField,
      order?: SortOrder,
      filters?: FileFilters,
    ) => Promise<void>) | null
  >(null)

  const filtersRef = useRef<FileFilters>(filters)
  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  const resolvedConnId = connId ?? activeConnection?.id

  const { databases, isLoading: isLoadingDbs } = useDatabases(resolvedConnId)
  const { buckets } = useBuckets(resolvedConnId, selectedDb ?? undefined)

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
  } = useFiles(resolvedConnId, selectedDb ?? undefined, selectedBucket ?? undefined)

  // Keep ref updated
  useEffect(() => {
    fetchFilesRef.current = fetchFiles
  }, [fetchFiles])

  // When bucket selection changes, reset page
  useEffect(() => {
    if (!selectedBucket) return
    setPage(1)
  }, [selectedBucket, selectedDb])

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

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters])

  const handleDatabaseChange = (db: string) => {
    setSelectedDb(db)
    setSelectedBucket(null)
  }

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortOrder('desc')
      return field
    })
    setPage(1)
  }, [])

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
      // Keep the detail panel in sync if the renamed file is currently selected
      setSelectedFile((prev) => (prev?.id === fileId ? { ...prev, filename: updated.filename } : prev))
      return updated
    },
    [renameFile, page, limit, sortField, sortOrder],
  )

  const handleUpdateMetadata = useCallback(
    async (fileId: string, metadata: Record<string, any>) => {
      const updated = await updateMetadata(fileId, metadata)
      await fetchFilesRef.current?.(page, limit, sortField, sortOrder, filtersRef.current)
      // Keep the detail panel in sync if the updated file is currently selected
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
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="size-4 shrink-0" />
          <span className="font-medium text-foreground truncate max-w-[120px]">
            {activeConnection?.name ?? connId}
          </span>
          {selectedDb && (
            <>
              <ChevronRight className="size-3.5 shrink-0" />
              <span className="truncate max-w-[100px]">{selectedDb}</span>
            </>
          )}
          {selectedBucket && (
            <>
              <ChevronRight className="size-3.5 shrink-0" />
              <FolderOpen className="size-3.5 shrink-0" />
              <span className="font-medium text-foreground truncate max-w-[100px]">
                {selectedBucket}
              </span>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Database selector */}
          <Select
            value={selectedDb ?? ''}
            onValueChange={handleDatabaseChange}
            disabled={isLoadingDbs || databases.length === 0}
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue placeholder={isLoadingDbs ? 'Loading...' : 'Select database'} />
            </SelectTrigger>
            <SelectContent>
              {databases.map((db) => (
                <SelectItem key={db} value={db}>
                  {db}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Upload button */}
          {selectedBucket && (
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
          )}
        </div>
      </div>

      {/* Upload zone */}
      {showUpload && selectedBucket && (
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

      {/* Main content area */}
      {!selectedDb ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Database className="size-8 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">Select a Database</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Choose a database from the dropdown above to view its GridFS buckets.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Bucket sidebar */}
          <div className="w-full shrink-0 lg:w-56">
            <div className="rounded-lg border bg-card p-3">
              <BucketSidebar
                connId={resolvedConnId}
                dbName={selectedDb}
                selectedBucket={selectedBucket}
                onSelectBucket={setSelectedBucket}
              />
            </div>
          </div>

          <Separator orientation="vertical" className="hidden lg:block h-auto self-stretch" />

          {/* File area */}
          <div className="min-w-0 flex-1">
            {!selectedBucket ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                  <FolderOpen className="size-7 text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-semibold text-foreground">Select a Bucket</h3>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Click on a bucket in the sidebar to browse its files.
                  </p>
                </div>
              </div>
            ) : (
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
                      className={`h-8 w-8 rounded-r-none ${viewMode === 'table' ? 'bg-muted' : ''}`}
                      onClick={() => setViewMode('table')}
                      aria-label="Table view"
                      title="Table view"
                    >
                      <LayoutList className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={`h-8 w-8 rounded-l-none border-l ${viewMode === 'grid' ? 'bg-muted' : ''}`}
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
                    currentBucket={selectedBucket ?? ''}
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
          </div>
        </div>
      )}

      {/* File detail sheet */}
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
    </div>
  )
}
