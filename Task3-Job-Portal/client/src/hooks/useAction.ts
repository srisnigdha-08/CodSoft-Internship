import { useCallback, useState } from 'react';
import { toApiError } from '../api/client';
import { useToast } from '../context/ToastContext';

/** Wraps a user-triggered request with busy state, field errors and toast feedback. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = useCallback(
    async (action: () => Promise<unknown>, successMessage?: string): Promise<boolean> => {
      setBusy(true);
      setErrors({});
      try {
        await action();
        if (successMessage) toast.success(successMessage);
        return true;
      } catch (error) {
        const apiError = toApiError(error);
        setErrors(apiError.fieldErrors);
        toast.error(apiError.message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  return { busy, errors, run };
}
