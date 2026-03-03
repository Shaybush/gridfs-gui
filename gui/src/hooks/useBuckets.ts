import { useCallback, useEffect, useState } from 'react';
import { API_GATEWAY_URL } from '@src/common/constants';
import { httpClient } from '@src/lib/HttpClient/HttpClient';
import type { BucketInfo, BucketStats } from '@src/types/bucket';

interface UseBucketsReturn {
  buckets: BucketInfo[];
  isLoading: boolean;
  error: string | null;
  fetchBuckets: () => Promise<void>;
  createBucket: (name: string) => Promise<void>;
  getBucketStats: (name: string) => Promise<BucketStats>;
  deleteBucket: (bucketName: string) => Promise<void>;
  renameBucket: (bucketName: string, newName: string) => Promise<BucketInfo>;
  exportBucket: (bucketName: string) => Promise<void>;
}

export function useBuckets(connId: string | undefined, dbName: string | undefined): UseBucketsReturn {
  const [buckets, setBuckets] = useState<BucketInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBuckets = useCallback(async () => {
    if (!connId || !dbName) {
      setBuckets([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { promise } = httpClient.get<BucketInfo[]>(
        `/api/v1/connections/${connId}/databases/${encodeURIComponent(dbName)}/buckets`,
      );
      const data = await promise;
      setBuckets(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch buckets');
      setBuckets([]);
    } finally {
      setIsLoading(false);
    }
  }, [connId, dbName]);

  const createBucket = useCallback(
    async (name: string): Promise<void> => {
      if (!connId || !dbName) return;

      const { promise } = httpClient.post(
        `/api/v1/connections/${connId}/databases/${encodeURIComponent(dbName)}/buckets`,
        { body: { name } },
      );
      await promise;
      await fetchBuckets();
    },
    [connId, dbName, fetchBuckets],
  );

  const getBucketStats = useCallback(
    async (name: string): Promise<BucketStats> => {
      if (!connId || !dbName) throw new Error('No connection or database selected');

      const { promise } = httpClient.get<BucketStats>(
        `/api/v1/connections/${connId}/databases/${encodeURIComponent(dbName)}/buckets/${encodeURIComponent(name)}/stats`,
      );
      return promise;
    },
    [connId, dbName],
  );

  const deleteBucket = useCallback(
    async (bucketName: string): Promise<void> => {
      if (!connId || !dbName) return;

      const { promise } = httpClient.delete(
        `/api/v1/connections/${connId}/databases/${encodeURIComponent(dbName)}/buckets/${encodeURIComponent(bucketName)}?confirm=true`,
      );
      await promise;
      await fetchBuckets();
    },
    [connId, dbName, fetchBuckets],
  );

  const renameBucket = useCallback(
    async (bucketName: string, newName: string): Promise<BucketInfo> => {
      if (!connId || !dbName) throw new Error('No connection or database selected');

      const { promise } = httpClient.put<BucketInfo>(
        `/api/v1/connections/${connId}/databases/${encodeURIComponent(dbName)}/buckets/${encodeURIComponent(bucketName)}`,
        { body: { new_name: newName } },
      );
      const updated = await promise;
      await fetchBuckets();
      return updated;
    },
    [connId, dbName, fetchBuckets],
  );

  const exportBucket = useCallback(
    async (bucketName: string): Promise<void> => {
      if (!connId || !dbName) throw new Error('No connection or database selected');

      const url = `${API_GATEWAY_URL}/api/v1/connections/${connId}/databases/${encodeURIComponent(dbName)}/buckets/${encodeURIComponent(bucketName)}/export`;

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${bucketName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    },
    [connId, dbName],
  );

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  return {
    buckets,
    isLoading,
    error,
    fetchBuckets,
    createBucket,
    getBucketStats,
    deleteBucket,
    renameBucket,
    exportBucket,
  };
}
