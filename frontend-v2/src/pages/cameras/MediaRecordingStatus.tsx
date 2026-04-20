import { Alert, Typography } from 'antd';
import type { CameraMedia } from '@/shared/api/cameras';

const { Text } = Typography;

type MediaRecordingStatusProps = {
  activeRecordingMedia: CameraMedia | null;
  recordingCountdown: number | null;
};

export function MediaRecordingStatus({
  activeRecordingMedia,
  recordingCountdown,
}: MediaRecordingStatusProps) {
  if (activeRecordingMedia) {
    return (
      <Alert
        type="warning"
        showIcon
        title="录制进行中"
        description={
          recordingCountdown !== null
            ? `预计剩余 ${recordingCountdown} 秒，媒体 ID：${activeRecordingMedia.id.slice(0, 8)}`
            : `媒体 ID：${activeRecordingMedia.id.slice(0, 8)}`
        }
      />
    );
  }

  return <Text type="secondary">当前没有进行中的录制任务。</Text>;
}
