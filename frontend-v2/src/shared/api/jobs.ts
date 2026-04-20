// @prd /prd/modules/jobs-center.md §5 数据模型 - Job / JobSchedule
import { apiClient } from './client';

export type Job = {
  id: string;
  job_type: string;
  trigger_mode: string;
  strategy_id: string;
  strategy_name: string;
  camera_id: string | null;
  schedule_id: string | null;
  model_provider: string;
  model_name: string;
  status: string;
  total_items: number;
  completed_items: number;
  failed_items: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
};

export type JobSchedule = {
  id: string;
  camera_id: string;
  strategy_id: string;
  precheck_strategy_id: string | null;
  precheck_config: {
    person_threshold?: number;
    soft_negative_threshold?: number;
    state_ttl_seconds?: number;
  } | null;
  schedule_type: string;
  schedule_value: string;
  status: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function uploadJob(payload: { strategyId: string; files: File[] }) {
  const formData = new FormData();
  formData.append('strategy_id', payload.strategyId);
  for (const file of payload.files) {
    formData.append('files', file);
  }
  const response = await apiClient.post<Job>('/api/jobs/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function createCameraOnceJob(payload: {
  cameraId: string;
  strategyId: string;
  modelProvider?: string;
  modelName?: string;
}) {
  const response = await apiClient.post<Job>('/api/jobs/cameras/once', {
    camera_id: payload.cameraId,
    strategy_id: payload.strategyId,
    model_provider: payload.modelProvider,
    model_name: payload.modelName,
  });
  return response.data;
}

export async function createCameraSnapshotUploadJob(payload: {
  cameraId: string;
  strategyId: string;
}) {
  const response = await apiClient.post<Job>('/api/jobs/cameras/snapshot-upload', {
    camera_id: payload.cameraId,
    strategy_id: payload.strategyId,
  });
  return response.data;
}

export async function listJobSchedules(params?: {
  status?: string;
  cameraId?: string;
  strategyId?: string;
}) {
  const response = await apiClient.get<JobSchedule[]>('/api/job-schedules', {
    params: {
      status: params?.status || undefined,
      camera_id: params?.cameraId || undefined,
      strategy_id: params?.strategyId || undefined,
    },
  });
  return response.data;
}

export async function createJobSchedule(payload: {
  cameraId: string;
  strategyId: string;
  precheckStrategyId?: string;
  precheckConfig?: {
    personThreshold?: number;
    softNegativeThreshold?: number;
    stateTtlSeconds?: number;
  };
  scheduleType: string;
  scheduleValue: string;
}) {
  const precheckConfig =
    payload.precheckConfig &&
    Object.keys(payload.precheckConfig).length > 0
      ? {
          person_threshold: payload.precheckConfig.personThreshold,
          soft_negative_threshold: payload.precheckConfig.softNegativeThreshold,
          state_ttl_seconds: payload.precheckConfig.stateTtlSeconds,
        }
      : null;
  const response = await apiClient.post<JobSchedule>('/api/job-schedules', {
    camera_id: payload.cameraId,
    strategy_id: payload.strategyId,
    precheck_strategy_id: payload.precheckStrategyId || null,
    precheck_config: precheckConfig,
    schedule_type: payload.scheduleType,
    schedule_value: payload.scheduleValue,
  });
  return response.data;
}

export async function updateJobSchedule(
  scheduleId: string,
  payload: {
    cameraId?: string;
    strategyId?: string;
    precheckStrategyId?: string;
    precheckConfig?: {
      personThreshold?: number;
      softNegativeThreshold?: number;
      stateTtlSeconds?: number;
    };
    scheduleType?: string;
    scheduleValue?: string;
    status?: string;
  },
) {
  const requestBody: Record<string, unknown> = {
    camera_id: payload.cameraId,
    strategy_id: payload.strategyId,
    schedule_type: payload.scheduleType,
    schedule_value: payload.scheduleValue,
    status: payload.status,
  };
  if (Object.prototype.hasOwnProperty.call(payload, 'precheckStrategyId')) {
    requestBody.precheck_strategy_id = payload.precheckStrategyId || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'precheckConfig')) {
    const cfg = payload.precheckConfig;
    requestBody.precheck_config =
      cfg && Object.keys(cfg).length > 0
        ? {
            person_threshold: cfg.personThreshold,
            soft_negative_threshold: cfg.softNegativeThreshold,
            state_ttl_seconds: cfg.stateTtlSeconds,
          }
        : null;
  }
  const response = await apiClient.patch<JobSchedule>(`/api/job-schedules/${scheduleId}`, requestBody);
  return response.data;
}

export async function updateJobScheduleStatus(scheduleId: string, status: string) {
  const response = await apiClient.patch<JobSchedule>(`/api/job-schedules/${scheduleId}/status`, {
    status,
  });
  return response.data;
}

export async function deleteJobSchedule(scheduleId: string) {
  const response = await apiClient.delete<{ deleted: boolean }>(`/api/job-schedules/${scheduleId}`);
  return response.data;
}

export async function runJobScheduleNow(scheduleId: string) {
  const response = await apiClient.post<Job>(`/api/job-schedules/${scheduleId}/run-now`);
  return response.data;
}

export async function listJobs(params?: {
  status?: string;
  jobType?: string;
  strategyId?: string;
  triggerMode?: string;
  cameraId?: string;
  scheduleId?: string;
  createdFrom?: string;
  createdTo?: string;
}) {
  const response = await apiClient.get<Job[]>('/api/jobs', {
    params: {
      status: params?.status || undefined,
      job_type: params?.jobType || undefined,
      strategy_id: params?.strategyId || undefined,
      trigger_mode: params?.triggerMode || undefined,
      camera_id: params?.cameraId || undefined,
      schedule_id: params?.scheduleId || undefined,
      created_from: params?.createdFrom || undefined,
      created_to: params?.createdTo || undefined,
    },
  });
  return response.data;
}

export async function getJob(jobId: string) {
  const response = await apiClient.get<Job>(`/api/jobs/${jobId}`);
  return response.data;
}

export async function cancelJob(jobId: string) {
  const response = await apiClient.post<Job>(`/api/jobs/${jobId}/cancel`);
  return response.data;
}

export async function retryJob(jobId: string) {
  const response = await apiClient.post<Job>(`/api/jobs/${jobId}/retry`);
  return response.data;
}
