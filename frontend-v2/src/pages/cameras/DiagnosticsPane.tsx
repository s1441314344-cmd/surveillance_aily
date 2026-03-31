import { Space } from 'antd';
import { useCameraCenter } from './useCameraCenter';
import { DiagnosticsResultModal } from '@/pages/cameras/DiagnosticsResultModal';
import { DiagnosticsStatusLogs } from '@/pages/cameras/DiagnosticsStatusLogs';
import { DiagnosticsStatusOverview } from '@/pages/cameras/DiagnosticsStatusOverview';
import { DiagnosticsToolbar } from '@/pages/cameras/DiagnosticsToolbar';
import { CameraPaneHeader } from './CameraPaneHeader';

export function DiagnosticsPane() {
  const {
    activeCamera,
    cameras,
    selectedCameraStatus,
    pagedStatusLogs,
    selectedCameraStatusLogs,
    statusLogsPage,
    setStatusLogsPage,
    statusLogsPageSize,
    statusLoading,
    statusLogsLoading,
    diagnosticModalOpen,
    setDiagnosticModalOpen,
    lastDiagnostic,
    checkCameraLoading,
    diagnoseLoading,
    sweepLoading,
    checkSelectedCamera,
    diagnoseSelectedCamera,
    runSweepAllCameras,
  } = useCameraCenter();
  const hasCameras = Boolean(cameras.length);
  const hasActiveCamera = Boolean(activeCamera);
  const closeDiagnosticModal = () => setDiagnosticModalOpen(false);

  return (
    <Space direction="vertical" size={16} className="stack-full">
      <CameraPaneHeader
        title="连接状态与深度诊断"
        description="查看状态概览、分页日志并执行连接检查或深度诊断，定位设备异常原因。"
      />

      <DiagnosticsToolbar
        hasCameras={hasCameras}
        hasActiveCamera={hasActiveCamera}
        sweepLoading={sweepLoading}
        checkLoading={checkCameraLoading}
        diagnoseLoading={diagnoseLoading}
        onSweepAll={runSweepAllCameras}
        onCheck={checkSelectedCamera}
        onDiagnose={diagnoseSelectedCamera}
      />

      <DiagnosticsStatusOverview
        hasActiveCamera={hasActiveCamera}
        loading={statusLoading}
        status={selectedCameraStatus}
      />

      <DiagnosticsStatusLogs
        hasActiveCamera={hasActiveCamera}
        loading={statusLogsLoading}
        page={statusLogsPage}
        pageSize={statusLogsPageSize}
        total={selectedCameraStatusLogs.length}
        logs={selectedCameraStatusLogs}
        pagedLogs={pagedStatusLogs}
        onPageChange={setStatusLogsPage}
      />

      <DiagnosticsResultModal
        open={diagnosticModalOpen}
        diagnostic={lastDiagnostic}
        onClose={closeDiagnosticModal}
      />
    </Space>
  );
}
