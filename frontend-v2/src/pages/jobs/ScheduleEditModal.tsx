import { Form, Input, InputNumber, Modal, Select } from 'antd';
import type { FormInstance } from 'antd';
import { SCHEDULE_TYPE_OPTIONS } from '@/shared/ui';
import type { Strategy } from '@/shared/api/configCenter';
import type { EditScheduleFormValues } from '@/pages/jobs/types';

type ScheduleEditModalProps = {
  open: boolean;
  form: FormInstance<EditScheduleFormValues>;
  scheduleType: EditScheduleFormValues['scheduleType'];
  strategies: Strategy[];
  strategyLoading: boolean;
  confirmLoading: boolean;
  onCancel: () => void;
  onSubmit: (values: EditScheduleFormValues) => void | Promise<void>;
  onScheduleTypeChange: (scheduleType: EditScheduleFormValues['scheduleType']) => void;
};

export function ScheduleEditModal({
  open,
  form,
  scheduleType,
  strategies,
  strategyLoading,
  confirmLoading,
  onCancel,
  onSubmit,
  onScheduleTypeChange,
}: ScheduleEditModalProps) {
  const strategyOptions = strategies.map((item) => ({
    label: `${item.name} (${item.model_provider}/${item.model_name})`,
    value: item.id,
  }));

  return (
    <Modal
      open={open}
      forceRender
      title="编辑定时计划"
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={confirmLoading}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        onValuesChange={(changedValues: Partial<EditScheduleFormValues>) => {
          if (changedValues.scheduleType) {
            onScheduleTypeChange(changedValues.scheduleType);
          }
        }}
        initialValues={{ scheduleType: 'interval_minutes' }}
      >
        <Form.Item label="前置判断策略(可选)" name="precheckStrategyId">
          <Select
            allowClear
            showSearch
            placeholder="不配置则按计划直接创建任务"
            loading={strategyLoading}
            options={strategyOptions}
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item
          label="计划类型"
          name="scheduleType"
          rules={[{ required: true, message: '请选择计划类型' }]}
        >
          <Select
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
      </Form>
    </Modal>
  );
}
