import { Alert, Button, Empty, InputNumber, Space } from 'antd';
import type { CameraMedia } from '@/shared/api/configCenter';

type MediaControlToolbarProps = {
  hasCameraSelected: boolean;
  recordDurationSeconds: number;
  activeRecordingMedia: CameraMedia | null;
  capturePhotoLoading: boolean;
  startRecordingLoading: boolean;
  stopRecordingLoading: boolean;
  onRecordDurationChange: (value: number) => void;
  onCapturePhoto: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
};

export function MediaControlToolbar({
  hasCameraSelected,
  recordDurationSeconds,
  activeRecordingMedia,
  capturePhotoLoading,
  startRecordingLoading,
  stopRecordingLoading,
  onRecordDurationChange,
  onCapturePhoto,
  onStartRecording,
  onStopRecording,
}: MediaControlToolbarProps) {
  if (!hasCameraSelected) {
    return <Empty description="请选择一个摄像头后进行拍照或录制" />;
  }

  return (
    <Space orientation="vertical" size={12} className="stack-full">
      <Alert
        type="info"
        showIcon
        title="支持手动拍照与本地视频录制"
        description="视频默认输出 MP4(H.264, yuv420p) 以兼容主流播放器，媒体文件统一收口到当前页面管理。"
      />

      <Space wrap>
        <Button type="primary" onClick={onCapturePhoto} loading={capturePhotoLoading}>
          手动拍照
        </Button>
        <InputNumber
          min={3}
          max={3600}
          value={recordDurationSeconds}
          onChange={(value) => onRecordDurationChange(Number(value || 30))}
          addonAfter="秒"
        />
        <Button onClick={onStartRecording} disabled={Boolean(activeRecordingMedia)} loading={startRecordingLoading}>
          开始录制
        </Button>
        <Button danger onClick={onStopRecording} disabled={!activeRecordingMedia} loading={stopRecordingLoading}>
          停止录制
        </Button>
      </Space>
    </Space>
  );
}
