import type {
  Camera,
  CameraDiagnostic,
  CameraMedia,
  CameraStatus,
  CameraStatusLog,
  CameraTriggerRule,
  CameraTriggerRuleDebugResult,
  DebugLiveResult,
} from '@/shared/api/configCenter';
import type {
  CameraFormValues,
  MonitorConfigFormValues,
  TriggerRuleFormValues,
} from '@/pages/cameras/cameraCenterConfig';

export type StrategyOption = {
  label: string;
  value: string;
};

export type CameraStatusSummary = {
  online: number;
  warning: number;
  offline: number;
  unknown: number;
  abnormal: number;
};

export type CameraMonitorConfigData = {
  enabled: boolean;
  runtime_mode: 'daemon' | 'manual' | 'schedule';
  signal_strategy_id: string | null;
  monitor_interval_seconds: number;
  schedule_type: 'interval_minutes' | 'daily_time' | null;
  schedule_value: string | null;
  manual_until: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  last_error: string | null;
};

export type CameraCenterLoadingState = {
  monitorConfigLoading: boolean;
  mediaLoading: boolean;
  triggerRulesLoading: boolean;
  statusLogsLoading: boolean;
  statusLoading: boolean;
  camerasLoading: boolean;
  createOrUpdateCameraLoading: boolean;
  deleteCameraLoading: boolean;
  checkCameraLoading: boolean;
  sweepLoading: boolean;
  diagnoseLoading: boolean;
  capturePhotoLoading: boolean;
  startRecordingLoading: boolean;
  stopRecordingLoading: boolean;
  deleteMediaLoading: boolean;
  createOrUpdateRuleLoading: boolean;
  deleteRuleLoading: boolean;
  debugRuleLoading: boolean;
  saveMonitorConfigLoading: boolean;
  toggleMonitorLoading: boolean;
  liveDebugLoading: boolean;
};

export type CameraCenterDeviceActions = {
  selectCamera: (cameraId: string | null) => void;
  resetForCreate: () => void;
  handleSubmit: (values: CameraFormValues) => Promise<void>;
  deleteSelectedCamera: () => void;
  checkSelectedCamera: () => void;
  diagnoseSelectedCamera: () => void;
  runSweepAllCameras: () => void;
  captureSelectedCameraPhoto: () => void;
  startSelectedCameraRecording: () => void;
  stopSelectedCameraRecording: () => void;
  deleteMediaItem: (mediaId: string) => void;
};

export type CameraCenterRuleActions = {
  openCreateTriggerRuleModal: () => void;
  openEditTriggerRuleModal: (rule: CameraTriggerRule) => void;
  closeTriggerRuleModal: () => void;
  handleSubmitTriggerRule: (values: TriggerRuleFormValues) => Promise<void>;
  deleteTriggerRule: (ruleId: string) => void;
  runTriggerRulesDebug: () => Promise<void>;
  runLiveDebug: () => Promise<void>;
  submitMonitorConfig: (values: MonitorConfigFormValues) => Promise<void>;
  toggleMonitorEnabled: (enabled: boolean) => void;
};

export type CameraCenterViewState = {
  selectedCameraId: string | null;
  effectiveSelectedCameraId: string | null;
  activeCamera: Camera | null;
  isCreateMode: boolean;
  cameras: Camera[];
  visibleCameras: Camera[];
  cameraSearch: string;
  setCameraSearch: (value: string) => void;
  alertOnly: boolean;
  setAlertOnly: (value: boolean) => void;
  cameraStatusMap: Record<string, CameraStatus>;
  statusSummary: CameraStatusSummary;
  selectedCameraStatus: CameraStatus | null;
  selectedCameraStatusLogs: CameraStatusLog[];
  pagedStatusLogs: CameraStatusLog[];
  statusLogsPage: number;
  setStatusLogsPage: (page: number) => void;
  statusLogsPageSize: number;
  selectedCameraMedia: CameraMedia[];
  selectedCameraTriggerRules: CameraTriggerRule[];
  activeRecordingMedia: CameraMedia | null;
  recordDurationSeconds: number;
  setRecordDurationSeconds: (value: number) => void;
  thumbnailUrls: Record<string, string>;
  previewOpen: boolean;
  previewMedia: CameraMedia | null;
  previewUrl: string | null;
  closePreview: () => void;
  handlePreviewMedia: (media: CameraMedia) => Promise<void>;
  diagnosticModalOpen: boolean;
  setDiagnosticModalOpen: (value: boolean) => void;
  lastDiagnostic: CameraDiagnostic | null;
  triggerRuleModalOpen: boolean;
  setTriggerRuleModalOpen: (value: boolean) => void;
  editingTriggerRule: CameraTriggerRule | null;
  debugSignalsJson: string;
  setDebugSignalsJson: (value: string) => void;
  debugConsecutiveJson: string;
  setDebugConsecutiveJson: (value: string) => void;
  triggerDebugDryRun: boolean;
  setTriggerDebugDryRun: (value: boolean) => void;
  triggerDebugCaptureOnMatch: boolean;
  setTriggerDebugCaptureOnMatch: (value: boolean) => void;
  triggerDebugResult: CameraTriggerRuleDebugResult | null;
  liveDebugResult: DebugLiveResult | null;
  recordingCountdown: number | null;
  monitorStrategyOptions: StrategyOption[];
  monitorConfigData: CameraMonitorConfigData | null;
};
