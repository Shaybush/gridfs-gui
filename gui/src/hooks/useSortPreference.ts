import { useCallback } from 'react';
import { useLocalStorage } from '@src/hooks/useLocalStorage';

export type SortField = 'name' | 'file_count' | 'total_size';
export type SortDirection = 'asc' | 'desc';

interface SortPreference {
  sortField: SortField;
  sortDirection: SortDirection;
}

interface UseSortPreferenceReturn {
  sortField: SortField;
  sortDirection: SortDirection;
  setSortField: (field: SortField) => void;
  toggleSortDirection: () => void;
  sortItems: <T>(items: T[], getField: (item: T) => string | number) => T[];
}

const LS_KEY_SORT_PREFERENCE = 'gridfs-gui:sort-preference';

const DEFAULT_SORT_PREFERENCE: SortPreference = {
  sortField: 'name',
  sortDirection: 'asc',
};

/**
 * Manages folder sort preferences (field + direction) persisted to localStorage.
 * Provides a generic `sortItems` utility for in-memory sorting.
 */
export function useSortPreference(): UseSortPreferenceReturn {
  const [preference, setPreference] = useLocalStorage<SortPreference>(LS_KEY_SORT_PREFERENCE, DEFAULT_SORT_PREFERENCE);

  const setSortField = useCallback(
    (field: SortField) => {
      setPreference((prev) => ({ ...prev, sortField: field }));
    },
    [setPreference],
  );

  const toggleSortDirection = useCallback(() => {
    setPreference((prev) => ({
      ...prev,
      sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc',
    }));
  }, [setPreference]);

  const sortItems = useCallback(
    <T>(items: T[], getField: (item: T) => string | number): T[] => {
      const multiplier = preference.sortDirection === 'asc' ? 1 : -1;

      return [...items].sort((a, b) => {
        const aVal = getField(a);
        const bVal = getField(b);

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * multiplier;
        }

        return String(aVal).localeCompare(String(bVal)) * multiplier;
      });
    },
    [preference.sortDirection],
  );

  return {
    sortField: preference.sortField,
    sortDirection: preference.sortDirection,
    setSortField,
    toggleSortDirection,
    sortItems,
  };
}
