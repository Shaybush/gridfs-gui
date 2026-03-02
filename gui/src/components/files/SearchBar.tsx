import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@src/components/ui/input'

interface SearchBarProps {
  onSearch: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchBar(props: SearchBarProps) {
  const { onSearch, placeholder = 'Search files...', className } = props

  const [value, setValue] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSearch(value)
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, onSearch])

  const handleClear = () => {
    setValue('')
  }

  return (
    <div className={`relative flex items-center ${className ?? ''}`}>
      <Search className="absolute left-2.5 size-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-8 pl-8 pr-8 text-sm"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear search"
          type="button"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
