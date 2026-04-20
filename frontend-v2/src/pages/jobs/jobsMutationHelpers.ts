import type { QueryClient } from '@tanstack/react-query';
import type { MessageInstance } from 'antd/es/message/interface';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';
import { JOBS_QUERY_KEYS } from '@/pages/jobs/jobsQueryKeys';

type JobsMutationHelperCacheParams = {
  queryClient: QueryClient;
};

type JobsMutationHelperFeedbackParams = {
  message: MessageInstance;
};

export const invalidateJobsQueries = async ({ queryClient }: JobsMutationHelperCacheParams) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEYS.jobsRoot }),
    queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEYS.jobDetailRoot }),
    queryClient.invalidateQueries({ queryKey: ['task-records'] }),
  ]);
};

export const invalidateScheduleQueries = async ({ queryClient }: JobsMutationHelperCacheParams) => {
  await queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEYS.jobSchedulesRoot });
};

export const createJobsApiErrorHandler =
  ({
    feedback,
    fallback,
  }: {
    feedback: JobsMutationHelperFeedbackParams;
    fallback: string;
  }) => (error: Error) => {
    const { message } = feedback;
    message.error(getApiErrorMessage(error, fallback));
  };
