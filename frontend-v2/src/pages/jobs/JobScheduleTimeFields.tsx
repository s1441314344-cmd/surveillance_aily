import { Form, Input, InputNumber } from 'antd';
import type { UploadFormValues } from '@/pages/jobs/types';

type JobScheduleTimeFieldsProps = {
  scheduleType: NonNullable<UploadFormValues['scheduleType']>;
};

export function JobScheduleTimeFields({ scheduleType }: JobScheduleTimeFieldsProps) {
  return scheduleType === 'interval_minutes' ? (
    <Form.Item
      label="执行间隔(分钟)"
      name="intervalMinutes"
      rules={[{ required: true, message: '请输入执行间隔' }]}
    >
      <InputNumber min={1} placeholder="例如 15" className="input-full" />
    </Form.Item>
  ) : (
    <Form.Item
      label="每日执行时间"
      name="dailyTime"
      rules={[{ required: true, message: '请输入每日执行时间' }]}
    >
      <Input placeholder="例如 08:30" />
    </Form.Item>
  );
}
