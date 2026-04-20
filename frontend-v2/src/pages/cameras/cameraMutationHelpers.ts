import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { MessageInstance } from 'antd/es/message/interface';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';

export const createApiErrorHandler = (message: MessageInstance, fallback: string) => (error: unknown) => {
  message.error(getApiErrorMessage(error, fallback));
};

export const createNetworkErrorHandler = (
  message: MessageInstance,
  defaultText: string,
  networkText: string,
) => (error: unknown) => {
  const raw = getApiErrorMessage(error, defaultText);
  const normalized = raw.toLowerCase();
  if (normalized.includes('network error') || normalized.includes('timeout')) {
    message.error(networkText);
    return;
  }
  message.error(raw);
};

export const invalidateQueryKeys = async (queryClient: QueryClient, queryKeys: QueryKey[]) => {
  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
};

export const withQueryInvalidation =
  <TData, TVariables, TContext>(
    queryClient: QueryClient,
    queryKeys: QueryKey[],
    callback?: (data: TData, variables: TVariables, context: TContext) => void | Promise<void>,
  ) =>
  async (data: TData, variables: TVariables, context: TContext) => {
    await invalidateQueryKeys(queryClient, queryKeys);
    if (callback) {
      await callback(data, variables, context);
    }
  };
