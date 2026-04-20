// @prd /prd/modules/records-center.md §5 数据模型 - TaskRecord
import { apiClient } from './client';

export type TaskRecord = {
  id: string;
  job_id: string;
  job_type: string | null;
  schedule_id: string | null;
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

export async function listTaskRecords(params?: {
  status?: string;
  strategyId?: string;
  jobId?: string;
  jobType?: string;
  scheduleId?: string;
  cameraId?: string;
  modelProvider?: string;
  feedbackStatus?: string;
  createdFrom?: string;
  createdTo?: string;
}) {
  const response = await apiClient.get<TaskRecord[]>('/api/task-records', {
    params: {
      status: params?.status || undefined,
      strategy_id: params?.strategyId || undefined,
      job_id: params?.jobId || undefined,
      job_type: params?.jobType || undefined,
      schedule_id: params?.scheduleId || undefined,
      camera_id: params?.cameraId || undefined,
      model_provider: params?.modelProvider || undefined,
      feedback_status: params?.feedbackStatus || undefined,
      created_from: params?.createdFrom || undefined,
      created_to: params?.createdTo || undefined,
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
  jobType?: string;
  scheduleId?: string;
  cameraId?: string;
  modelProvider?: string;
  feedbackStatus?: string;
  createdFrom?: string;
  createdTo?: string;
  format?: 'csv' | 'xlsx';
}) {
  const response = await apiClient.get<Blob>('/api/task-records/export', {
    params: {
      format: params?.format || 'csv',
      status: params?.status || undefined,
      strategy_id: params?.strategyId || undefined,
      job_id: params?.jobId || undefined,
      job_type: params?.jobType || undefined,
      schedule_id: params?.scheduleId || undefined,
      camera_id: params?.cameraId || undefined,
      model_provider: params?.modelProvider || undefined,
      feedback_status: params?.feedbackStatus || undefined,
      created_from: params?.createdFrom || undefined,
      created_to: params?.createdTo || undefined,
    },
    responseType: 'blob',
  });
  return response.data;
}
