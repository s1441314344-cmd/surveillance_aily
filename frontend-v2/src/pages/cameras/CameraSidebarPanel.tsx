import { Button, Space } from 'antd';
import type { Camera, CameraStatus } from '@/shared/api/cameras';
import { SectionCard } from '@/shared/ui';
import { CameraSidebarPanelFilters } from './CameraSidebarPanelFilters';
import { CameraSidebarPanelList } from './CameraSidebarPanelList';
import { CameraSidebarPanelSummary } from './CameraSidebarPanelSummary';

type CameraSidebarPanelProps = {
  cameras: Camera[];
  visibleCameras: Camera[];
  cameraSearch: string;
  alertOnly: boolean;
  cameraStatusMap: Record<string, CameraStatus | undefined>;
  statusSummary: {
    online: number;
    warning: number;
    offline: number;
    unknown: number;
  };
  camerasLoading: boolean;
  sweepLoading: boolean;
  effectiveSelectedCameraId: string | null;
  onCameraSearchChange: (value: string) => void;
  onAlertOnlyChange: (value: boolean) => void;
  onRunSweepAllCameras: () => void;
  onCreateCamera: () => void;
  onSelectCamera: (cameraId: string) => void;
  onResetFilters: () => void;
};

export function CameraSidebarPanel({
  cameras,
  visibleCameras,
  cameraSearch,
  alertOnly,
  cameraStatusMap,
  statusSummary,
  camerasLoading,
  sweepLoading,
  effectiveSelectedCameraId,
  onCameraSearchChange,
  onAlertOnlyChange,
  onRunSweepAllCameras,
  onCreateCamera,
  onSelectCamera,
  onResetFilters,
}: CameraSidebarPanelProps) {
  return (
    <SectionCard
      title="摄像头列表"
      actions={
        <Space>
          <Button
            size="small"
            loading={sweepLoading}
            disabled={!cameras.length}
            onClick={onRunSweepAllCameras}
            data-testid="cameras-bulk-check-btn"
          >
            全量巡检
          </Button>
          <Button size="small" type="primary" onClick={onCreateCamera}>
            新建摄像头
          </Button>
        </Space>
      }
    >
      <CameraSidebarPanelFilters
        cameraSearch={cameraSearch}
        alertOnly={alertOnly}
        onCameraSearchChange={onCameraSearchChange}
        onAlertOnlyChange={onAlertOnlyChange}
        onResetFilters={onResetFilters}
      />

      <CameraSidebarPanelSummary statusSummary={statusSummary} />

      <CameraSidebarPanelList
        visibleCameras={visibleCameras}
        cameraStatusMap={cameraStatusMap}
        effectiveSelectedCameraId={effectiveSelectedCameraId}
        onSelectCamera={onSelectCamera}
        camerasLoading={camerasLoading}
      />
    </SectionCard>
  );
}
