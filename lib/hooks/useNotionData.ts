"use client";

import { useState, useEffect } from "react";

interface UseNotionDataResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

/**
 * Shared hook for fetching array data from a Notion API endpoint.
 * Handles loading state, error state, and Array.isArray validation.
 */
export function useNotionData<T>(endpoint: string): UseNotionDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch(endpoint);
        if (!res.ok) {
          throw new Error(`Failed to fetch data (${res.status})`);
        }
        const json: unknown = await res.json();

        if (cancelled) return;

        if (Array.isArray(json)) {
          setData(json as T[]);
        } else {
          setError("API returned unexpected data format");
          setData([]);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to fetch data";
        setError(message);
        setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [endpoint]);

  return { data, loading, error };
}
