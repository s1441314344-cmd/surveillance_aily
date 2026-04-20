import { InboxOutlined } from '@ant-design/icons';
import { Alert, Form, Select, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { OptionItem } from '@/pages/jobs/jobsOptionItem';
import type { UploadFormValues } from '@/pages/jobs/types';

const { Dragger } = Upload;

type JobCreateUploadWorkflowProps = {
  uploadSource: NonNullable<UploadFormValues['uploadSource']>;
};

type JobCreateUploadResourcesProps = {
  cameraLoading: boolean;
};

type JobCreateUploadStateProps = {
  fileList: UploadFile[];
  hasUnsupportedUploadCameraProtocol: boolean;
};

type JobCreateUploadHandlersProps = {
  onFileListChange: (nextFileList: UploadFile[]) => void;
};

type JobCreateUploadOptionsProps = {
  uploadSourceOptions: readonly OptionItem[];
  uploadCameraOptions: readonly OptionItem[];
};

type JobCreateUploadFieldsProps = {
  workflow: JobCreateUploadWorkflowProps;
  resources: JobCreateUploadResourcesProps;
  state: JobCreateUploadStateProps;
  handlers: JobCreateUploadHandlersProps;
  options: JobCreateUploadOptionsProps;
};

export function JobCreateUploadFields({
  workflow,
  resources,
  state,
  handlers,
  options,
}: JobCreateUploadFieldsProps) {
  return (
    <>
      <Form.Item label="上传来源" name="uploadSource">
        <Select data-testid="job-create-upload-source" options={[...options.uploadSourceOptions]} />
      </Form.Item>

      {workflow.uploadSource === 'local_file' ? (
        <Form.Item label="上传图片">
          <Dragger
            multiple
            accept=".jpg,.jpeg,.png,.bmp,.webp"
            fileList={state.fileList}
            beforeUpload={() => false}
            onChange={({ fileList: nextFileList }) => handlers.onFileListChange(nextFileList)}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传单张/多张图片</p>
            <p className="ant-upload-hint">支持 JPG、PNG、JPEG、BMP、WEBP</p>
          </Dragger>
        </Form.Item>
      ) : (
        <>
          <Form.Item
            label="拍照摄像头"
            name="uploadCameraId"
            rules={[{ required: true, message: '请选择拍照摄像头' }]}
          >
            <Select
              data-testid="job-create-upload-camera"
              placeholder="请选择一个可用摄像头"
              loading={resources.cameraLoading}
              options={[...options.uploadCameraOptions]}
            />
          </Form.Item>
          {state.hasUnsupportedUploadCameraProtocol ? (
            <Alert
              type="warning"
              showIcon
              title="当前摄像头协议暂不支持"
              description="V1 拍照上传链路仅支持 RTSP 摄像头。"
            />
          ) : null}
        </>
      )}
    </>
  );
}
