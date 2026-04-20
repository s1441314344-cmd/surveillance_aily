import type { CameraPayload } from '@/shared/api/cameras';
import type { CameraFormValues } from '@/pages/cameras/cameraCenterConfig';

export const buildCameraPayload = (values: CameraFormValues): CameraPayload => ({
  ...values,
  location: values.location?.trim() || null,
  ip_address: values.ip_address?.trim() || null,
  username: values.username?.trim() || null,
  rtsp_url: values.rtsp_url?.trim() || null,
  password: values.password?.trim() || undefined,
  port: values.port ? Number(values.port) : null,
  frame_frequency_seconds: Number(values.frame_frequency_seconds),
  jpeg_quality: Number(values.jpeg_quality),
});
