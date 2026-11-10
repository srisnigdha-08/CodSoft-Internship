import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, toApiError } from '../api/client';

export interface AsyncState<T> {
  data?: T;
  error?: ApiError;
  loading: boolean;
  reload: () => Promise<void>;
}

/** Runs a memoized loader on mount and whenever it changes. Only the latest result is kept. */
export function useAsync<T>(loader: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<Omit<AsyncState<T>, 'reload'>>({ loading: true });
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    setState((previous) => ({ data: previous.data, loading: true }));
    try {
      const data = await loader();
      if (request === latest.current) setState({ data, loading: false });
    } catch (error) {
      if (request === latest.current) setState({ error: toApiError(error), loading: false });
    }
  }, [loader]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
