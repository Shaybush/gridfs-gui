import { useState } from 'react';
import { Database, DatabaseZap } from 'lucide-react';
import { DatabaseContextMenu } from '@src/components/folders/DatabaseContextMenu';
import { FolderCard } from '@src/components/folders/FolderCard';
import { FolderEmptyArea } from '@src/components/folders/FolderEmptyArea';
import { SkeletonFolderCard } from '@src/components/folders/SkeletonFolderCard';
import { StatusMessage } from '@src/components/folders/StatusMessage';
import { useDatabases } from '@src/hooks/useDatabases';

const GRID_CLASSES = 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
const SKELETON_COUNT = 8;

interface DatabaseGridProps {
  connId: string;
  onSelectDatabase: (dbName: string) => void;
}

export function DatabaseGrid(props: DatabaseGridProps) {
  const { connId, onSelectDatabase } = props;
  const { databases, isLoading, error, fetchDatabases } = useDatabases(connId);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);

  function handleDoubleClick(dbName: string) {
    setSelectedDb(dbName);
    onSelectDatabase(dbName);
  }

  if (error) {
    return <StatusMessage icon={DatabaseZap} title='Failed to load databases' description={error} variant='error' />;
  }

  if (isLoading) {
    return (
      <div className={GRID_CLASSES}>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <SkeletonFolderCard key={i} />
        ))}
      </div>
    );
  }

  if (databases.length === 0) {
    return (
      <StatusMessage
        icon={Database}
        title='No databases found'
        description='This connection has no accessible databases'
      />
    );
  }

  return (
    <FolderEmptyArea>
      <div className={GRID_CLASSES}>
        {databases.map((dbName) => (
          <DatabaseContextMenu key={dbName} onOpen={() => handleDoubleClick(dbName)} onRefresh={fetchDatabases}>
            <FolderCard
              name={dbName}
              icon={Database}
              selected={selectedDb === dbName}
              onClick={() => setSelectedDb(dbName)}
              onDoubleClick={() => handleDoubleClick(dbName)}
            />
          </DatabaseContextMenu>
        ))}
      </div>
    </FolderEmptyArea>
  );
}
