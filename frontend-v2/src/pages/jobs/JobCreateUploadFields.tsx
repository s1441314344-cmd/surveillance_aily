import { InboxOutlined } from '@ant-design/icons';
import { Alert, Form, Select, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { Camera } from '@/shared/api/configCenter';
import { JOB_UPLOAD_SOURCE_OPTIONS, type UploadFormValues } from '@/pages/jobs/types';

const { Dragger } = Upload;

type JobCreateUploadFieldsProps = {
  uploadSource: NonNullable<UploadFormValues['uploadSource']>;
  fileList: UploadFile[];
  cameras: Camera[];
  cameraLoading: boolean;
  hasUnsupportedUploadCameraProtocol: boolean;
  onFileListChange: (nextFileList: UploadFile[]) => void;
};

export function JobCreateUploadFields({
  uploadSource,
  fileList,
  cameras,
  cameraLoading,
  hasUnsupportedUploadCameraProtocol,
  onFileListChange,
}: JobCreateUploadFieldsProps) {
  return (
    <>
      <Form.Item label="上传来源" name="uploadSource">
        <Select
          data-testid="job-create-upload-source"
          options={[...JOB_UPLOAD_SOURCE_OPTIONS]}
        />
      </Form.Item>

      {uploadSource === 'local_file' ? (
        <Form.Item label="上传图片">
          <Dragger
            multiple
            accept=".jpg,.jpeg,.png,.bmp,.webp"
            fileList={fileList}
            beforeUpload={() => false}
            onChange={({ fileList: nextFileList }) => onFileListChange(nextFileList)}
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
              loading={cameraLoading}
              options={cameras.map((item) => ({
                label: `${item.name} [${item.protocol.toUpperCase()}] (${item.location || item.rtsp_url || '未配置位置'})`,
                value: item.id,
              }))}
            />
          </Form.Item>
          {hasUnsupportedUploadCameraProtocol ? (
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
