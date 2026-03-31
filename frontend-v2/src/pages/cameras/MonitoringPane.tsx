import { Form, Space } from 'antd';
import { useCameraCenter } from './useCameraCenter';
import type { MonitorConfigFormValues } from './cameraCenterConfig';
import { MonitoringConfigSection } from './MonitoringConfigSection';
import { MonitoringRulesSection } from './MonitoringRulesSection';
import { TriggerRuleModal } from './TriggerRuleModal';
import { CameraPaneHeader } from './CameraPaneHeader';

export function MonitoringPane() {
  const {
    effectiveSelectedCameraId,
    monitorConfigForm,
    triggerRuleForm,
    monitorConfigData,
    monitorConfigLoading,
    triggerRulesLoading,
    monitorStrategyOptions,
    selectedCameraTriggerRules,
    triggerRuleModalOpen,
    editingTriggerRule,
    debugSignalsJson,
    setDebugSignalsJson,
    debugConsecutiveJson,
    setDebugConsecutiveJson,
    triggerDebugDryRun,
    setTriggerDebugDryRun,
    triggerDebugCaptureOnMatch,
    setTriggerDebugCaptureOnMatch,
    triggerDebugResult,
    liveDebugResult,
    createOrUpdateRuleLoading,
    deleteRuleLoading,
    debugRuleLoading,
    saveMonitorConfigLoading,
    toggleMonitorLoading,
    liveDebugLoading,
    openCreateTriggerRuleModal,
    openEditTriggerRuleModal,
    closeTriggerRuleModal,
    handleSubmitTriggerRule,
    deleteTriggerRule,
    runTriggerRulesDebug,
    runLiveDebug,
    submitMonitorConfig,
    toggleMonitorEnabled,
  } = useCameraCenter();

  const runtimeMode = (Form.useWatch('runtime_mode', monitorConfigForm) ?? 'daemon') as MonitorConfigFormValues['runtime_mode'];
  const scheduleType = (Form.useWatch('schedule_type', monitorConfigForm) ?? 'interval_minutes') as NonNullable<
    MonitorConfigFormValues['schedule_type']
  >;
  const handleStartMonitor = () => toggleMonitorEnabled(true);
  const handleStopMonitor = () => toggleMonitorEnabled(false);
  const handleRunTriggerRulesDebug = () => void runTriggerRulesDebug();
  const handleRunLiveDebug = () => void runLiveDebug();
  const handleSubmitTriggerRuleForm = (values: Parameters<typeof handleSubmitTriggerRule>[0]) =>
    void handleSubmitTriggerRule(values);

  return (
    <Space direction="vertical" size={16} className="stack-full">
      <CameraPaneHeader
        title="监测配置与规则调试"
        description="配置自动监测运行模式、维护触发规则并执行实时调试，统一规则命中入口。"
      />

      <MonitoringConfigSection
        effectiveSelectedCameraId={effectiveSelectedCameraId}
        form={monitorConfigForm}
        monitorConfigData={monitorConfigData}
        monitorConfigLoading={monitorConfigLoading}
        saveMonitorConfigLoading={saveMonitorConfigLoading}
        toggleMonitorLoading={toggleMonitorLoading}
        runtimeMode={runtimeMode}
        scheduleType={scheduleType}
        monitorStrategyOptions={monitorStrategyOptions}
        onSubmit={submitMonitorConfig}
        onStart={handleStartMonitor}
        onStop={handleStopMonitor}
      />

      <MonitoringRulesSection
        effectiveSelectedCameraId={effectiveSelectedCameraId}
        selectedCameraTriggerRules={selectedCameraTriggerRules}
        triggerRulesLoading={triggerRulesLoading}
        debugRuleLoading={debugRuleLoading}
        liveDebugLoading={liveDebugLoading}
        deleteRuleLoading={deleteRuleLoading}
        triggerDebugDryRun={triggerDebugDryRun}
        triggerDebugCaptureOnMatch={triggerDebugCaptureOnMatch}
        debugSignalsJson={debugSignalsJson}
        debugConsecutiveJson={debugConsecutiveJson}
        triggerDebugResult={triggerDebugResult}
        liveDebugResult={liveDebugResult}
        onSetTriggerDebugDryRun={setTriggerDebugDryRun}
        onSetTriggerDebugCaptureOnMatch={setTriggerDebugCaptureOnMatch}
        onSetDebugSignalsJson={setDebugSignalsJson}
        onSetDebugConsecutiveJson={setDebugConsecutiveJson}
        onRunTriggerRulesDebug={handleRunTriggerRulesDebug}
        onRunLiveDebug={handleRunLiveDebug}
        onCreateRule={openCreateTriggerRuleModal}
        onEditRule={openEditTriggerRuleModal}
        onDeleteRule={deleteTriggerRule}
      />

      <TriggerRuleModal
        open={triggerRuleModalOpen}
        isEditing={Boolean(editingTriggerRule)}
        form={triggerRuleForm}
        loading={createOrUpdateRuleLoading}
        onCancel={closeTriggerRuleModal}
        onSubmit={handleSubmitTriggerRuleForm}
      />
    </Space>
  );
}
