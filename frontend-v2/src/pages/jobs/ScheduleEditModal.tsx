import { Form, Modal, Select } from 'antd';
import type { FormInstance } from 'antd';
import { JobSchedulePrecheckFields } from '@/pages/jobs/JobSchedulePrecheckFields';
import { JobScheduleTimeFields } from '@/pages/jobs/JobScheduleTimeFields';
import type { OptionItem } from '@/pages/jobs/jobsOptionItem';
import type { EditScheduleFormValues } from '@/pages/jobs/types';

type ScheduleEditModalModalProps = {
  open: boolean;
  confirmLoading: boolean;
};

type ScheduleEditModalFormProps = {
  form: FormInstance<EditScheduleFormValues>;
};

type ScheduleEditModalWorkflowProps = {
  scheduleType: EditScheduleFormValues['scheduleType'];
};

type ScheduleEditModalResourcesProps = {
  strategyLoading: boolean;
};

type ScheduleEditModalHandlersProps = {
  onCancel: () => void;
  onSubmit: (values: EditScheduleFormValues) => void | Promise<void>;
  onScheduleTypeChange: (scheduleType: EditScheduleFormValues['scheduleType']) => void;
};

type ScheduleEditModalOptionsProps = {
  scheduleTypeOptions: readonly OptionItem[];
  precheckStrategyOptions: readonly OptionItem[];
};

type ScheduleEditModalProps = {
  modal: ScheduleEditModalModalProps;
  form: ScheduleEditModalFormProps;
  workflow: ScheduleEditModalWorkflowProps;
  resources: ScheduleEditModalResourcesProps;
  handlers: ScheduleEditModalHandlersProps;
  options: ScheduleEditModalOptionsProps;
};

export function ScheduleEditModal({
  modal,
  form,
  workflow,
  resources,
  handlers,
  options,
}: ScheduleEditModalProps) {
  return (
    <Modal
      open={modal.open}
      forceRender
      title="编辑定时计划"
      onCancel={handlers.onCancel}
      onOk={() => form.form.submit()}
      okText="保存"
      cancelText="取消"
      confirmLoading={modal.confirmLoading}
    >
      <Form
        form={form.form}
        layout="vertical"
        onFinish={handlers.onSubmit}
        onValuesChange={(changedValues: Partial<EditScheduleFormValues>) => {
          if (changedValues.scheduleType) {
            handlers.onScheduleTypeChange(changedValues.scheduleType);
          }
        }}
        initialValues={{ scheduleType: 'interval_minutes' }}
      >
        <JobSchedulePrecheckFields
          strategyLoading={resources.strategyLoading}
          strategyPlaceholder="不配置则按计划直接创建任务"
          options={{
            precheckStrategyOptions: options.precheckStrategyOptions,
          }}
        />

        <Form.Item
          label="计划类型"
          name="scheduleType"
          rules={[{ required: true, message: '请选择计划类型' }]}
        >
          <Select options={[...options.scheduleTypeOptions]} />
        </Form.Item>

        <JobScheduleTimeFields scheduleType={workflow.scheduleType} />
      </Form>
    </Modal>
  );
}
