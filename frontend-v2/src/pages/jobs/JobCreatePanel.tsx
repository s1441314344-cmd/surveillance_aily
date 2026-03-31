import { Alert, Button, Form, Select, Space } from 'antd';
import type { FormInstance } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { Camera, Strategy } from '@/shared/api/configCenter';
import { SectionCard } from '@/shared/ui';
import { JobCreateCameraField } from '@/pages/jobs/JobCreateCameraField';
import { JobCreateScheduleFields } from '@/pages/jobs/JobCreateScheduleFields';
import { JobCreateUploadFields } from '@/pages/jobs/JobCreateUploadFields';
import {
  DEFAULT_FORM_VALUES,
  JOB_TASK_MODE_OPTIONS,
  type UploadFormValues,
} from '@/pages/jobs/types';

type JobCreatePanelProps = {
  form: FormInstance<UploadFormValues>;
  taskMode: UploadFormValues['taskMode'];
  uploadSource: NonNullable<UploadFormValues['uploadSource']>;
  scheduleType: NonNullable<UploadFormValues['scheduleType']>;
  strategies: Strategy[];
  cameras: Camera[];
  strategyLoading: boolean;
  cameraLoading: boolean;
  fileList: UploadFile[];
  hasUnsupportedCameraProtocol: boolean;
  hasUnsupportedUploadCameraProtocol: boolean;
  submitLoading: boolean;
  onSubmit: (values: UploadFormValues) => void | Promise<void>;
  onValuesChange: (changedValues: Partial<UploadFormValues>) => void;
  onFileListChange: (nextFileList: UploadFile[]) => void;
  onResetInput: () => void;
};

function getStrategyOptions(strategies: Strategy[]) {
  return strategies.map((item) => ({
    label: `${item.name} (${item.model_provider}/${item.model_name})`,
    value: item.id,
  }));
}

function getSubmitButtonLabel(
  taskMode: UploadFormValues['taskMode'],
  uploadSource: NonNullable<UploadFormValues['uploadSource']>,
) {
  if (taskMode === 'upload') {
    return uploadSource === 'camera_snapshot' ? '拍照并提交任务' : '提交上传任务';
  }

  if (taskMode === 'camera_once') {
    return '执行摄像头单次任务';
  }

  return '创建定时任务计划';
}

function getCurrentScopeDescription(
  taskMode: UploadFormValues['taskMode'],
  uploadSource: NonNullable<UploadFormValues['uploadSource']>,
) {
  if (taskMode === 'upload') {
    return uploadSource === 'camera_snapshot'
      ? '摄像头拍照上传会先执行即时抓帧，再按文件上传同一链路创建等待中任务并进入异步执行。'
      : '上传图片会先保存输入文件并创建等待中任务，后续由异步执行器完成分析。';
  }

  if (taskMode === 'camera_once') {
    return '摄像头单次任务会先进入队列，再按当前 RTSP 配置抓帧并写入记录。';
  }

  return '定时任务计划支持按分钟间隔和每日固定时间触发，调度进程会按 next_run_at 生成执行任务。';
}

function isUploadTaskMode(taskMode: UploadFormValues['taskMode']) {
  return taskMode === 'upload';
}

function shouldShowUnsupportedProtocolAlert(
  taskMode: UploadFormValues['taskMode'],
  hasUnsupportedCameraProtocol: boolean,
) {
  return !isUploadTaskMode(taskMode) && hasUnsupportedCameraProtocol;
}

export function JobCreatePanel({
  form,
  taskMode,
  uploadSource,
  scheduleType,
  strategies,
  cameras,
  strategyLoading,
  cameraLoading,
  fileList,
  hasUnsupportedCameraProtocol,
  hasUnsupportedUploadCameraProtocol,
  submitLoading,
  onSubmit,
  onValuesChange,
  onFileListChange,
  onResetInput,
}: JobCreatePanelProps) {
  const strategyOptions = getStrategyOptions(strategies);
  const isUploadMode = isUploadTaskMode(taskMode);
  const shouldShowCameraField = !isUploadMode;
  const shouldShowScheduleFields = taskMode === 'camera_schedule';
  const shouldShowUnsupportedCameraAlert = shouldShowUnsupportedProtocolAlert(
    taskMode,
    hasUnsupportedCameraProtocol,
  );
  const submitDisabled = hasUnsupportedCameraProtocol || hasUnsupportedUploadCameraProtocol;
  const handleValuesChange = (changedValues: unknown) => {
    onValuesChange(changedValues as Partial<UploadFormValues>);
  };

  return (
    <SectionCard title="任务创建" subtitle="支持本地上传、摄像头单次和定时计划">
      <Form
        layout="vertical"
        form={form}
        onFinish={onSubmit}
        onValuesChange={handleValuesChange}
        initialValues={DEFAULT_FORM_VALUES}
      >
        <Form.Item label="任务类型" name="taskMode">
          <Select data-testid="job-create-task-mode" options={[...JOB_TASK_MODE_OPTIONS]} />
        </Form.Item>

        <Form.Item
          label="分析策略"
          name="strategyId"
          rules={[{ required: true, message: '请选择分析策略' }]}
        >
          <Select
            data-testid="job-create-strategy"
            placeholder="请选择一个启用中的策略"
            loading={strategyLoading}
            options={strategyOptions}
          />
        </Form.Item>

        {isUploadMode ? (
          <JobCreateUploadFields
            uploadSource={uploadSource}
            fileList={fileList}
            cameras={cameras}
            cameraLoading={cameraLoading}
            hasUnsupportedUploadCameraProtocol={hasUnsupportedUploadCameraProtocol}
            onFileListChange={onFileListChange}
          />
        ) : null}

        {shouldShowCameraField ? (
          <JobCreateCameraField
            cameras={cameras}
            cameraLoading={cameraLoading}
          />
        ) : null}

        {shouldShowUnsupportedCameraAlert ? (
          <Alert
            type="warning"
            showIcon
            title="当前摄像头协议暂不支持"
            description="V1 正式任务链路仅支持 RTSP 摄像头，ONVIF 计划在后续版本扩展。"
          />
        ) : null}

        {shouldShowScheduleFields ? (
          <JobCreateScheduleFields
            scheduleType={scheduleType}
            strategies={strategies}
            strategyLoading={strategyLoading}
          />
        ) : null}

        <Space wrap>
          <Button
            type="primary"
            htmlType="submit"
            disabled={submitDisabled}
            loading={submitLoading}
          >
            {getSubmitButtonLabel(taskMode, uploadSource)}
          </Button>
          <Button onClick={onResetInput}>{isUploadMode ? '清空文件' : '清空当前配置'}</Button>
        </Space>
      </Form>

      <Alert
        type="info"
        showIcon
        title="当前范围"
        description={getCurrentScopeDescription(taskMode, uploadSource)}
      />
    </SectionCard>
  );
}
