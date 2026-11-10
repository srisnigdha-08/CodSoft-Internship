import { useCallback, useEffect, useState } from 'react';
import { errorText } from '../api/client';

interface Settled<T> {
  key: string;
  data?: T;
  error?: string;
}

/**
 * Loads data whenever `key` changes or `reload` is called. Earlier data stays
 * available during a reload so tables do not flash empty.
 */
export function useResource<T>(key: string, load: () => Promise<T>) {
  const [version, setVersion] = useState(0);
  const requestKey = `${key}#${version}`;
  const [settled, setSettled] = useState<Settled<T>>({ key: '' });

  useEffect(() => {
    let current = true;
    load().then(
      (data) => {
        if (current) setSettled({ key: requestKey, data });
      },
      (error: unknown) => {
        if (current) setSettled({ key: requestKey, error: errorText(error) });
      },
    );
    return () => {
      current = false;
    };
    // `load` is recreated every render; `requestKey` captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: settled.data, error: settled.error, loading: settled.key !== requestKey, reload };
}
