import { useCallback, useMemo } from 'react';
import { useQueryParams } from '@src/hooks/useQueryParams';

export type BrowseLevel = 'databases' | 'buckets' | 'files';

export interface Breadcrumb {
  label: string;
  level: BrowseLevel;
  value: string | null;
}

interface UseBrowseNavigationReturn {
  currentLevel: BrowseLevel;
  selectedDatabase: string | null;
  selectedBucket: string | null;
  navigateTo: (level: BrowseLevel, value?: string) => void;
  goBack: () => void;
  breadcrumbs: Breadcrumb[];
}

/**
 * Manages 3-level folder navigation (databases → buckets → files)
 * and syncs the current selection to URL search params for bookmarkability.
 *
 * URL shape: ?db=<database>&bucket=<bucket>
 *   - Both absent  → databases level
 *   - db only      → buckets level
 *   - db + bucket  → files level
 */
export function useBrowseNavigation(): UseBrowseNavigationReturn {
  const { queryParams, setParams, resetAllQueryParams } = useQueryParams();

  const selectedDatabase: string | null = (queryParams.db as string) ?? null;
  const selectedBucket: string | null = (queryParams.bucket as string) ?? null;

  const currentLevel: BrowseLevel = useMemo(() => {
    if (selectedDatabase && selectedBucket) return 'files';
    if (selectedDatabase) return 'buckets';
    return 'databases';
  }, [selectedDatabase, selectedBucket]);

  const navigateTo = useCallback(
    (level: BrowseLevel, value?: string) => {
      switch (level) {
        case 'databases':
          resetAllQueryParams();
          break;

        case 'buckets':
          setParams({ db: value ?? selectedDatabase ?? undefined, bucket: undefined });
          break;

        case 'files':
          setParams({
            db: selectedDatabase ?? undefined,
            bucket: value ?? selectedBucket ?? undefined,
          });
          break;
      }
    },
    [selectedDatabase, selectedBucket, setParams, resetAllQueryParams],
  );

  const goBack = useCallback(() => {
    switch (currentLevel) {
      case 'files':
        setParams({ db: selectedDatabase ?? undefined, bucket: undefined });
        break;

      case 'buckets':
        resetAllQueryParams();
        break;

      case 'databases':
        break;
    }
  }, [currentLevel, selectedDatabase, setParams, resetAllQueryParams]);

  const breadcrumbs: Breadcrumb[] = useMemo(() => {
    const crumbs: Breadcrumb[] = [{ label: 'Databases', level: 'databases', value: null }];

    if (selectedDatabase) {
      crumbs.push({ label: selectedDatabase, level: 'buckets', value: selectedDatabase });
    }

    if (selectedDatabase && selectedBucket) {
      crumbs.push({ label: selectedBucket, level: 'files', value: selectedBucket });
    }

    return crumbs;
  }, [selectedDatabase, selectedBucket]);

  return {
    currentLevel,
    selectedDatabase,
    selectedBucket,
    navigateTo,
    goBack,
    breadcrumbs,
  };
}
