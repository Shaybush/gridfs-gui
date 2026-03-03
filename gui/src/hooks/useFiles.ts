import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_GATEWAY_URL } from '@src/common/constants'
import { httpClient } from '@src/lib/HttpClient/HttpClient'
import type { FileCopyMoveResponse, FileInfo, FileListResponse, FileUploadResponse } from '@src/types/file'

type SortField = 'uploadDate' | 'filename' | 'length'
type SortOrder = 'asc' | 'desc'

export interface FileFilters {
  search?: string
  content_type?: string
  uploaded_after?: string
  uploaded_before?: string
  min_size?: number
  max_size?: number
  metadata_key?: string
  metadata_value?: string
}

interface UseFilesReturn {
  files: FileInfo[]
  fileListResponse: FileListResponse | null
  isLoading: boolean
  error: string | null
  uploadProgress: number
  fetchFiles: (page?: number, limit?: number, sort?: SortField, order?: SortOrder, filters?: FileFilters) => Promise<void>
  uploadFiles: (files: File[], metadata?: Record<string, any>) => Promise<FileUploadResponse[]>
  deleteFile: (fileId: string) => Promise<void>
  getDownloadUrl: (fileId: string) => string
  getPreviewUrl: (fileId: string) => string
  getFileInfo: (fileId: string) => Promise<FileInfo>
  bulkDelete: (fileIds: string[]) => Promise<{ deleted: number; errors: string[] }>
  bulkDownload: (fileIds: string[]) => Promise<void>
  copyFile: (fileId: string, targetBucket: string) => Promise<FileCopyMoveResponse>
  moveFile: (fileId: string, targetBucket: string) => Promise<FileCopyMoveResponse>
  renameFile: (fileId: string, newFilename: string) => Promise<FileInfo>
  updateMetadata: (fileId: string, metadata: Record<string, any>) => Promise<FileInfo>
}

export function useFiles(
  connId: string | undefined,
  dbName: string | undefined,
  bucketName: string | undefined,
): UseFilesReturn {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [fileListResponse, setFileListResponse] = useState<FileListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const basePath = useMemo(() => {
    if (!connId || !dbName || !bucketName) return null
    return `/api/v1/connections/${connId}/databases/${encodeURIComponent(dbName)}/buckets/${encodeURIComponent(bucketName)}/files`
  }, [connId, dbName, bucketName])

  const fetchFiles = useCallback(
    async (
      page = 1,
      limit = 25,
      sort: SortField = 'uploadDate',
      order: SortOrder = 'desc',
      filters: FileFilters = {},
    ): Promise<void> => {
      if (!basePath) {
        setFiles([])
        setFileListResponse(null)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          sort,
          order,
        })

        // Append string filters (truthy check is sufficient)
        for (const key of ['search', 'content_type', 'uploaded_after', 'uploaded_before', 'metadata_key', 'metadata_value'] as const) {
          if (filters[key]) params.set(key, filters[key])
        }

        // Append numeric filters (explicit undefined check since 0 is valid)
        if (filters.min_size != null) params.set('min_size', String(filters.min_size))
        if (filters.max_size != null) params.set('max_size', String(filters.max_size))

        const { promise } = httpClient.get<FileListResponse>(`${basePath}?${params.toString()}`)
        const data = await promise
        setFiles(data.files)
        setFileListResponse(data)
      } catch (err: any) {
        setError(err?.message ?? 'Failed to fetch files')
        setFiles([])
        setFileListResponse(null)
      } finally {
        setIsLoading(false)
      }
    },
    [basePath],
  )

  const uploadFiles = useCallback(
    (files: File[], metadata?: Record<string, any>): Promise<FileUploadResponse[]> => {
      return new Promise((resolve, reject) => {
        if (!basePath) {
          reject(new Error('No connection, database, or bucket selected'))
          return
        }

        const url = `${API_GATEWAY_URL}${basePath}/upload`
        const formData = new FormData()

        for (const file of files) {
          formData.append('files', file)
        }

        if (metadata) {
          formData.append('metadata', JSON.stringify(metadata))
        }

        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100)
            setUploadProgress(percent)
          }
        })

        xhr.addEventListener('load', () => {
          setUploadProgress(0)
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)
              resolve(Array.isArray(response) ? response : [response])
            } catch {
              resolve([])
            }
          } else {
            try {
              const errBody = JSON.parse(xhr.responseText)
              reject(new Error(errBody?.message ?? `Upload failed with status ${xhr.status}`))
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`))
            }
          }
        })

        xhr.addEventListener('error', () => {
          setUploadProgress(0)
          reject(new Error('Network error during upload'))
        })

        xhr.addEventListener('abort', () => {
          setUploadProgress(0)
          reject(new Error('Upload was aborted'))
        })

        xhr.open('POST', url)
        xhr.withCredentials = true
        xhr.send(formData)
      })
    },
    [basePath],
  )

  const deleteFile = useCallback(
    async (fileId: string): Promise<void> => {
      if (!basePath) return

      const { promise } = httpClient.delete(`${basePath}/${fileId}`)
      await promise
    },
    [basePath],
  )

  const getDownloadUrl = useCallback(
    (fileId: string): string => {
      if (!basePath) return ''
      return `${API_GATEWAY_URL}${basePath}/${fileId}/download`
    },
    [basePath],
  )

  const getPreviewUrl = useCallback(
    (fileId: string): string => {
      if (!basePath) return ''
      return `${API_GATEWAY_URL}${basePath}/${fileId}/preview`
    },
    [basePath],
  )

  const getFileInfo = useCallback(
    async (fileId: string): Promise<FileInfo> => {
      if (!basePath) throw new Error('No connection, database, or bucket selected')
      const { promise } = httpClient.get<FileInfo>(`${basePath}/${fileId}`)
      return promise
    },
    [basePath],
  )

  const bulkDelete = useCallback(
    async (fileIds: string[]): Promise<{ deleted: number; errors: string[] }> => {
      if (!basePath) throw new Error('No connection, database, or bucket selected')
      const { promise } = httpClient.post<{ deleted: number; errors: string[] }>(
        `${basePath}/bulk-delete`,
        { body: { file_ids: fileIds } },
      )
      return promise
    },
    [basePath],
  )

  const bulkDownload = useCallback(
    async (fileIds: string[]): Promise<void> => {
      if (!basePath) throw new Error('No connection, database, or bucket selected')
      const response = await fetch(`${API_GATEWAY_URL}${basePath}/bulk-download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ file_ids: fileIds }),
      })
      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || `Bulk download failed with status ${response.status}`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'files.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    [basePath],
  )

  const renameFile = useCallback(
    async (fileId: string, newFilename: string): Promise<FileInfo> => {
      if (!basePath) throw new Error('No connection, database, or bucket selected')
      const { promise } = httpClient.patch<FileInfo>(`${basePath}/${fileId}`, {
        body: { filename: newFilename },
      })
      return promise
    },
    [basePath],
  )

  const updateMetadata = useCallback(
    async (fileId: string, metadata: Record<string, any>): Promise<FileInfo> => {
      if (!basePath) throw new Error('No connection, database, or bucket selected')
      const { promise } = httpClient.patch<FileInfo>(`${basePath}/${fileId}`, {
        body: { metadata },
      })
      return promise
    },
    [basePath],
  )

  const copyOrMove = useCallback(
    async (fileId: string, targetBucket: string, action: 'copy' | 'move'): Promise<FileCopyMoveResponse> => {
      if (!basePath) throw new Error('No connection, database, or bucket selected')
      const { promise } = httpClient.post<FileCopyMoveResponse>(`${basePath}/${fileId}/${action}`, {
        body: { target_bucket: targetBucket },
      })
      return promise
    },
    [basePath],
  )

  const copyFile = useCallback(
    (fileId: string, targetBucket: string) => copyOrMove(fileId, targetBucket, 'copy'),
    [copyOrMove],
  )

  const moveFile = useCallback(
    (fileId: string, targetBucket: string) => copyOrMove(fileId, targetBucket, 'move'),
    [copyOrMove],
  )

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  return {
    files,
    fileListResponse,
    isLoading,
    error,
    uploadProgress,
    fetchFiles,
    uploadFiles,
    deleteFile,
    getDownloadUrl,
    getPreviewUrl,
    getFileInfo,
    bulkDelete,
    bulkDownload,
    copyFile,
    moveFile,
    renameFile,
    updateMetadata,
  }
}
