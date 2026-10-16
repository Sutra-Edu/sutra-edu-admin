"use client";

import { useCallback, useEffect, useState } from "react";
import api, { errorMessage } from "@/lib/api";
import type { CatalogItem } from "@/lib/types";

/** GET helper with loading / error state and a reload function (path = null skips the request) */
export function useApi<T>(path: string | null, initial: T) {
  // `key` records which path the data belongs to, so loading is derived instead of toggled inside the effect
  const [state, setState] = useState<{ key: string | null; data: T; error: string | null }>({ key: null, data: initial, error: null });

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api.get<T>(path)
      .then((res) => !cancelled && setState({ key: path, data: res.data, error: null }))
      .catch((err) => !cancelled && setState((s) => ({ ...s, key: path, error: errorMessage(err) })));
    return () => { cancelled = true; };
  }, [path]);

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const res = await api.get<T>(path);
      setState({ key: path, data: res.data, error: null });
    } catch (err) {
      setState((s) => ({ ...s, error: errorMessage(err) }));
    }
  }, [path]);

  const setData = useCallback((data: T) => setState((s) => ({ ...s, data })), []);

  return { data: state.data, setData, loading: !!path && state.key !== path, error: state.error, reload };
}

/** Boards, classes and subjects (active only unless includeInactive) */
export function useCatalog(includeInactive = false) {
  const q = includeInactive ? "?includeInactive=true" : "";
  const boards = useApi<CatalogItem[]>(`/admin/catalog/board${q}`, []);
  const classes = useApi<CatalogItem[]>(`/admin/catalog/class${q}`, []);
  const subjects = useApi<CatalogItem[]>(`/admin/catalog/subject${q}`, []);
  return {
    boards: boards.data,
    classes: classes.data,
    subjects: subjects.data,
    loading: boards.loading || classes.loading || subjects.loading,
    error: boards.error || classes.error || subjects.error,
    reload: () => Promise.all([boards.reload(), classes.reload(), subjects.reload()]),
  };
}
