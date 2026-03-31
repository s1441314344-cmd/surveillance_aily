export const CAMERA_SECTIONS = [
  { key: 'devices', label: '设备管理', description: '维护设备台账、参数与抽帧配置' },
  { key: 'monitoring', label: '监测与规则', description: '配置自动监测、信号策略与触发规则' },
  { key: 'media', label: '媒体操作', description: '执行拍照/录制并管理媒体资产' },
  { key: 'diagnostics', label: '诊断状态', description: '查看设备健康、状态日志与深度诊断' },
] as const;

export type CameraSectionKey = (typeof CAMERA_SECTIONS)[number]['key'];

