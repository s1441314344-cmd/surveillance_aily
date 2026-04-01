import axios from 'axios';

const localDetectorBaseUrl = import.meta.env.VITE_LOCAL_DETECTOR_BASE_URL ?? 'http://localhost:8091';

const localDetectorClient = axios.create({
  baseURL: localDetectorBaseUrl,
  timeout: 15000,
});

export type LocalDetectorHealth = {
  status: string;
  ready: boolean;
  error?: string;
};

export type LocalDetectorConfig = {
  model_profile: 'speed' | 'balance' | 'custom';
  model_name: string;
  model_path: string;
  model_url: string;
  auto_download: boolean;
  input_size: number;
  preprocess_mode: 'auto' | 'bgr_255' | 'rgb_255' | 'bgr_01' | 'rgb_01';
  score_threshold: number;
  nms_threshold: number;
  default_person_threshold: number;
};

export type LocalDetectorConfigOption = {
  value: string;
  label: string;
};

export type LocalDetectorConfigResponse = {
  config: LocalDetectorConfig;
  model_profile_options: LocalDetectorConfigOption[];
  preprocess_mode_options: LocalDetectorConfigOption[];
};

export type LocalDetectorConfigUpdatePayload = Partial<{
  model_profile: 'speed' | 'balance' | 'custom';
  model_name: string;
  model_path: string;
  model_url: string;
  auto_download: boolean;
  input_size: number;
  preprocess_mode: 'auto' | 'bgr_255' | 'rgb_255' | 'bgr_01' | 'rgb_01';
  score_threshold: number;
  nms_threshold: number;
  default_person_threshold: number;
}>;

export type LocalDetectorDetection = {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
};

export type LocalDetectorSignals = {
  person?: number;
  fire?: number;
  leak?: number;
  [key: string]: number | undefined;
};

export type LocalDetectorDetectResult = {
  signals: LocalDetectorSignals;
  detections: LocalDetectorDetection[];
  model_meta: {
    model_name: string;
    input_size?: number;
    preprocess_variant?: string;
    score_threshold?: number;
    nms_threshold?: number;
    person_threshold?: number;
    latency_ms: number;
  };
  decision: {
    pass: boolean;
    reason: string;
  };
  rule_evaluation?: Array<{
    signal_key: string;
    labels: string[];
    min_confidence: number;
    min_detections: number;
    matched_count: number;
    passed: boolean;
  }>;
};

export type LocalDetectorRuleConfig = {
  signal_key: string;
  labels: string[];
  min_confidence: number;
  min_detections: number;
};

export async function getLocalDetectorHealth() {
  const response = await localDetectorClient.get<LocalDetectorHealth>('/healthz');
  return response.data;
}

export async function getLocalDetectorConfig() {
  const response = await localDetectorClient.get<LocalDetectorConfigResponse>('/v1/config');
  return response.data;
}

export async function updateLocalDetectorConfig(payload: LocalDetectorConfigUpdatePayload) {
  const response = await localDetectorClient.put<LocalDetectorConfigResponse>('/v1/config', payload, {
    timeout: 120000,
  });
  return response.data;
}

export async function detectWithLocalDetector(payload: {
  file: File;
  personThreshold: number;
  ruleMode?: 'and' | 'or';
  rules?: LocalDetectorRuleConfig[];
}) {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('person_threshold', String(payload.personThreshold));
  if (payload.ruleMode) {
    formData.append('rule_mode', payload.ruleMode);
  }
  if (payload.rules && payload.rules.length > 0) {
    formData.append('rules_json', JSON.stringify(payload.rules));
  }
  const response = await localDetectorClient.post<LocalDetectorDetectResult>('/v1/detect', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}
