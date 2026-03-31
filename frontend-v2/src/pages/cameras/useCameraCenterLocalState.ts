import { useState } from 'react';
import { Form } from 'antd';
import type { CameraDiagnostic } from '@/shared/api/configCenter';
import {
  CREATE_CAMERA_ID,
  DEFAULT_CAMERA_VALUES,
  type CameraFormValues,
  type MonitorConfigFormValues,
  type TriggerRuleFormValues,
} from '@/pages/cameras/cameraCenterConfig';

export function useCameraCenterLocalState(initialSelectedCameraId?: string | null) {
  const [form] = Form.useForm<CameraFormValues>();
  const [triggerRuleForm] = Form.useForm<TriggerRuleFormValues>();
  const [monitorConfigForm] = Form.useForm<MonitorConfigFormValues>();
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(initialSelectedCameraId ?? null);
  const [alertOnly, setAlertOnly] = useState(false);
  const [cameraSearch, setCameraSearch] = useState('');
  const [diagnosticModalOpen, setDiagnosticModalOpen] = useState(false);
  const [lastDiagnostic, setLastDiagnostic] = useState<CameraDiagnostic | null>(null);
  const [recordDurationSeconds, setRecordDurationSeconds] = useState(30);
  const [statusLogsPage, setStatusLogsPage] = useState(1);

  const resetForCreate = () => {
    setSelectedCameraId(CREATE_CAMERA_ID);
    form.setFieldsValue(DEFAULT_CAMERA_VALUES);
  };

  return {
    form,
    triggerRuleForm,
    monitorConfigForm,
    selectedCameraId,
    setSelectedCameraId,
    alertOnly,
    setAlertOnly,
    cameraSearch,
    setCameraSearch,
    diagnosticModalOpen,
    setDiagnosticModalOpen,
    lastDiagnostic,
    setLastDiagnostic,
    recordDurationSeconds,
    setRecordDurationSeconds,
    statusLogsPage,
    setStatusLogsPage,
    resetForCreate,
  };
}
