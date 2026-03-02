import { Button } from '@src/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@src/components/ui/select'
import type { FileListResponse } from '@src/types/file'

interface PaginationProps {
  fileListResponse: FileListResponse
  selectedCount?: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function Pagination(props: PaginationProps) {
  const { fileListResponse, selectedCount = 0, onPageChange, onPageSizeChange } = props

  const currentPage = fileListResponse.page
  const totalPages = fileListResponse.total_pages
  const totalFiles = fileListResponse.total
  const currentLimit = fileListResponse.limit

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="text-sm text-muted-foreground">
        {totalFiles} {totalFiles === 1 ? 'file' : 'files'} total
        {selectedCount > 0 && (
          <span className="text-foreground"> · {selectedCount} selected</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Per page:</span>
          <Select
            value={String(currentLimit)}
            onValueChange={(val) => onPageSizeChange(Number(val))}
          >
            <SelectTrigger size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
