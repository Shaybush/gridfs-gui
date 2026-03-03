import { useMemo, useState } from 'react';
import { FolderOpen, FolderX } from 'lucide-react';
import { formatFileSize } from '@src/common/utils/format-file-size';
import { BucketContextMenu } from '@src/components/folders/BucketContextMenu';
import { EmptyAreaContextMenu } from '@src/components/folders/EmptyAreaContextMenu';
import { FolderCard } from '@src/components/folders/FolderCard';
import { FolderEmptyArea } from '@src/components/folders/FolderEmptyArea';
import { SkeletonFolderCard } from '@src/components/folders/SkeletonFolderCard';
import { StatusMessage } from '@src/components/folders/StatusMessage';
import { useBuckets } from '@src/hooks/useBuckets';
import type { SortDirection, SortField } from '@src/hooks/useSortPreference';
import type { BucketInfo } from '@src/types/bucket';

const GRID_CLASSES = 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
const SKELETON_COUNT = 8;

interface BucketGridProps {
  connId: string;
  dbName: string;
  onSelectBucket: (bucketName: string) => void;
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSortFieldChange?: (field: SortField) => void;
  onUploadToBucket?: (bucketName: string) => void;
}

function sortBuckets(
  buckets: BucketInfo[],
  sortField: SortField | undefined,
  sortDirection: SortDirection | undefined,
): BucketInfo[] {
  if (!sortField) return buckets;

  const direction = sortDirection === 'desc' ? -1 : 1;

  return [...buckets].sort((a, b) => {
    switch (sortField) {
      case 'name':
        return direction * a.name.localeCompare(b.name);
      case 'file_count':
        return direction * (a.file_count - b.file_count);
      case 'total_size':
        return direction * (a.total_size - b.total_size);
      default:
        return 0;
    }
  });
}

function formatFileCount(count: number): string {
  return `${count} ${count === 1 ? 'file' : 'files'}`;
}

export function BucketGrid(props: BucketGridProps) {
  const { connId, dbName, onSelectBucket, sortField, sortDirection, onSortFieldChange, onUploadToBucket } = props;
  const {
    buckets,
    isLoading,
    error,
    fetchBuckets,
    createBucket,
    deleteBucket,
    renameBucket,
    exportBucket,
    getBucketStats,
  } = useBuckets(connId, dbName);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);

  const sortedBuckets = useMemo(
    () => sortBuckets(buckets, sortField, sortDirection),
    [buckets, sortField, sortDirection],
  );

  function handleDoubleClick(bucketName: string) {
    setSelectedBucket(bucketName);
    onSelectBucket(bucketName);
  }

  const emptyAreaProps = {
    onCreateBucket: createBucket,
    onRefresh: fetchBuckets,
    sortField: sortField ?? ('name' as SortField),
    onSortFieldChange: onSortFieldChange ?? (() => {}),
  };

  if (error) {
    return (
      <EmptyAreaContextMenu {...emptyAreaProps}>
        <FolderEmptyArea>
          <StatusMessage icon={FolderX} title='Failed to load buckets' description={error} variant='error' />
        </FolderEmptyArea>
      </EmptyAreaContextMenu>
    );
  }

  if (isLoading) {
    return (
      <EmptyAreaContextMenu {...emptyAreaProps}>
        <FolderEmptyArea>
          <div className={GRID_CLASSES}>
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <SkeletonFolderCard key={i} showSecondaryLine />
            ))}
          </div>
        </FolderEmptyArea>
      </EmptyAreaContextMenu>
    );
  }

  if (sortedBuckets.length === 0) {
    return (
      <EmptyAreaContextMenu {...emptyAreaProps}>
        <FolderEmptyArea>
          <StatusMessage
            icon={FolderOpen}
            title='No buckets found'
            description='This database has no GridFS buckets yet'
          />
        </FolderEmptyArea>
      </EmptyAreaContextMenu>
    );
  }

  return (
    <EmptyAreaContextMenu {...emptyAreaProps}>
      <FolderEmptyArea>
        <div className={GRID_CLASSES}>
          {sortedBuckets.map((bucket) => (
            <BucketContextMenu
              key={bucket.name}
              bucketName={bucket.name}
              onOpen={() => handleDoubleClick(bucket.name)}
              onRename={async (newName) => {
                await renameBucket(bucket.name, newName);
              }}
              onUpload={() => onUploadToBucket?.(bucket.name)}
              onExport={() => exportBucket(bucket.name)}
              onDelete={() => deleteBucket(bucket.name)}
              getBucketStats={getBucketStats}
            >
              <FolderCard
                name={bucket.name}
                subtitle={formatFileCount(bucket.file_count)}
                secondarySubtitle={formatFileSize(bucket.total_size)}
                icon={FolderOpen}
                selected={selectedBucket === bucket.name}
                onClick={() => setSelectedBucket(bucket.name)}
                onDoubleClick={() => handleDoubleClick(bucket.name)}
              />
            </BucketContextMenu>
          ))}
        </div>
      </FolderEmptyArea>
    </EmptyAreaContextMenu>
  );
}
