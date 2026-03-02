import { Plus } from 'lucide-react'
import { Button } from '@src/components/ui/button'
import { ConnectionCard } from './ConnectionCard'
import type { Connection, ConnectionUpdate, TestConnectionResult } from '@src/types/connection'

interface ConnectionListProps {
  connections: Connection[]
  isLoading: boolean
  onAddClick: () => void
  onUpdate: (id: string, data: ConnectionUpdate) => Promise<Connection>
  onDelete: (id: string) => Promise<void>
  onTest: (id: string) => Promise<TestConnectionResult>
}

export function ConnectionList(props: ConnectionListProps) {
  const { connections, isLoading, onAddClick, onUpdate, onDelete, onTest } = props

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 py-20 text-center">
        <div className="flex flex-col items-center gap-2">
          <p className="text-base font-semibold text-foreground">No connections yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Add your first MongoDB connection to start browsing GridFS files.
          </p>
        </div>
        <Button onClick={onAddClick} className="gap-2">
          <Plus className="size-4" />
          Add your first MongoDB connection
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {connections.map((conn) => (
        <ConnectionCard
          key={conn.id}
          connection={conn}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onTest={onTest}
        />
      ))}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-0 rounded-xl border border-border bg-card shadow-sm">
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-3 w-48 rounded bg-muted animate-pulse" />
        </div>
      </div>
      {/* Content skeleton */}
      <div className="px-4 py-2">
        <div className="h-3 w-24 rounded bg-muted animate-pulse" />
      </div>
      {/* Footer skeleton */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <div className="h-3 w-16 rounded bg-muted animate-pulse" />
        <div className="flex gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="size-8 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
