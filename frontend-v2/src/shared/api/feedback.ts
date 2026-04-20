// @prd /prd/modules/feedback-center.md §5 数据模型 - PredictionFeedback
import { apiClient } from './client';

export type Feedback = {
  id: string;
  record_id: string;
  judgement: string;
  corrected_label: string | null;
  comment: string | null;
  reviewer: string;
  created_at: string | null;
};

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
