import { Form, Select } from 'antd';
import type { Camera } from '@/shared/api/configCenter';

type JobCreateCameraFieldProps = {
  cameras: Camera[];
  cameraLoading: boolean;
};

export function JobCreateCameraField({ cameras, cameraLoading }: JobCreateCameraFieldProps) {
  return (
    <Form.Item
      label="选择摄像头"
      name="cameraId"
      rules={[{ required: true, message: '请选择摄像头' }]}
    >
      <Select
        data-testid="job-create-camera"
        placeholder="请选择一个可用摄像头"
        loading={cameraLoading}
        options={cameras.map((item) => ({
          label: `${item.name} [${item.protocol.toUpperCase()}] (${item.location || item.rtsp_url || '未配置位置'})`,
          value: item.id,
        }))}
      />
    </Form.Item>
  );
}
