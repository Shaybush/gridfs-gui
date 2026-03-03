import { useCallback, useRef, useState } from 'react'
import { CloudUpload, FileUp, X } from 'lucide-react'
import { formatFileSize } from '@src/common/utils/format-file-size'
import { Button } from '@src/components/ui/button'
import { Label } from '@src/components/ui/label'
import { Progress } from '@src/components/ui/progress'
import { cn } from '@src/lib/utils'

interface UploadZoneProps {
  uploadProgress: number
  isUploading: boolean
  onUpload: (files: File[], metadata?: Record<string, any>) => Promise<void>
  onClose?: () => void
}

export function UploadZone(props: UploadZoneProps) {
  const { uploadProgress, isUploading, onUpload, onClose } = props

  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [metadataText, setMetadataText] = useState('')
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...droppedFiles])
    }
  }, [])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? [])
    if (chosen.length > 0) {
      setSelectedFiles((prev) => [...prev, ...chosen])
    }
    // reset so user can pick same file again if needed
    e.target.value = ''
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const parseMetadata = (): { valid: boolean; value: Record<string, any> | undefined } => {
    if (!metadataText.trim()) return { valid: true, value: undefined }
    try {
      const parsed = JSON.parse(metadataText)
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Metadata must be a JSON object')
      }
      setMetadataError(null)
      return { valid: true, value: parsed as Record<string, any> }
    } catch (err: any) {
      setMetadataError(err?.message ?? 'Invalid JSON')
      return { valid: false, value: undefined }
    }
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    const { valid, value: metadata } = parseMetadata()
    if (!valid) return

    await onUpload(selectedFiles, metadata)
    setSelectedFiles([])
    setMetadataText('')
    setMetadataError(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
          isDragOver
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/50',
          isUploading && 'pointer-events-none opacity-60',
        )}
      >
        {isDragOver ? (
          <CloudUpload className="size-10 text-primary" />
        ) : (
          <FileUp className="size-10 opacity-50" />
        )}
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {isDragOver ? 'Drop files here' : 'Drag and drop files here'}
          </p>
          <p className="text-xs">or click to browse</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={handleFileInputChange}
          disabled={isUploading}
          aria-label="File upload input"
        />
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected
          </p>
          <div className="max-h-32 overflow-y-auto rounded-md border bg-background">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm border-b last:border-b-0"
              >
                <span className="truncate text-foreground">{file.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveFile(index)
                    }}
                    disabled={isUploading}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional metadata */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="upload-metadata" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Metadata (optional JSON)
        </Label>
        <textarea
          id="upload-metadata"
          value={metadataText}
          onChange={(e) => {
            setMetadataText(e.target.value)
            setMetadataError(null)
          }}
          disabled={isUploading}
          rows={3}
          placeholder='{"key": "value"}'
          className={cn(
            'w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono shadow-xs outline-none transition-[color,box-shadow] resize-none placeholder:text-muted-foreground disabled:opacity-50',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            metadataError ? 'border-destructive' : 'border-input',
          )}
        />
        {metadataError && (
          <p className="text-xs text-destructive">{metadataError}</p>
        )}
      </div>

      {/* Upload progress */}
      {isUploading && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || isUploading}
        >
          {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
        </Button>
      </div>
    </div>
  )
}
