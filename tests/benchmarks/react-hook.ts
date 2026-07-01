/**
 * @file usePaginatedQuery.ts
 * @description Custom hook for cursor-based pagination with SWR and optimistic updates.
 */

import { useCallback, useMemo, useState } from "react";
import useSWR, { type SWRConfiguration } from "swr";
import { fetcher } from "@/lib/api/fetcher";

/** Single page returned by the paginated API */
export interface PaginatedPage<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
}

/** Options passed to usePaginatedQuery */
export interface UsePaginatedQueryOptions<T> extends SWRConfiguration {
  pageSize?: number;
  initialCursor?: string | null;
  transform?: (item: unknown) => T;
}

/**
 * Fetches and accumulates cursor-paginated data.
 *
 * @example
 * ```tsx
 * const { items, loadMore, isLoading } = usePaginatedQuery<User>("/api/users");
 * ```
 */
export function usePaginatedQuery<T>(
  endpoint: string,
  options: UsePaginatedQueryOptions<T> = {},
) {
  const { pageSize = 25, initialCursor = null, transform, ...swrOpts } = options;
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [accumulated, setAccumulated] = useState<T[]>([]);

  const key = useMemo(
    () => `${endpoint}?cursor=${cursor ?? ""}&limit=${pageSize}`,
    [endpoint, cursor, pageSize],
  );

  const { data, error, isLoading, mutate } = useSWR<PaginatedPage<T>>(
    key,
    fetcher,
    swrOpts,
  );

  const loadMore = useCallback(() => {
    if (data?.nextCursor) setCursor(data.nextCursor);
  }, [data?.nextCursor]);

  const items = useMemo(() => {
    if (!data?.items) return accumulated;
    const mapped = transform ? data.items.map(transform) : data.items;
    return cursor ? [...accumulated, ...mapped] : mapped;
  }, [accumulated, cursor, data?.items, transform]);

  return { items, loadMore, isLoading, error, mutate, hasMore: Boolean(data?.nextCursor) };
}
