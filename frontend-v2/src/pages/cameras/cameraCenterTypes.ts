import type { FormInstance } from 'antd';
import type {
  Camera,
  CameraStatus,
} from '@/shared/api/configCenter';
import type {
  CameraFormValues,
  MonitorConfigFormValues,
  TriggerRuleFormValues,
} from '@/pages/cameras/cameraCenterConfig';
import type {
  CameraCenterDeviceActions,
  CameraCenterLoadingState,
  CameraCenterRuleActions,
  CameraCenterViewState,
  CameraStatusSummary,
} from '@/pages/cameras/cameraCenterStateContracts';

export type { StrategyOption } from '@/pages/cameras/cameraCenterStateContracts';

export type CameraListContext = {
  cameras: Camera[];
  visibleCameras: Camera[];
  cameraSearch: string;
  setCameraSearch: (value: string) => void;
  alertOnly: boolean;
  setAlertOnly: (value: boolean) => void;
  cameraStatusMap: Record<string, CameraStatus>;
  statusSummary: CameraStatusSummary;
  camerasLoading: boolean;
  sweepLoading: boolean;
  runSweepAllCameras: () => void;
  selectCamera: (cameraId: string | null) => void;
};

type CameraCenterFormState = {
  form: FormInstance<CameraFormValues>;
  triggerRuleForm: FormInstance<TriggerRuleFormValues>;
  monitorConfigForm: FormInstance<MonitorConfigFormValues>;
  cameraListContext: CameraListContext;
};

export type CameraCenterState = CameraCenterFormState &
  CameraCenterViewState &
  CameraCenterLoadingState &
  CameraCenterDeviceActions &
  CameraCenterRuleActions;
