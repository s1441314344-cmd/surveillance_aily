import type { QueryClient } from '@tanstack/react-query';
import type { MessageInstance } from 'antd/es/message/interface';
import { getApiErrorMessage } from '@/shared/api/errors';
import { JOBS_QUERY_KEYS } from '@/pages/jobs/jobsQueryKeys';

export const invalidateJobsQueries = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEYS.jobsRoot }),
    queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEYS.jobDetailRoot }),
    queryClient.invalidateQueries({ queryKey: ['task-records'] }),
  ]);
};

export const invalidateScheduleQueries = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEYS.jobSchedulesRoot });
};

export const createJobsApiErrorHandler =
  (message: MessageInstance, fallback: string) => (error: Error) => {
    message.error(getApiErrorMessage(error, fallback));
  };
