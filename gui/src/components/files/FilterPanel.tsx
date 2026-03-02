import { Button } from '@src/components/ui/button'
import { Input } from '@src/components/ui/input'
import { Label } from '@src/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@src/components/ui/select'
import type { FileFilters } from '@src/hooks/useFiles'

type SizeUnit = 'KB' | 'MB' | 'GB'

const SIZE_MULTIPLIERS: Record<SizeUnit, number> = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
}

const COMMON_CONTENT_TYPES = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'text/',
  'application/json',
  'application/zip',
]

function toDisplayValue(bytes: number | undefined, unit: SizeUnit): string {
  if (bytes == null) return ''
  return String(bytes / SIZE_MULTIPLIERS[unit])
}

function fromDisplayValue(display: string, unit: SizeUnit): number | undefined {
  const n = parseFloat(display)
  if (isNaN(n) || display === '') return undefined
  return Math.round(n * SIZE_MULTIPLIERS[unit])
}

function detectUnit(bytes: number | undefined): SizeUnit {
  if (!bytes) return 'MB'
  if (bytes >= SIZE_MULTIPLIERS.GB) return 'GB'
  if (bytes >= SIZE_MULTIPLIERS.MB) return 'MB'
  return 'KB'
}

interface FilterPanelProps {
  filters: FileFilters
  onChange: (filters: FileFilters) => void
}

export function FilterPanel(props: FilterPanelProps) {
  const { filters, onChange } = props

  const handleField = <K extends keyof FileFilters>(key: K, value: FileFilters[K]) => {
    onChange({ ...filters, [key]: value })
  }

  const handleClearAll = () => {
    onChange({})
  }

  const minUnit = detectUnit(filters.min_size)
  const maxUnit = detectUnit(filters.max_size)

  const handleMinSize = (displayVal: string, unit: SizeUnit) => {
    onChange({ ...filters, min_size: fromDisplayValue(displayVal, unit) })
  }

  const handleMaxSize = (displayVal: string, unit: SizeUnit) => {
    onChange({ ...filters, max_size: fromDisplayValue(displayVal, unit) })
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Content Type */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Content Type</Label>
          <div>
            <Input
              list="content-type-suggestions"
              placeholder="e.g. image/"
              value={filters.content_type ?? ''}
              onChange={(e) => handleField('content_type', e.target.value || undefined)}
              className="h-8 text-sm"
            />
            <datalist id="content-type-suggestions">
              {COMMON_CONTENT_TYPES.map((ct) => (
                <option key={ct} value={ct} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Date range */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Uploaded After</Label>
          <Input
            type="date"
            value={filters.uploaded_after ?? ''}
            onChange={(e) => handleField('uploaded_after', e.target.value || undefined)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Uploaded Before</Label>
          <Input
            type="date"
            value={filters.uploaded_before ?? ''}
            onChange={(e) => handleField('uploaded_before', e.target.value || undefined)}
            className="h-8 text-sm"
          />
        </div>

        {/* Metadata filter */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Metadata</Label>
          <div className="flex gap-1.5">
            <Input
              placeholder="Key"
              value={filters.metadata_key ?? ''}
              onChange={(e) => handleField('metadata_key', e.target.value || undefined)}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Value"
              value={filters.metadata_value ?? ''}
              onChange={(e) => handleField('metadata_value', e.target.value || undefined)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* Min size */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Min Size</Label>
          <div className="flex gap-1.5">
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={toDisplayValue(filters.min_size, minUnit)}
              onChange={(e) => handleMinSize(e.target.value, minUnit)}
              className="h-8 text-sm"
            />
            <Select
              value={minUnit}
              onValueChange={(unit) =>
                handleMinSize(toDisplayValue(filters.min_size, unit as SizeUnit), unit as SizeUnit)
              }
            >
              <SelectTrigger size="sm" className="w-18 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KB">KB</SelectItem>
                <SelectItem value="MB">MB</SelectItem>
                <SelectItem value="GB">GB</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Max size */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Max Size</Label>
          <div className="flex gap-1.5">
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={toDisplayValue(filters.max_size, maxUnit)}
              onChange={(e) => handleMaxSize(e.target.value, maxUnit)}
              className="h-8 text-sm"
            />
            <Select
              value={maxUnit}
              onValueChange={(unit) =>
                handleMaxSize(toDisplayValue(filters.max_size, unit as SizeUnit), unit as SizeUnit)
              }
            >
              <SelectTrigger size="sm" className="w-18 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KB">KB</SelectItem>
                <SelectItem value="MB">MB</SelectItem>
                <SelectItem value="GB">GB</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Clear all */}
        <div className="flex items-end sm:col-span-2 lg:col-span-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="h-8"
          >
            Clear all filters
          </Button>
        </div>
      </div>
    </div>
  )
}
