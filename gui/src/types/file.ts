export interface FileInfo {
  id: string
  filename: string
  length: number
  content_type: string | null
  upload_date: string
  metadata: Record<string, any> | null
  chunk_size: number
}

export interface FileListResponse {
  files: FileInfo[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface FileUploadResponse {
  id: string
  filename: string
  length: number
  content_type: string | null
  upload_date: string
}

export interface FileCopyMoveResponse {
  id: string
  filename: string
  target_bucket: string
  length: number
}
