import { App } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { Camera } from '@/shared/api/cameras';
import type { UploadFormValues } from '@/pages/jobs/types';
import { collectRcFiles, getScheduleValue, requireSelectedCamera, requireRtspCamera } from '@/pages/jobs/jobsFormUtils';
import type { useJobsMutationState } from '@/pages/jobs/useJobsMutationState';

const CAMERA_WARNING = '请先选择摄像头';
const RTSP_WARNING = '当前 V1 任务链路仅支持 RTSP 摄像头，ONVIF 为后续扩展能力';
const SNAPSHOT_CAMERA_WARNING = '请先选择拍照摄像头';
const SNAPSHOT_RTSP_WARNING = '当前 V1 仅支持 RTSP 摄像头拍照上传';

type JobsSubmitActionsFeedbackParams = {
  message: ReturnType<typeof App.useApp>['message'];
};

type JobsSubmitActionsResourcesParams = {
  fileList: UploadFile[];
  selectedCameraInForm: Camera | null;
  selectedUploadCameraInForm: Camera | null;
};

type JobsSubmitActionsMutationsParams = ReturnType<typeof useJobsMutationState>;

type JobsSubmitActionsParams = {
  feedback: JobsSubmitActionsFeedbackParams;
  resources: JobsSubmitActionsResourcesParams;
  mutations: JobsSubmitActionsMutationsParams;
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
  if (
    !requireSelectedCamera({
      cameraId,
      feedback: {
        message,
        warningText: cameraWarning,
      },
    })
  ) {
    return null;
  }
  if (
    !requireRtspCamera({
      camera,
      feedback: {
        message,
        warningText: rtspWarning,
      },
    })
  ) {
    return null;
  }
  return cameraId ?? null;
}

export async function handleJobsUploadSubmit(
  values: UploadFormValues,
  {
    feedback,
    resources,
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
      camera: resources.selectedCameraInForm,
      message: feedback.message,
      cameraWarning: CAMERA_WARNING,
      rtspWarning: RTSP_WARNING,
    });
    if (!cameraId) {
      return;
    }

    const scheduleValue = getScheduleValue({
      scheduleType: values.scheduleType,
      dailyTime: values.dailyTime,
      intervalMinutes: values.intervalMinutes,
    });

    if (!values.scheduleType || !scheduleValue) {
      feedback.message.warning('请补充完整的定时任务配置');
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
      camera: resources.selectedCameraInForm,
      message: feedback.message,
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
      camera: resources.selectedUploadCameraInForm,
      message: feedback.message,
      cameraWarning: SNAPSHOT_CAMERA_WARNING,
      rtspWarning: SNAPSHOT_RTSP_WARNING,
    });
    if (!cameraId) {
      return;
    }

    await cameraSnapshotUploadMutation.mutateAsync({ cameraId, strategyId: values.strategyId });
    return;
  }

  const files = collectRcFiles(resources.fileList);

  if (!files.length) {
    feedback.message.warning('请先选择至少一张图片');
    return;
  }

  await uploadMutation.mutateAsync({
    strategyId: values.strategyId,
    files,
  });
}
