import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@src/components/ui/button'
import { Dialog } from '@src/components/ui/dialog'
import { ConnectionForm } from '@src/components/connections/ConnectionForm'
import { ConnectionList } from '@src/components/connections/ConnectionList'
import { useConnections } from '@src/hooks/useConnections'

export default function ConnectionsPage() {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const { connections, isLoading, testResults, createConnection, updateConnection, deleteConnection, testConnection } =
    useConnections()

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Connections</h2>
          <p className="text-sm text-muted-foreground">
            Manage your MongoDB connections
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
          <Plus className="size-4" />
          Add Connection
        </Button>
      </div>

      {/* Connection list */}
      <ConnectionList
        connections={connections}
        isLoading={isLoading}
        testResults={testResults}
        onAddClick={() => setIsAddOpen(true)}
        onUpdate={updateConnection}
        onDelete={deleteConnection}
        onTest={testConnection}
      />

      {/* Add connection dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <ConnectionForm
          mode="create"
          onSubmit={createConnection}
          onClose={() => setIsAddOpen(false)}
        />
      </Dialog>
    </div>
  )
}
