import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import {
  type CameraPhotoCaptureResult,
  type CameraRecordingResult,
  captureCameraPhoto,
  deleteCameraMedia,
  startCameraRecording,
  stopCameraRecording,
} from '@/shared/api/cameras';
import {
  createApiErrorHandler,
  createNetworkErrorHandler,
  withQueryInvalidation,
} from '@/pages/cameras/cameraMutationHelpers';

type UseCameraMediaMutationsParams = {
  message: ReturnType<typeof import('antd').App.useApp>['message'];
  queryClient: QueryClient;
  cameraQueryKeysToInvalidate: QueryKey[];
};

export function useCameraMediaMutations({
  message,
  queryClient,
  cameraQueryKeysToInvalidate,
}: UseCameraMediaMutationsParams) {
  const capturePhotoMutation = useMutation({
    mutationFn: (cameraId: string) => captureCameraPhoto(cameraId, { sourceKind: 'manual' }),
    onSuccess: withQueryInvalidation(
      queryClient,
      cameraQueryKeysToInvalidate,
      async (result: CameraPhotoCaptureResult) => {
        if (result.success) {
          message.success('拍照成功，照片已写入媒体库');
          return;
        }
        message.error(result.error_message || '拍照失败');
      },
    ),
    onError: createNetworkErrorHandler(
      message,
      '拍照失败',
      '拍照失败：网络连接超时，请检查后端服务和摄像头连通性后重试',
    ),
  });

  const startRecordingMutation = useMutation({
    mutationFn: ({ cameraId, durationSeconds }: { cameraId: string; durationSeconds: number }) =>
      startCameraRecording(cameraId, { durationSeconds, sourceKind: 'manual' }),
    onSuccess: withQueryInvalidation(
      queryClient,
      cameraQueryKeysToInvalidate,
      async (result: CameraRecordingResult) => {
        if (result.success) {
          message.success('视频录制已启动');
          return;
        }
        message.error(result.message || result.media.error_message || '视频录制启动失败');
      },
    ),
    onError: createNetworkErrorHandler(
      message,
      '视频录制启动失败',
      '视频录制启动失败：网络连接超时，请检查后端服务和摄像头连通性后重试',
    ),
  });

  const stopRecordingMutation = useMutation({
    mutationFn: ({ cameraId, mediaId }: { cameraId: string; mediaId: string }) =>
      stopCameraRecording(cameraId, mediaId),
    onSuccess: withQueryInvalidation(queryClient, cameraQueryKeysToInvalidate, async () => {
      message.success('已发送停止录制请求');
    }),
    onError: createNetworkErrorHandler(
      message,
      '停止录制失败',
      '停止录制失败：网络连接异常，请稍后重试',
    ),
  });

  const deleteMediaMutation = useMutation({
    mutationFn: ({ cameraId, mediaId }: { cameraId: string; mediaId: string }) =>
      deleteCameraMedia(cameraId, mediaId),
    onSuccess: withQueryInvalidation(queryClient, cameraQueryKeysToInvalidate, async () => {
      message.success('媒体文件已删除');
    }),
    onError: createApiErrorHandler(message, '媒体删除失败'),
  });

  return {
    capturePhotoMutation,
    startRecordingMutation,
    stopRecordingMutation,
    deleteMediaMutation,
  };
}
