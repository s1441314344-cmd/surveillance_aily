import { Form, InputNumber, Select } from 'antd';
import type { OptionItem } from '@/pages/jobs/jobsOptionItem';

type JobSchedulePrecheckFieldsProps = {
  strategyLoading: boolean;
  strategyPlaceholder: string;
  showThresholdTooltips?: boolean;
  options: JobSchedulePrecheckOptionsProps;
};

type JobSchedulePrecheckOptionsProps = {
  precheckStrategyOptions: readonly OptionItem[];
};

export function JobSchedulePrecheckFields({
  strategyLoading,
  strategyPlaceholder,
  showThresholdTooltips = false,
  options,
}: JobSchedulePrecheckFieldsProps) {
  return (
    <>
      <Form.Item label="前置判断策略(可选)" name="precheckStrategyId">
        <Select
          allowClear
          showSearch
          placeholder={strategyPlaceholder}
          loading={strategyLoading}
          options={[...options.precheckStrategyOptions]}
          optionFilterProp="label"
        />
      </Form.Item>

      <Form.Item noStyle dependencies={['precheckStrategyId']}>
        {({ getFieldValue }) =>
          getFieldValue('precheckStrategyId') ? (
            <>
              <Form.Item
                label="人员硬门控阈值"
                name="precheckPersonThreshold"
                tooltip={showThresholdTooltips ? 'person 置信度低于该值将直接跳过模型调用' : undefined}
                rules={[{ type: 'number', min: 0, max: 1, message: '请输入 0-1 之间的数值' }]}
              >
                <InputNumber min={0} max={1} step={0.05} className="input-full" />
              </Form.Item>
              <Form.Item
                label="火/漏软门控阈值"
                name="precheckSoftNegativeThreshold"
                tooltip={
                  showThresholdTooltips ? 'fire/leak 低于该值且明确为负样本时，跳过模型调用' : undefined
                }
                rules={[{ type: 'number', min: 0, max: 1, message: '请输入 0-1 之间的数值' }]}
              >
                <InputNumber min={0} max={1} step={0.05} className="input-full" />
              </Form.Item>
              <Form.Item
                label="本地信号有效期(秒)"
                name="precheckStateTtlSeconds"
                tooltip={showThresholdTooltips ? '超过该时长的本地信号不会参与门控判断' : undefined}
                rules={[{ type: 'number', min: 1, max: 3600, message: '请输入 1-3600 之间的秒数' }]}
              >
                <InputNumber min={1} max={3600} step={10} className="input-full" />
              </Form.Item>
            </>
          ) : null
        }
      </Form.Item>
    </>
  );
}
