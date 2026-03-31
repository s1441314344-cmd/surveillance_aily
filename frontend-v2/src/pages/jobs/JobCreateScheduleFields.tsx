import { Form, Input, InputNumber, Select } from 'antd';
import { SCHEDULE_TYPE_OPTIONS } from '@/shared/ui';
import type { Strategy } from '@/shared/api/configCenter';
import type { UploadFormValues } from '@/pages/jobs/types';

type JobCreateScheduleFieldsProps = {
  scheduleType: NonNullable<UploadFormValues['scheduleType']>;
  strategies: Strategy[];
  strategyLoading: boolean;
};

export function JobCreateScheduleFields({
  scheduleType,
  strategies,
  strategyLoading,
}: JobCreateScheduleFieldsProps) {
  const strategyOptions = strategies.map((item) => ({
    label: `${item.name} (${item.model_provider}/${item.model_name})`,
    value: item.id,
  }));

  return (
    <>
      <Form.Item label="前置判断策略(可选)" name="precheckStrategyId">
        <Select
          allowClear
          showSearch
          placeholder="不配置则按计划直接创建任务；配置后先做一次预判命中"
          loading={strategyLoading}
          options={strategyOptions}
          optionFilterProp="label"
        />
      </Form.Item>

      <Form.Item label="计划类型" name="scheduleType" rules={[{ required: true, message: '请选择计划类型' }]}>
        <Select
          data-testid="job-create-schedule-type"
          options={SCHEDULE_TYPE_OPTIONS.map((item) => ({ label: item.label, value: item.value }))}
        />
      </Form.Item>

      {scheduleType === 'interval_minutes' ? (
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
      )}
    </>
  );
}
