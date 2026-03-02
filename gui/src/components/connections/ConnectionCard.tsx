import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  Check,
  Loader2,
  Pencil,
  Plug,
  Shield,
  TestTube,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@src/lib/utils'
import { Badge } from '@src/components/ui/badge'
import { Button } from '@src/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@src/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@src/components/ui/dialog'
import { Tooltip as CustomTooltip } from '@src/components/ui/tooltip/'
import { ConnectionForm } from './ConnectionForm'
import { useActiveConnection } from '@src/contexts/ActiveConnectionContext'
import type { Connection, ConnectionUpdate, TestConnectionResult } from '@src/types/connection'

type TestStatus = 'idle' | 'testing' | 'passed' | 'failed'

interface ConnectionCardProps {
  connection: Connection
  onUpdate: (id: string, data: ConnectionUpdate) => Promise<Connection>
  onDelete: (id: string) => Promise<void>
  onTest: (id: string) => Promise<TestConnectionResult>
}

export function ConnectionCard(props: ConnectionCardProps) {
  const { connection, onUpdate, onDelete, onTest } = props

  const navigate = useNavigate()
  const { activeConnection, setActiveConnection } = useActiveConnection()

  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testLatency, setTestLatency] = useState<number | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isActive = activeConnection?.id === connection.id

  const handleTest = async () => {
    setTestStatus('testing')
    setTestLatency(null)
    try {
      const result = await onTest(connection.id)
      if (result.ok) {
        setTestStatus('passed')
        setTestLatency(result.latency_ms ?? null)
        toast.success(
          result.latency_ms != null
            ? `Connection test passed (${Math.round(result.latency_ms)}ms)`
            : 'Connection test passed',
        )
      } else {
        setTestStatus('failed')
        toast.error(`Connection test failed: ${result.error ?? 'Unknown error'}`)
      }
    } catch (err: any) {
      setTestStatus('failed')
      toast.error(`Connection test failed: ${err?.message ?? 'Unknown error'}`)
    }
  }

  const handleConnect = () => {
    setActiveConnection(connection)
    navigate(`/browse/${connection.id}`)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete(connection.id)
      if (isActive) setActiveConnection(null)
      toast.success('Connection deleted')
      setIsDeleteOpen(false)
    } catch (err: any) {
      toast.error(`Failed to delete: ${err?.message ?? 'Unknown error'}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const formattedDate = new Date(connection.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <>
      <Card
        className={cn(
          'flex min-w-0 flex-col gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md',
          isActive && 'ring-2 ring-primary',
        )}
      >
        <CardHeader className="border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {/* Status dot + name */}
              <div className="flex items-center gap-2">
                <StatusDot status={testStatus} />
                <CardTitle className="truncate text-sm">{connection.name}</CardTitle>
              </div>
              {/* Masked URI with tooltip showing full connection string */}
              <CustomTooltip
                content={
                  <span className="break-all text-xs">{connection.uri_masked}</span>
                }
                position="bottom"
                maxWidth="400px"
                delay={200}
                triggerClassName="min-w-0 w-full"
              >
                <p className="truncate text-xs text-muted-foreground">
                  {connection.uri_masked}
                </p>
              </CustomTooltip>
            </div>

            {/* Badges */}
            <div className="flex shrink-0 flex-col items-end gap-1">
              {connection.tls && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Shield className="size-3" />
                  TLS
                </Badge>
              )}
              {isActive && (
                <Badge variant="default" className="text-xs">
                  Active
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 py-2">
          <p className="text-xs text-muted-foreground">Added {formattedDate}</p>
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
          {/* Test result display */}
          <TestResultDisplay status={testStatus} latency={testLatency} />

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <CustomTooltip content="Test connection" position="top">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleTest}
                disabled={testStatus === 'testing'}
                aria-label="Test connection"
              >
                {testStatus === 'testing' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <TestTube className="size-3.5" />
                )}
              </Button>
            </CustomTooltip>

            <CustomTooltip content="Edit" position="top">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setIsEditOpen(true)}
                aria-label="Edit connection"
              >
                <Pencil className="size-3.5" />
              </Button>
            </CustomTooltip>

            <CustomTooltip content="Delete" position="top">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setIsDeleteOpen(true)}
                aria-label="Delete connection"
                className="hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </CustomTooltip>

            <Button
              size="sm"
              variant={isActive ? 'secondary' : 'default'}
              onClick={handleConnect}
              className="gap-1.5"
            >
              <Plug className="size-3.5" />
              {isActive ? 'Connected' : 'Connect'}
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Edit dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <ConnectionForm
          mode="edit"
          defaultValues={connection}
          onSubmit={(data) => onUpdate(connection.id, data)}
          onClose={() => setIsEditOpen(false)}
        />
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Connection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">{connection.name}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatusDotProps {
  status: TestStatus
}

function StatusDot(props: StatusDotProps) {
  const { status } = props

  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        status === 'idle' && 'bg-muted-foreground/40',
        status === 'testing' && 'animate-pulse bg-yellow-400',
        status === 'passed' && 'bg-emerald-500',
        status === 'failed' && 'bg-destructive',
      )}
      aria-label={`Connection status: ${status}`}
    />
  )
}

interface TestResultDisplayProps {
  status: TestStatus
  latency: number | null
}

function TestResultDisplay(props: TestResultDisplayProps) {
  const { status, latency } = props

  if (status === 'idle') return <span className="text-xs text-muted-foreground/60">Not tested</span>

  if (status === 'testing') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Testing…
      </span>
    )
  }

  if (status === 'passed') {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Check className="size-3" />
        {latency != null ? `${Math.round(latency)}ms` : 'OK'}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <X className="size-3" />
      Failed
    </span>
  )
}
