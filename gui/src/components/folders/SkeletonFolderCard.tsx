interface SkeletonFolderCardProps {
  showSecondaryLine?: boolean;
}

export function SkeletonFolderCard({ showSecondaryLine = false }: SkeletonFolderCardProps) {
  return (
    <div className='flex flex-col items-center gap-2 rounded-xl border bg-card p-4 shadow-sm animate-pulse'>
      <div className='size-16 rounded-lg bg-muted' />
      <div className='w-full space-y-1.5'>
        <div className='mx-auto h-3 w-3/4 rounded bg-muted' />
        <div className='mx-auto h-3 w-1/2 rounded bg-muted' />
        {showSecondaryLine && <div className='mx-auto h-3 w-1/3 rounded bg-muted' />}
      </div>
    </div>
  );
}
