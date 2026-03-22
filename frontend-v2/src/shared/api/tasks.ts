import { apiClient } from './client';

export type Job = {
  id: string;
  job_type: string;
  trigger_mode: string;
  strategy_id: string;
  strategy_name: string;
  camera_id: string | null;
  model_provider: string;
  model_name: string;
  status: string;
  total_items: number;
  completed_items: number;
  failed_items: number;
  error_message: string | null;
  created_at: string | null;
};

export type TaskRecord = {
  id: string;
  job_id: string;
  strategy_id: string;
  strategy_name: string;
  strategy_snapshot: Record<string, unknown>;
  input_file_asset_id: string | null;
  input_filename: string;
  input_image_path: string;
  preview_image_path: string | null;
  source_type: string;
  camera_id: string | null;
  model_provider: string;
  model_name: string;
  raw_model_response: string;
  normalized_json: Record<string, unknown> | null;
  result_status: string;
  duration_ms: number;
  feedback_status: string;
  created_at: string | null;
};

export type Feedback = {
  id: string;
  record_id: string;
  judgement: string;
  corrected_label: string | null;
  comment: string | null;
  reviewer: string;
  created_at: string | null;
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

export async function listJobs(params?: { status?: string; jobType?: string; strategyId?: string }) {
  const response = await apiClient.get<Job[]>('/api/jobs', {
    params: {
      status: params?.status || undefined,
      job_type: params?.jobType || undefined,
      strategy_id: params?.strategyId || undefined,
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

export async function listTaskRecords(params?: {
  status?: string;
  strategyId?: string;
  jobId?: string;
  modelProvider?: string;
  feedbackStatus?: string;
}) {
  const response = await apiClient.get<TaskRecord[]>('/api/task-records', {
    params: {
      status: params?.status || undefined,
      strategy_id: params?.strategyId || undefined,
      job_id: params?.jobId || undefined,
      model_provider: params?.modelProvider || undefined,
      feedback_status: params?.feedbackStatus || undefined,
    },
  });
  return response.data;
}

export async function getTaskRecord(recordId: string) {
  const response = await apiClient.get<TaskRecord>(`/api/task-records/${recordId}`);
  return response.data;
}

export async function fetchTaskRecordImage(recordId: string) {
  const response = await apiClient.get<Blob>(`/api/task-records/${recordId}/image`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function exportTaskRecords(params?: {
  status?: string;
  strategyId?: string;
  jobId?: string;
  modelProvider?: string;
  feedbackStatus?: string;
}) {
  const response = await apiClient.get<Blob>('/api/task-records/export', {
    params: {
      status: params?.status || undefined,
      strategy_id: params?.strategyId || undefined,
      job_id: params?.jobId || undefined,
      model_provider: params?.modelProvider || undefined,
      feedback_status: params?.feedbackStatus || undefined,
    },
    responseType: 'blob',
  });
  return response.data;
}

export async function listFeedback(params?: { recordId?: string }) {
  const response = await apiClient.get<Feedback[]>('/api/feedback', {
    params: {
      record_id: params?.recordId || undefined,
    },
  });
  return response.data;
}

export async function createFeedback(payload: {
  recordId: string;
  judgement: string;
  correctedLabel?: string;
  comment?: string;
}) {
  const response = await apiClient.post<Feedback>('/api/feedback', {
    record_id: payload.recordId,
    judgement: payload.judgement,
    corrected_label: payload.correctedLabel || null,
    comment: payload.comment || null,
  });
  return response.data;
}

export async function updateFeedback(
  feedbackId: string,
  payload: {
    judgement?: string;
    correctedLabel?: string;
    comment?: string;
  },
) {
  const response = await apiClient.patch<Feedback>(`/api/feedback/${feedbackId}`, {
    judgement: payload.judgement,
    corrected_label: payload.correctedLabel || null,
    comment: payload.comment || null,
  });
  return response.data;
}
