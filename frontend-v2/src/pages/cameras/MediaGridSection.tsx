import { Button, Card, Col, Empty, Image, Popconfirm, Row, Space, Typography } from 'antd';
import type { CameraMedia } from '@/shared/api/configCenter';
import { CAMERA_MEDIA_STATUS_LABELS, CAMERA_MEDIA_TYPE_LABELS } from '@/pages/cameras/cameraCenterConfig';
import { DataStateBlock, StatusBadge, UNKNOWN_LABELS } from '@/shared/ui';

const { Text } = Typography;

type MediaGridSectionProps = {
  hasCameraSelected: boolean;
  mediaLoading: boolean;
  selectedCameraMedia: CameraMedia[];
  thumbnailUrls: Record<string, string>;
  deleteMediaLoading: boolean;
  onPreviewMedia: (item: CameraMedia) => Promise<void>;
  onDeleteMedia: (mediaId: string) => void;
};

function canPreviewMedia(item: CameraMedia) {
  return item.status !== 'recording';
}

function getMediaCreatedAtText(createdAt?: string | null) {
  return createdAt ? new Date(createdAt).toLocaleString() : '-';
}

function renderMediaActions({
  item,
  isRecording,
  deleteMediaLoading,
  onPreviewMedia,
  onDeleteMedia,
}: {
  item: CameraMedia;
  isRecording: boolean;
  deleteMediaLoading: boolean;
  onPreviewMedia: (item: CameraMedia) => Promise<void>;
  onDeleteMedia: (mediaId: string) => void;
}) {
  return (
    <Space wrap>
      <Button
        size="small"
        onClick={(event) => {
          event.stopPropagation();
          void onPreviewMedia(item);
        }}
        disabled={isRecording}
      >
        预览
      </Button>
      <Popconfirm
        title="删除该媒体文件？"
        description="删除后不可恢复。"
        onConfirm={() => onDeleteMedia(item.id)}
        okText="删除"
        cancelText="取消"
      >
        <Button danger size="small" loading={deleteMediaLoading} onClick={(event) => event.stopPropagation()}>
          删除
        </Button>
      </Popconfirm>
    </Space>
  );
}

function getMediaPlaceholderText(item: CameraMedia) {
  return item.status === 'recording' ? '录制中' : '视频预览加载中';
}

function renderMediaThumbnail(item: CameraMedia, thumbnailUrl: string | undefined) {
  if (item.media_type === 'photo') {
    if (thumbnailUrl) {
      return (
        <Image
          src={thumbnailUrl}
          alt={item.original_name}
          preview={false}
          className="camera-media-thumb"
        />
      );
    }

    return (
      <div className="camera-media-placeholder">
        <Text type="secondary">缩略图加载中</Text>
      </div>
    );
  }

  if (thumbnailUrl) {
    return (
      <video
        src={thumbnailUrl}
        muted
        playsInline
        className="camera-media-thumb"
      />
    );
  }

  return (
    <div className="camera-media-placeholder">
      <Text type="secondary">{getMediaPlaceholderText(item)}</Text>
    </div>
  );
}

export function MediaGridSection({
  hasCameraSelected,
  mediaLoading,
  selectedCameraMedia,
  thumbnailUrls,
  deleteMediaLoading,
  onPreviewMedia,
  onDeleteMedia,
}: MediaGridSectionProps) {
  if (!hasCameraSelected) {
    return <Empty description="请选择一个摄像头查看媒体文件" />;
  }

  if (mediaLoading) {
    return (
      <DataStateBlock loading minHeight={220}>
        <></>
      </DataStateBlock>
    );
  }

  if (!selectedCameraMedia.length) {
    return <Empty description="暂无媒体文件，请先执行拍照或录制" />;
  }

  return (
    <Row gutter={[12, 12]}>
      {selectedCameraMedia.map((item) => {
        const thumbnailUrl = thumbnailUrls[item.id];
        const isRecording = item.status === 'recording';

        return (
          <Col xs={24} sm={12} xl={8} key={item.id}>
            <Card
              size="small"
              hoverable
              className="camera-media-card"
              onClick={() => {
                if (canPreviewMedia(item)) {
                  void onPreviewMedia(item);
                }
              }}
            >
              <Space direction="vertical" size={8} className="stack-full">
                {renderMediaThumbnail(item, thumbnailUrl)}

                <Space wrap size={6}>
                  <StatusBadge
                    namespace="cameraMediaType"
                    value={item.media_type}
                    label={CAMERA_MEDIA_TYPE_LABELS[item.media_type] ?? UNKNOWN_LABELS.generic}
                  />
                  <StatusBadge
                    namespace="cameraMediaStatus"
                    value={item.status}
                    label={CAMERA_MEDIA_STATUS_LABELS[item.status] ?? UNKNOWN_LABELS.generic}
                  />
                  {item.related_job_id ? (
                    <StatusBadge
                      namespace="generic"
                      value="info"
                      label={`任务 ${item.related_job_id.slice(0, 8)}`}
                    />
                  ) : null}
                </Space>
                <Text ellipsis>{item.original_name}</Text>
                <Text type="secondary" className="camera-media-meta">
                  {getMediaCreatedAtText(item.created_at)}
                </Text>
                <Text type="secondary" className="camera-media-meta" ellipsis>
                  {item.storage_path}
                </Text>
                {renderMediaActions({
                  item,
                  isRecording,
                  deleteMediaLoading,
                  onPreviewMedia,
                  onDeleteMedia,
                })}
              </Space>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
