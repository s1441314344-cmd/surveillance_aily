import { Button, Descriptions, Empty, Modal } from 'antd';
import type { CameraDiagnostic } from '@/shared/api/cameras';
import { GENERIC_STATE_LABELS, StatusBadge, UNKNOWN_LABELS } from '@/shared/ui';

type DiagnosticsResultModalProps = {
  open: boolean;
  diagnostic: CameraDiagnostic | null;
  onClose: () => void;
};

export function DiagnosticsResultModal({
  open,
  diagnostic,
  onClose,
}: DiagnosticsResultModalProps) {
  return (
    <Modal
      open={open}
      title="摄像头诊断结果"
      onCancel={onClose}
      footer={(
        <Button type="primary" onClick={onClose}>
          关闭
        </Button>
      )}
    >
      {diagnostic ? (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="摄像头">
            {diagnostic.camera_name} ({diagnostic.camera_id})
          </Descriptions.Item>
          <Descriptions.Item label="诊断状态">
            <StatusBadge
              namespace="generic"
              value={diagnostic.success ? 'success' : 'failed'}
              label={diagnostic.success ? GENERIC_STATE_LABELS.success : GENERIC_STATE_LABELS.failed}
            />
          </Descriptions.Item>
          <Descriptions.Item label="协议">
            {diagnostic.protocol ? diagnostic.protocol.toUpperCase() : UNKNOWN_LABELS.generic}
          </Descriptions.Item>
          <Descriptions.Item label="采集模式">{diagnostic.capture_mode || UNKNOWN_LABELS.generic}</Descriptions.Item>
          <Descriptions.Item label="时延">{diagnostic.latency_ms} ms</Descriptions.Item>
          <Descriptions.Item label="图像尺寸">
            {diagnostic.width && diagnostic.height ? `${diagnostic.width} x ${diagnostic.height}` : '无'}
          </Descriptions.Item>
          <Descriptions.Item label="文件大小">
            {diagnostic.frame_size_bytes ? `${diagnostic.frame_size_bytes} bytes` : '无'}
          </Descriptions.Item>
          <Descriptions.Item label="媒体类型">{diagnostic.mime_type ?? '无'}</Descriptions.Item>
          <Descriptions.Item label="脱敏地址">{diagnostic.stream_url_masked ?? '无'}</Descriptions.Item>
          <Descriptions.Item label="诊断快照路径">{diagnostic.snapshot_path ?? '无'}</Descriptions.Item>
          <Descriptions.Item label="错误信息">{diagnostic.error_message ?? '无'}</Descriptions.Item>
          <Descriptions.Item label="诊断时间">{diagnostic.checked_at}</Descriptions.Item>
        </Descriptions>
      ) : (
        <Empty description="暂无诊断结果" />
      )}
    </Modal>
  );
}
