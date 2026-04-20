import { Button, Empty, Image, Modal } from 'antd';
import type { CameraMedia } from '@/shared/api/cameras';
import { DataStateBlock } from '@/shared/ui';

type MediaPreviewModalProps = {
  open: boolean;
  media: CameraMedia | null;
  previewUrl: string | null;
  onClose: () => void;
};

export function MediaPreviewModal({
  open,
  media,
  previewUrl,
  onClose,
}: MediaPreviewModalProps) {
  return (
    <Modal
      open={open}
      title={media?.original_name || '媒体预览'}
      onCancel={onClose}
      footer={(
        <Button type="primary" onClick={onClose}>
          关闭
        </Button>
      )}
      width={900}
    >
      {media ? (
        previewUrl ? (
          media.media_type === 'photo' ? (
            <Image src={previewUrl} alt={media.original_name} className="camera-media-preview" />
          ) : (
            <video src={previewUrl} controls className="camera-media-preview" />
          )
        ) : (
          <DataStateBlock loading minHeight={220}>
            <></>
          </DataStateBlock>
        )
      ) : (
        <Empty description="暂无可预览媒体" />
      )}
    </Modal>
  );
}
