import type { Job } from '@/shared/api/tasks';

export type JobDetailViewModel = {
  id: string;
  status: string;
  trigger_mode?: string;
  strategy_name?: string;
  model_provider?: string;
  job_type?: string;
  camera_id?: string;
  schedule_id?: string | null;
  triggered_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
  duration_ms?: number;
  result_status?: string;
  feedback_status?: string;
  raw_model_response?: string;
  normalized_json?: Record<string, unknown> | null;
};

export const mapJobToDetailView = (job: Job | null): JobDetailViewModel | null => {
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    status: job.status,
    trigger_mode: job.trigger_mode,
    strategy_name: job.strategy_name,
    model_provider: job.model_provider,
    job_type: job.job_type,
    camera_id: job.camera_id ?? undefined,
    schedule_id: job.schedule_id,
    triggered_at: job.started_at,
    finished_at: job.finished_at,
    created_at: job.created_at,
  };
};
