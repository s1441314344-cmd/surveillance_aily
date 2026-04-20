import { Form, Select } from 'antd';
import { JobSchedulePrecheckFields } from '@/pages/jobs/JobSchedulePrecheckFields';
import { JobScheduleTimeFields } from '@/pages/jobs/JobScheduleTimeFields';
import type { OptionItem } from '@/pages/jobs/jobsOptionItem';
import type { UploadFormValues } from '@/pages/jobs/types';

type JobCreateScheduleWorkflowProps = {
  scheduleType: NonNullable<UploadFormValues['scheduleType']>;
};

type JobCreateScheduleResourcesProps = {
  strategyLoading: boolean;
};

type JobCreateScheduleOptionsProps = {
  scheduleTypeOptions: readonly OptionItem[];
  precheckStrategyOptions: readonly OptionItem[];
};

type JobCreateScheduleFieldsProps = {
  workflow: JobCreateScheduleWorkflowProps;
  resources: JobCreateScheduleResourcesProps;
  options: JobCreateScheduleOptionsProps;
};

export function JobCreateScheduleFields({ workflow, resources, options }: JobCreateScheduleFieldsProps) {
  return (
    <>
      <JobSchedulePrecheckFields
        strategyLoading={resources.strategyLoading}
        strategyPlaceholder="不配置则按计划直接创建任务；配置后先做一次预判命中"
        showThresholdTooltips
        options={{
          precheckStrategyOptions: options.precheckStrategyOptions,
        }}
      />

      <Form.Item label="计划类型" name="scheduleType" rules={[{ required: true, message: '请选择计划类型' }]}>
        <Select
          data-testid="job-create-schedule-type"
          options={[...options.scheduleTypeOptions]}
        />
      </Form.Item>

      <JobScheduleTimeFields scheduleType={workflow.scheduleType} />
    </>
  );
}
