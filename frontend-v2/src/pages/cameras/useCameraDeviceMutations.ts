import type { FormInstance } from 'antd';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import {
  type CameraDiagnostic,
} from '@/shared/api/cameras';
import { type CameraFormValues } from '@/pages/cameras/cameraCenterConfig';
import { CAMERA_INVALIDATION_KEYS } from '@/pages/cameras/cameraQueryKeys';
import { useCameraBaseMutations } from '@/pages/cameras/useCameraBaseMutations';
import { useCameraMediaMutations } from '@/pages/cameras/useCameraMediaMutations';

type UseCameraDeviceMutationsParams = {
  message: ReturnType<typeof import('antd').App.useApp>['message'];
  queryClient: QueryClient;
  onSelectCamera: (cameraId: string | null) => void;
  onDiagnosticResult: (diagnostic: CameraDiagnostic) => void;
  form: FormInstance<CameraFormValues>;
};

export function useCameraDeviceMutations({
  message,
  queryClient,
  onSelectCamera,
  onDiagnosticResult,
  form,
}: UseCameraDeviceMutationsParams) {
  const cameraQueryKeysToInvalidate: QueryKey[] = [...CAMERA_INVALIDATION_KEYS.core];
  const baseMutations = useCameraBaseMutations({
    message,
    queryClient,
    cameraQueryKeysToInvalidate,
    onSelectCamera,
    onDiagnosticResult,
    form,
  });

  const mediaMutations = useCameraMediaMutations({
    message,
    queryClient,
    cameraQueryKeysToInvalidate,
  });

  return {
    ...baseMutations,
    ...mediaMutations,
  };
}
