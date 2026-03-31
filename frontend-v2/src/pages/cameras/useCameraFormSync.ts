/* eslint-disable react-hooks/set-state-in-effect -- camera form sync intentionally resets the form when the active camera changes. */
import { useEffect } from 'react';
import type { FormInstance } from 'antd';
import type { Camera } from '@/shared/api/configCenter';
import {
  DEFAULT_CAMERA_VALUES,
  type CameraFormValues,
} from '@/pages/cameras/cameraCenterConfig';

export function useCameraFormSync({
  activeCamera,
  form,
}: {
  activeCamera: Camera | null;
  form: FormInstance<CameraFormValues>;
}) {
  useEffect(() => {
    if (!activeCamera) {
      form.setFieldsValue(DEFAULT_CAMERA_VALUES);
      return;
    }

    form.setFieldsValue({
      name: activeCamera.name,
      location: activeCamera.location ?? '',
      ip_address: activeCamera.ip_address ?? '',
      port: activeCamera.port ?? 554,
      protocol: activeCamera.protocol,
      username: activeCamera.username ?? '',
      password: '',
      rtsp_url: activeCamera.rtsp_url ?? '',
      frame_frequency_seconds: activeCamera.frame_frequency_seconds,
      resolution: activeCamera.resolution,
      jpeg_quality: activeCamera.jpeg_quality,
      storage_path: activeCamera.storage_path,
    });
  }, [activeCamera, form]);
}
