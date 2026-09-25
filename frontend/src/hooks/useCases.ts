/**
 * src/hooks/useCases.ts
 * Fetches the full case list from GET /api/full-cases (richer data)
 * with fallback to GET /cases summaries.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchFullCases } from '../api/client';
import type { CaseDetail } from '../api/types';

interface UseCasesResult {
  cases: CaseDetail[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCases(): UseCasesResult {
  const [cases, setCases] = useState<CaseDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFullCases();
      // Sort by case_id descending so newest appears first
      const sorted = [...data].sort((a, b) =>
        b.case_id.localeCompare(a.case_id),
      );
      setCases(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { cases, loading, error, refetch: load };
}
