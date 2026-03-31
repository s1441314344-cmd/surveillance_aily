import { Space, Typography } from 'antd';
import type { Camera, CameraStatus } from '@/shared/api/configCenter';
import { CAMERA_ALERT_STATUS_LABELS, CAMERA_CONNECTION_LABELS } from './cameraCenterConfig';
import { DataStateBlock, StatusBadge, UNKNOWN_LABELS } from '@/shared/ui';

const { Text } = Typography;

type CameraSidebarPanelListProps = {
  visibleCameras: Camera[];
  cameraStatusMap: Record<string, CameraStatus | undefined>;
  effectiveSelectedCameraId: string | null;
  onSelectCamera: (cameraId: string) => void;
  camerasLoading: boolean;
};

export function CameraSidebarPanelList({
  visibleCameras,
  cameraStatusMap,
  effectiveSelectedCameraId,
  onSelectCamera,
  camerasLoading,
}: CameraSidebarPanelListProps) {
  if (camerasLoading) {
    return (
      <DataStateBlock loading minHeight={240}>
        <></>
      </DataStateBlock>
    );
  }

  if (!visibleCameras.length) {
    return (
      <DataStateBlock empty emptyDescription="暂无摄像头配置">
        <></>
      </DataStateBlock>
    );
  }

  return (
    <div className="selection-rail">
      {visibleCameras.map((camera) => {
        const status = cameraStatusMap[camera.id];
        const connectionStatus = status?.connection_status ?? 'unknown';
        const alertStatus = status?.alert_status ?? 'normal';
        const selected = camera.id === effectiveSelectedCameraId;
        return (
          <button
            key={camera.id}
            type="button"
            className={`selection-rail__item camera-rail-card ${selected ? 'selection-rail__item--active camera-rail-card--active' : ''}`}
            aria-pressed={selected}
            onClick={() => onSelectCamera(camera.id)}
            data-testid={`camera-card-${camera.id}`}
          >
            <div className="selection-rail__header">
              <Text strong>{camera.name}</Text>
              <Space wrap align="center">
                <StatusBadge
                  namespace="cameraConnection"
                  value={connectionStatus}
                  label={CAMERA_CONNECTION_LABELS[connectionStatus] ?? UNKNOWN_LABELS.generic}
                />
                {alertStatus !== 'normal' ? (
                  <StatusBadge
                    namespace="cameraAlert"
                    value={alertStatus}
                    label={CAMERA_ALERT_STATUS_LABELS[alertStatus] ?? UNKNOWN_LABELS.generic}
                  />
                ) : null}
              </Space>
            </div>
            <div className="selection-rail__body">
              <Text type="secondary" className="text-line">
                {camera.location || '未设置位置'}
              </Text>
              <Text type="secondary" className="text-line">
                {camera.rtsp_url || camera.ip_address || '未配置地址'}
              </Text>
            </div>
          </button>
        );
      })}
    </div>
  );
}
