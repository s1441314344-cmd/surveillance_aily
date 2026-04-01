import { App } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { Camera } from '@/shared/api/configCenter';
import type { UploadFormValues } from '@/pages/jobs/types';
import { collectRcFiles, getScheduleValue, requireSelectedCamera, requireRtspCamera } from '@/pages/jobs/jobsFormUtils';
import type { useJobsMutationState } from '@/pages/jobs/useJobsMutationState';

const CAMERA_WARNING = '请先选择摄像头';
const RTSP_WARNING = '当前 V1 任务链路仅支持 RTSP 摄像头，ONVIF 为后续扩展能力';
const SNAPSHOT_CAMERA_WARNING = '请先选择拍照摄像头';
const SNAPSHOT_RTSP_WARNING = '当前 V1 仅支持 RTSP 摄像头拍照上传';

type JobsSubmitActionsParams = {
  message: ReturnType<typeof App.useApp>['message'];
  fileList: UploadFile[];
  selectedCameraInForm: Camera | null;
  selectedUploadCameraInForm: Camera | null;
  mutations: ReturnType<typeof useJobsMutationState>;
};

function validateRtspCameraSelection({
  cameraId,
  camera,
  message,
  cameraWarning,
  rtspWarning,
}: {
  cameraId?: string;
  camera: Camera | null;
  message: ReturnType<typeof App.useApp>['message'];
  cameraWarning: string;
  rtspWarning: string;
}) {
  if (!requireSelectedCamera(cameraId, message, cameraWarning)) {
    return null;
  }
  if (!requireRtspCamera(camera, message, rtspWarning)) {
    return null;
  }
  return cameraId ?? null;
}

export async function handleJobsUploadSubmit(
  values: UploadFormValues,
  {
    message,
    fileList,
    selectedCameraInForm,
    selectedUploadCameraInForm,
    mutations,
  }: JobsSubmitActionsParams,
) {
  const {
    uploadMutation,
    cameraOnceMutation,
    cameraSnapshotUploadMutation,
    scheduleMutation,
  } = mutations;

  if (values.taskMode === 'camera_schedule') {
    const cameraId = validateRtspCameraSelection({
      cameraId: values.cameraId,
      camera: selectedCameraInForm,
      message,
      cameraWarning: CAMERA_WARNING,
      rtspWarning: RTSP_WARNING,
    });
    if (!cameraId) {
      return;
    }

    const scheduleValue = getScheduleValue(
      values.scheduleType,
      values.dailyTime,
      values.intervalMinutes,
    );

    if (!values.scheduleType || !scheduleValue) {
      message.warning('请补充完整的定时任务配置');
      return;
    }
    await scheduleMutation.mutateAsync({
      cameraId,
      strategyId: values.strategyId,
      precheckStrategyId: values.precheckStrategyId || undefined,
      precheckConfig:
        values.precheckStrategyId
          ? {
              personThreshold: values.precheckPersonThreshold,
              softNegativeThreshold: values.precheckSoftNegativeThreshold,
              stateTtlSeconds: values.precheckStateTtlSeconds,
            }
          : undefined,
      scheduleType: values.scheduleType,
      scheduleValue,
    });
    return;
  }

  if (values.taskMode === 'camera_once') {
    const cameraId = validateRtspCameraSelection({
      cameraId: values.cameraId,
      camera: selectedCameraInForm,
      message,
      cameraWarning: CAMERA_WARNING,
      rtspWarning: RTSP_WARNING,
    });
    if (!cameraId) {
      return;
    }

    await cameraOnceMutation.mutateAsync({ cameraId, strategyId: values.strategyId });
    return;
  }

  if (values.uploadSource === 'camera_snapshot') {
    const cameraId = validateRtspCameraSelection({
      cameraId: values.uploadCameraId,
      camera: selectedUploadCameraInForm,
      message,
      cameraWarning: SNAPSHOT_CAMERA_WARNING,
      rtspWarning: SNAPSHOT_RTSP_WARNING,
    });
    if (!cameraId) {
      return;
    }

    await cameraSnapshotUploadMutation.mutateAsync({ cameraId, strategyId: values.strategyId });
    return;
  }

  const files = collectRcFiles(fileList);

  if (!files.length) {
    message.warning('请先选择至少一张图片');
    return;
  }

  await uploadMutation.mutateAsync({
    strategyId: values.strategyId,
    files,
  });
}
