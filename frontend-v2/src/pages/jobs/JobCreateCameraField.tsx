import { Form, Select } from 'antd';
import type { OptionItem } from '@/pages/jobs/jobsOptionItem';

type JobCreateCameraResourcesProps = {
  cameraLoading: boolean;
};

type JobCreateCameraOptionsProps = {
  cameraOptions: readonly OptionItem[];
};

type JobCreateCameraFieldProps = {
  resources: JobCreateCameraResourcesProps;
  options: JobCreateCameraOptionsProps;
};

export function JobCreateCameraField({ resources, options }: JobCreateCameraFieldProps) {
  return (
    <Form.Item
      label="选择摄像头"
      name="cameraId"
      rules={[{ required: true, message: '请选择摄像头' }]}
    >
      <Select
        data-testid="job-create-camera"
        placeholder="请选择一个可用摄像头"
        loading={resources.cameraLoading}
        options={[...options.cameraOptions]}
      />
    </Form.Item>
  );
}
