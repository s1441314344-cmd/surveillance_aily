export const JOB_STATUS_LABELS: Record<string, string> = {
  queued: '等待中',
  running: '处理中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

export const JOB_TYPE_LABELS: Record<string, string> = {
  upload_single: '上传单张',
  upload_batch: '上传批量',
  camera_once: '摄像头单次',
  camera_schedule: '摄像头定时',
};

export const RESULT_STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  failed: '失败',
  schema_invalid: '结构化异常',
};

export const RESULT_STATUS_OPTIONS = [
  { label: RESULT_STATUS_LABELS.completed, value: 'completed' },
  { label: RESULT_STATUS_LABELS.failed, value: 'failed' },
  { label: RESULT_STATUS_LABELS.schema_invalid, value: 'schema_invalid' },
] as const;

export const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  unreviewed: '未复核',
  correct: '人工判正',
  incorrect: '人工判错',
};

export const FEEDBACK_STATUS_OPTIONS = [
  { label: FEEDBACK_STATUS_LABELS.unreviewed, value: 'unreviewed' },
  { label: FEEDBACK_STATUS_LABELS.correct, value: 'correct' },
  { label: FEEDBACK_STATUS_LABELS.incorrect, value: 'incorrect' },
] as const;

export const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  active: '启用',
  paused: '暂停',
};

export const SCHEDULE_STATUS_OPTIONS = [
  { label: SCHEDULE_STATUS_LABELS.active, value: 'active' },
  { label: SCHEDULE_STATUS_LABELS.paused, value: 'paused' },
] as const;

export const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  interval_minutes: '按分钟间隔执行',
  daily_time: '每日固定时间',
};

export const SCHEDULE_TYPE_OPTIONS = [
  { label: SCHEDULE_TYPE_LABELS.interval_minutes, value: 'interval_minutes' },
  { label: SCHEDULE_TYPE_LABELS.daily_time, value: 'daily_time' },
] as const;

export const ACTIVE_STATUS_LABELS: Record<string, string> = {
  active: '启用',
  inactive: '停用',
};

export const ACTIVE_STATUS_OPTIONS = [
  { label: ACTIVE_STATUS_LABELS.active, value: 'active' },
  { label: ACTIVE_STATUS_LABELS.inactive, value: 'inactive' },
] as const;

export const TRIGGER_MODE_LABELS: Record<string, string> = {
  manual: '手动触发',
  schedule: '定时触发',
};

export const TRIGGER_MODE_FILTER_OPTIONS = [
  { label: '全部触发', value: 'all' },
  { label: TRIGGER_MODE_LABELS.manual, value: 'manual' },
  { label: TRIGGER_MODE_LABELS.schedule, value: 'schedule' },
] as const;

export const ANOMALY_TYPE_LABELS: Record<string, string> = {
  schema_invalid: '结构化异常',
  task_failed: '任务失败',
  feedback_incorrect: '人工判错',
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  upload: '上传',
  camera: '摄像头',
};

export const RESULT_FORMAT_LABELS: Record<string, string> = {
  json_schema: 'JSON Schema',
  json_object: 'JSON 对象',
  auto: '自动',
  text: '文本',
};

export const RESULT_FORMAT_OPTIONS = [
  { label: 'JSON Schema（强约束）', value: 'json_schema' },
  { label: 'JSON 对象（弱约束）', value: 'json_object' },
  { label: '自动（优先 JSON，失败回文本）', value: 'auto' },
  { label: '文本（纯文本）', value: 'text' },
] as const;

export const RESULT_FORMAT_DEBUG_OPTIONS = [
  { label: `${RESULT_FORMAT_LABELS.text}(text)`, value: 'text' },
  { label: `${RESULT_FORMAT_LABELS.json_object}(json_object)`, value: 'json_object' },
  { label: `${RESULT_FORMAT_LABELS.json_schema}(json_schema)`, value: 'json_schema' },
  { label: `${RESULT_FORMAT_LABELS.auto}(auto)`, value: 'auto' },
] as const;

export const ALERT_STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  acknowledged: '已确认',
  resolved: '已处理',
};

export const ALERT_STATUS_OPTIONS = [
  { label: ALERT_STATUS_LABELS.open, value: 'open' },
  { label: ALERT_STATUS_LABELS.acknowledged, value: 'acknowledged' },
  { label: ALERT_STATUS_LABELS.resolved, value: 'resolved' },
] as const;

export const ALERT_SEVERITY_LABELS: Record<string, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
};

export const ALERT_SEVERITY_OPTIONS = [
  { label: ALERT_SEVERITY_LABELS.critical, value: 'critical' },
  { label: ALERT_SEVERITY_LABELS.high, value: 'high' },
  { label: ALERT_SEVERITY_LABELS.medium, value: 'medium' },
  { label: ALERT_SEVERITY_LABELS.low, value: 'low' },
] as const;

export const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  'alert.created': '告警创建',
  'alert.updated': '告警更新',
};

export const UNKNOWN_LABELS = {
  generic: '未知',
  camera: '未知摄像头',
  strategy: '未知策略',
  provider: '未知提供方',
  model: '未知模型',
  event: '未知事件',
} as const;

export const GENERIC_STATE_LABELS = {
  success: '成功',
  failed: '失败',
  enabled: '启用',
  disabled: '停用',
} as const;

export const USER_ACTIVE_BADGE_LABELS = {
  enabled: '启用中',
  disabled: '已停用',
} as const;

export const FILTER_ALL_LABELS = {
  status: '全部状态',
  strategy: '全部策略',
  camera: '全部摄像头',
  plan: '全部计划',
  feedback: '全部反馈',
  result: '全部结果',
  severity: '全部级别',
  anomaly: '全部异常类型',
  provider: '全部模型提供方',
  taskType: '全部任务类型',
  trigger: '全部触发',
} as const;
