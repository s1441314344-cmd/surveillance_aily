import { Space } from 'antd';
import { useCameraCenter } from './useCameraCenter';
import { MediaControlToolbar } from './MediaControlToolbar';
import { MediaGridSection } from './MediaGridSection';
import { MediaPreviewModal } from './MediaPreviewModal';
import { MediaRecordingStatus } from './MediaRecordingStatus';
import { SectionCard } from '@/shared/ui';
import { CameraPaneHeader } from './CameraPaneHeader';

export function MediaPane() {
  const {
    effectiveSelectedCameraId,
    selectedCameraMedia,
    activeRecordingMedia,
    recordDurationSeconds,
    setRecordDurationSeconds,
    recordingCountdown,
    thumbnailUrls,
    previewOpen,
    previewMedia,
    previewUrl,
    closePreview,
    handlePreviewMedia,
    mediaLoading,
    capturePhotoLoading,
    startRecordingLoading,
    stopRecordingLoading,
    deleteMediaLoading,
    captureSelectedCameraPhoto,
    startSelectedCameraRecording,
    stopSelectedCameraRecording,
    deleteMediaItem,
  } = useCameraCenter();

  return (
    <Space orientation="vertical" size={16} className="stack-full">
      <CameraPaneHeader
        title="拍照录制与媒体管理"
        description="手动拍照、视频录制和媒体文件浏览在同一子页集中处理，避免主页面拥挤。"
      />

      <SectionCard title="拍照与录制控制">
        <Space orientation="vertical" size={12} className="stack-full">
          <MediaControlToolbar
            hasCameraSelected={Boolean(effectiveSelectedCameraId)}
            recordDurationSeconds={recordDurationSeconds}
            activeRecordingMedia={activeRecordingMedia}
            capturePhotoLoading={capturePhotoLoading}
            startRecordingLoading={startRecordingLoading}
            stopRecordingLoading={stopRecordingLoading}
            onRecordDurationChange={setRecordDurationSeconds}
            onCapturePhoto={captureSelectedCameraPhoto}
            onStartRecording={startSelectedCameraRecording}
            onStopRecording={stopSelectedCameraRecording}
          />
          {effectiveSelectedCameraId ? (
            <MediaRecordingStatus
              activeRecordingMedia={activeRecordingMedia}
              recordingCountdown={recordingCountdown}
            />
          ) : null}
        </Space>
      </SectionCard>

      <SectionCard title="媒体文件管理">
        <MediaGridSection
          hasCameraSelected={Boolean(effectiveSelectedCameraId)}
          mediaLoading={mediaLoading}
          selectedCameraMedia={selectedCameraMedia}
          thumbnailUrls={thumbnailUrls}
          deleteMediaLoading={deleteMediaLoading}
          onPreviewMedia={handlePreviewMedia}
          onDeleteMedia={deleteMediaItem}
        />
      </SectionCard>

      <MediaPreviewModal
        open={previewOpen}
        media={previewMedia}
        previewUrl={previewUrl}
        onClose={closePreview}
      />
    </Space>
  );
}
