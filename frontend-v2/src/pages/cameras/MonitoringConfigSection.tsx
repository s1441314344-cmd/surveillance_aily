import {
  Alert,
  Button,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
} from 'antd';
import type { FormInstance } from 'antd';
import { RUNTIME_MODE_LABELS, RUNTIME_MODE_OPTIONS, SCHEDULE_TYPE_OPTIONS } from './cameraCenterConfig';
import type { MonitorConfigFormValues } from './cameraCenterConfig';
import { SectionCard } from '@/shared/ui';

type MonitorConfigDisplayData = {
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_error?: string | null;
};

type MonitoringConfigSectionProps = {
  effectiveSelectedCameraId: string | null;
  form: FormInstance<MonitorConfigFormValues>;
  monitorConfigData?: MonitorConfigDisplayData | null;
  monitorConfigLoading: boolean;
  saveMonitorConfigLoading: boolean;
  toggleMonitorLoading: boolean;
  runtimeMode: MonitorConfigFormValues['runtime_mode'];
  scheduleType: NonNullable<MonitorConfigFormValues['schedule_type']>;
  onSubmit: (values: MonitorConfigFormValues) => void | Promise<void>;
  onStart: () => void;
  onStop: () => void;
  monitorStrategyOptions: Array<{ label: string; value: string }>;
};

function getScheduleValueLabel(scheduleType: NonNullable<MonitorConfigFormValues['schedule_type']>) {
  return scheduleType === 'daily_time' ? '每日时间(HH:MM)' : '间隔分钟数';
}

function getScheduleValuePlaceholder(scheduleType: NonNullable<MonitorConfigFormValues['schedule_type']>) {
  return scheduleType === 'daily_time' ? '例如 02:30' : '例如 5';
}

function getRuntimeFlags(runtimeMode: MonitorConfigFormValues['runtime_mode']) {
  return {
    showScheduleFields: runtimeMode === 'schedule',
    showManualField: runtimeMode === 'manual',
  };
}

function renderScheduleFields(scheduleType: NonNullable<MonitorConfigFormValues['schedule_type']>) {
  return (
    <>
      <Col xs={24} md={8}>
        <Form.Item
          label="调度类型"
          name="schedule_type"
          rules={[{ required: true, message: '请选择调度类型' }]}
        >
          <Select options={SCHEDULE_TYPE_OPTIONS} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item
          label={getScheduleValueLabel(scheduleType)}
          name="schedule_value"
          rules={[{ required: true, message: '请输入调度值' }]}
        >
          <Input placeholder={getScheduleValuePlaceholder(scheduleType)} />
        </Form.Item>
      </Col>
    </>
  );
}

export function MonitoringConfigSection({
  effectiveSelectedCameraId,
  form,
  monitorConfigData,
  monitorConfigLoading,
  saveMonitorConfigLoading,
  toggleMonitorLoading,
  runtimeMode,
  scheduleType,
  onSubmit,
  onStart,
  onStop,
  monitorStrategyOptions,
}: MonitoringConfigSectionProps) {
  const isMonitorConfigSaving = saveMonitorConfigLoading || monitorConfigLoading;
  const { showScheduleFields, showManualField } = getRuntimeFlags(runtimeMode);

  return (
    <SectionCard title="监测配置">
      {effectiveSelectedCameraId ? (
        <Space direction="vertical" size={12} className="stack-full">
          <Alert
            type="info"
            showIcon
            title="自动监测配置"
            description="这里统一配置自动轮询、手动时段和按计划三种运行模式，页面文案已与后端正式枚举收口。"
          />

          <Form layout="vertical" form={form} onFinish={onSubmit}>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="运行模式" name="runtime_mode" rules={[{ required: true, message: '请选择运行模式' }]}>
                  <Select options={RUNTIME_MODE_OPTIONS} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="监测开关" name="enabled" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="信号策略" name="signal_strategy_id">
                  <Select allowClear showSearch placeholder="选择信号策略" options={monitorStrategyOptions} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  label="监测间隔(秒)"
                  name="monitor_interval_seconds"
                  rules={[{ required: true, message: '请输入监测间隔' }]}
                >
                  <InputNumber min={1} max={3600} className="input-full" />
                </Form.Item>
              </Col>

              {showScheduleFields ? renderScheduleFields(scheduleType) : null}

              {showManualField ? (
                <Col xs={24} md={8}>
                  <Form.Item label="手动有效期" name="manual_until">
                    <Input placeholder="例如 2026-03-25T23:59:59+08:00" />
                  </Form.Item>
                </Col>
              ) : null}
            </Row>

            <Space wrap>
              <Button type="primary" htmlType="submit" loading={isMonitorConfigSaving}>
                保存配置
              </Button>
              <Button onClick={onStart} loading={toggleMonitorLoading}>
                启动监测
              </Button>
              <Button onClick={onStop} loading={toggleMonitorLoading}>
                停止监测
              </Button>
            </Space>
          </Form>

          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="当前模式">{RUNTIME_MODE_LABELS[runtimeMode] ?? runtimeMode}</Descriptions.Item>
            <Descriptions.Item label="最近运行">{monitorConfigData?.last_run_at ?? '暂无'}</Descriptions.Item>
            <Descriptions.Item label="下次运行">{monitorConfigData?.next_run_at ?? '暂无'}</Descriptions.Item>
            <Descriptions.Item label="最近错误">{monitorConfigData?.last_error || '无'}</Descriptions.Item>
          </Descriptions>
        </Space>
      ) : (
        <Empty description="请选择一个摄像头后配置监测参数" />
      )}
    </SectionCard>
  );
}
