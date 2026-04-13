import { render, waitFor } from '@testing-library/react';
import type { FormInstance } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import type { Camera } from '@/shared/api/configCenter';
import { DEFAULT_CAMERA_VALUES, type CameraFormValues } from '@/pages/cameras/cameraCenterConfig';
import { useCameraFormSync } from '@/pages/cameras/useCameraFormSync';

function Harness({
  activeCamera,
  form,
}: {
  activeCamera: Camera | null;
  form: FormInstance<CameraFormValues>;
}) {
  useCameraFormSync({ activeCamera, form });
  return null;
}

describe('useCameraFormSync', () => {
  it('sets default form values when no active camera is selected', async () => {
    const setFieldsValue = vi.fn();
    const form = { setFieldsValue } as unknown as FormInstance<CameraFormValues>;

    render(<Harness activeCamera={null} form={form} />);

    await waitFor(() => expect(setFieldsValue).toHaveBeenCalledTimes(1));
    expect(setFieldsValue).toHaveBeenCalledWith(DEFAULT_CAMERA_VALUES);
  });

  it('maps selected camera data to form fields with expected fallbacks', async () => {
    const setFieldsValue = vi.fn();
    const form = { setFieldsValue } as unknown as FormInstance<CameraFormValues>;
    const activeCamera: Camera = {
      id: 'camera-1',
      name: 'Gate Camera',
      location: null,
      ip_address: null,
      port: null,
      protocol: 'rtsp',
      username: null,
      rtsp_url: null,
      frame_frequency_seconds: 45,
      resolution: '720p',
      jpeg_quality: 70,
      storage_path: '/tmp/camera',
      has_password: true,
    };

    render(<Harness activeCamera={activeCamera} form={form} />);

    await waitFor(() => expect(setFieldsValue).toHaveBeenCalledTimes(1));
    expect(setFieldsValue).toHaveBeenCalledWith({
      name: 'Gate Camera',
      location: '',
      ip_address: '',
      port: 554,
      protocol: 'rtsp',
      username: '',
      password: '',
      rtsp_url: '',
      frame_frequency_seconds: 45,
      resolution: '720p',
      jpeg_quality: 70,
      storage_path: '/tmp/camera',
    });
  });
});
