import type { FormInstance } from 'antd';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import {
  type CameraDiagnostic,
  type CameraPayload,
  checkAllCamerasStatus,
  checkCameraStatus,
  createCamera,
  deleteCamera,
  diagnoseCamera,
  updateCamera,
} from '@/shared/api/configCenter';
import { DEFAULT_CAMERA_VALUES, type CameraFormValues } from '@/pages/cameras/cameraCenterConfig';
import { CAMERA_QUERY_KEYS } from '@/pages/cameras/cameraQueryKeys';
import {
  createApiErrorHandler,
  invalidateQueryKeys,
  withQueryInvalidation,
} from '@/pages/cameras/cameraMutationHelpers';

type UseCameraBaseMutationsParams = {
  message: ReturnType<typeof import('antd').App.useApp>['message'];
  queryClient: QueryClient;
  cameraQueryKeysToInvalidate: QueryKey[];
  onSelectCamera: (cameraId: string | null) => void;
  onDiagnosticResult: (diagnostic: CameraDiagnostic) => void;
  form: FormInstance<CameraFormValues>;
};

export function useCameraBaseMutations({
  message,
  queryClient,
  cameraQueryKeysToInvalidate,
  onSelectCamera,
  onDiagnosticResult,
  form,
}: UseCameraBaseMutationsParams) {
  const createMutation = useMutation({
    mutationFn: createCamera,
    onSuccess: withQueryInvalidation(
      queryClient,
      cameraQueryKeysToInvalidate,
      async (camera) => {
        onSelectCamera(camera.id);
        message.success('摄像头已创建');
      },
    ),
    onError: createApiErrorHandler(message, '摄像头创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ cameraId, payload }: { cameraId: string; payload: Partial<CameraPayload> }) =>
      updateCamera(cameraId, payload),
    onSuccess: withQueryInvalidation(queryClient, cameraQueryKeysToInvalidate, async () => {
      message.success('摄像头配置已更新');
    }),
    onError: createApiErrorHandler(message, '摄像头更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCamera,
    onSuccess: withQueryInvalidation(queryClient, cameraQueryKeysToInvalidate, async () => {
      onSelectCamera(null);
      form.setFieldsValue(DEFAULT_CAMERA_VALUES);
      message.success('摄像头已删除');
    }),
    onError: createApiErrorHandler(message, '摄像头删除失败'),
  });

  const checkMutation = useMutation({
    mutationFn: checkCameraStatus,
    onSuccess: async (result) => {
      await invalidateQueryKeys(queryClient, [
        CAMERA_QUERY_KEYS.cameraStatus(result.camera_id),
        CAMERA_QUERY_KEYS.cameraStatuses,
      ]);
      message.success('摄像头状态检查完成');
    },
    onError: createApiErrorHandler(message, '摄像头状态检查失败'),
  });

  const sweepMutation = useMutation({
    mutationFn: (cameraIds?: string[]) => checkAllCamerasStatus({ cameraIds }),
    onSuccess: withQueryInvalidation(
      queryClient,
      cameraQueryKeysToInvalidate,
      async (summary: { checked_count: number; total_count: number; failed_count: number }) => {
        message.success(
          `全量巡检完成：检查 ${summary.checked_count}/${summary.total_count}，失败 ${summary.failed_count}`,
        );
      },
    ),
    onError: createApiErrorHandler(message, '全量巡检失败'),
  });

  const diagnoseMutation = useMutation({
    mutationFn: (cameraId: string) => diagnoseCamera(cameraId),
    onSuccess: async (diagnostic) => {
      onDiagnosticResult(diagnostic);
      await invalidateQueryKeys(queryClient, cameraQueryKeysToInvalidate);
      if (diagnostic.success) {
        message.success('摄像头深度诊断完成');
      } else {
        message.warning('摄像头深度诊断完成，发现异常');
      }
    },
    onError: createApiErrorHandler(message, '摄像头深度诊断失败'),
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    checkMutation,
    sweepMutation,
    diagnoseMutation,
  };
}
