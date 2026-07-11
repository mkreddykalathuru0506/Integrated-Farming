import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError } from './http';
import { useToast } from '../ui/Toast';

export type ApiMutationOptions<TData, TVariables> = UseMutationOptions<
  TData,
  Error,
  TVariables
> & {
  /** i18n key toasted (success variant) after the mutation succeeds. */
  successKey?: string;
  /** Per-mutation overrides: ApiError.code → i18n key for the error toast. */
  errorKeyByCode?: Record<string, string>;
  /** Query keys invalidated after success (usually from the farmKeys factory). */
  invalidate?: readonly (readonly unknown[])[];
};

/**
 * useMutation wrapper — the one standard way panels mutate:
 * - success → optional success toast + invalidate the given query keys;
 * - error → error toast resolved `errorKeyByCode[code]` → `errors.<code>`
 *   (when the key exists) → `errors.generic`.
 * Custom onSuccess/onError callbacks still run after the shared handling.
 */
export function useApiMutation<TData = unknown, TVariables = void>({
  successKey,
  errorKeyByCode,
  invalidate,
  ...options
}: ApiMutationOptions<TData, TVariables>) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      if (successKey) toast.success(t(successKey));
      for (const queryKey of invalidate ?? []) {
        void queryClient.invalidateQueries({ queryKey: queryKey as unknown[] });
      }
      return options.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      const code = error instanceof ApiError ? error.code : undefined;
      const mapped = code ? errorKeyByCode?.[code] : undefined;
      const key =
        mapped ?? (code && i18n.exists(`errors.${code}`) ? `errors.${code}` : 'errors.generic');
      toast.error(t(key));
      return options.onError?.(error, variables, onMutateResult, context);
    },
  });
}
