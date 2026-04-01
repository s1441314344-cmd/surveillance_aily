import {
  App,
  Alert,
  Button,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import type { FormInstance } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RUNTIME_MODE_LABELS, RUNTIME_MODE_OPTIONS, SCHEDULE_TYPE_OPTIONS } from './cameraCenterConfig';
import type { MonitorConfigFormValues } from './cameraCenterConfig';
import { SectionCard } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api/errors';
import { captureCameraPhoto, fetchCameraMediaFile } from '@/shared/api/configCenter';

const { Text } = Typography;

type MonitorConfigDisplayData = {
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_error?: string | null;
  roi_enabled?: boolean;
  roi_shape?: 'rect' | 'polygon' | string | null;
  roi_x?: number | null;
  roi_y?: number | null;
  roi_width?: number | null;
  roi_height?: number | null;
  roi_points?: Array<{ x: number; y: number }> | null;
};

type MonitoringConfigSectionProps = {
  effectiveSelectedCameraId: string | null;
  form: FormInstance<MonitorConfigFormValues>;
  monitorConfigData?: MonitorConfigDisplayData | null;
  monitorConfigLoading: boolean;
  saveMonitorConfigLoading: boolean;
  toggleMonitorLoading: boolean;
  runtimeMode: MonitorConfigFormValues['runtime_mode'];
  scheduleType: NonNullable<MonitorConfigFormValues['schedule_type']>;
  onSubmit: (values: MonitorConfigFormValues) => void | Promise<void>;
  onStart: () => void;
  onStop: () => void;
  monitorStrategyOptions: Array<{ label: string; value: string }>;
};

function getScheduleValueLabel(scheduleType: NonNullable<MonitorConfigFormValues['schedule_type']>) {
  return scheduleType === 'daily_time' ? '每日时间(HH:MM)' : '间隔分钟数';
}

function getScheduleValuePlaceholder(scheduleType: NonNullable<MonitorConfigFormValues['schedule_type']>) {
  return scheduleType === 'daily_time' ? '例如 02:30' : '例如 5';
}

function getRuntimeFlags(runtimeMode: MonitorConfigFormValues['runtime_mode']) {
  return {
    showScheduleFields: runtimeMode === 'schedule',
    showManualField: runtimeMode === 'manual',
  };
}

function renderScheduleFields(scheduleType: NonNullable<MonitorConfigFormValues['schedule_type']>) {
  return (
    <>
      <Col xs={24} md={8}>
        <Form.Item
          label="调度类型"
          name="schedule_type"
          rules={[{ required: true, message: '请选择调度类型' }]}
        >
          <Select options={SCHEDULE_TYPE_OPTIONS} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item
          label={getScheduleValueLabel(scheduleType)}
          name="schedule_value"
          rules={[{ required: true, message: '请输入调度值' }]}
        >
          <Input placeholder={getScheduleValuePlaceholder(scheduleType)} />
        </Form.Item>
      </Col>
    </>
  );
}

type RoiRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RoiPoint = {
  x: number;
  y: number;
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeRoi(rect: RoiRect): RoiRect {
  const x = clamp01(rect.x);
  const y = clamp01(rect.y);
  let width = Math.max(0.01, clamp01(rect.width));
  let height = Math.max(0.01, clamp01(rect.height));
  if (x + width > 1) {
    width = Math.max(0.01, 1 - x);
  }
  if (y + height > 1) {
    height = Math.max(0.01, 1 - y);
  }
  return { x, y, width, height };
}

function normalizePoint(point: RoiPoint): RoiPoint {
  return {
    x: Number(clamp01(point.x).toFixed(4)),
    y: Number(clamp01(point.y).toFixed(4)),
  };
}

function normalizePolygonPoints(points: RoiPoint[]): RoiPoint[] {
  return points.map(normalizePoint);
}

function formatRuntimeTime(value?: string | null): string {
  if (!value) {
    return '暂无';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

function formatMonitorError(value?: string | null): string {
  if (!value) {
    return '无';
  }
  if (value.includes('local detector gate blocked')) {
    const personMatch = value.match(/person<([0-9.]+)/i);
    if (personMatch?.[1]) {
      return `本地严格门控已阻断：人员置信度低于阈值 ${personMatch[1]}`;
    }
    return '本地严格门控已阻断：本地检测未命中要求信号';
  }
  if (value.includes('Local gate blocked (strict)')) {
    return value.replace('Local gate blocked (strict):', '本地严格门控已阻断：');
  }
  return value;
}

function formatRect(rect: { x: number; y: number; width: number; height: number }) {
  return `x=${rect.x.toFixed(3)}, y=${rect.y.toFixed(3)}, w=${rect.width.toFixed(3)}, h=${rect.height.toFixed(3)}`;
}

function computePolygonBounds(points: Array<{ x: number; y: number }>) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function formatPointList(points: Array<{ x: number; y: number }>, limit = 4) {
  if (!points.length) {
    return '无';
  }
  const shown = points.slice(0, limit).map((point) => `(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`);
  return points.length > limit ? `${shown.join('、')} …` : shown.join('、');
}

export function MonitoringConfigSection({
  effectiveSelectedCameraId,
  form,
  monitorConfigData,
  monitorConfigLoading,
  saveMonitorConfigLoading,
  toggleMonitorLoading,
  runtimeMode,
  scheduleType,
  onSubmit,
  onStart,
  onStop,
  monitorStrategyOptions,
}: MonitoringConfigSectionProps) {
  const { message } = App.useApp();
  const roiEnabled = Form.useWatch('roi_enabled', form) ?? false;
  const roiShape = Form.useWatch('roi_shape', form) === 'polygon' ? 'polygon' : 'rect';
  const roiX = Form.useWatch('roi_x', form);
  const roiY = Form.useWatch('roi_y', form);
  const roiWidth = Form.useWatch('roi_width', form);
  const roiHeight = Form.useWatch('roi_height', form);
  const roiPoints = Form.useWatch('roi_points', form);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);
  const [draftCurrent, setDraftCurrent] = useState<{ x: number; y: number } | null>(null);
  const [polygonDraftPoints, setPolygonDraftPoints] = useState<RoiPoint[]>([]);
  const [isPolygonDrawing, setIsPolygonDrawing] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const polygonDraftPointsRef = useRef<RoiPoint[]>([]);
  const isPolygonDrawingRef = useRef(false);
  const polygonPointerIdRef = useRef<number | null>(null);

  const captureRoiSnapshotMutation = useMutation({
    mutationFn: async (cameraId: string) => {
      const photo = await captureCameraPhoto(cameraId, { sourceKind: 'roi_config' });
      if (!photo.success || !photo.media?.id) {
        throw new Error(photo.error_message || '拍照失败');
      }
      const blob = await fetchCameraMediaFile(cameraId, photo.media.id);
      return URL.createObjectURL(blob);
    },
    onSuccess: (url) => {
      setSnapshotUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return url;
      });
      message.success('取景图片已加载，可拖拽圈选分析区域');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '取景拍照失败'));
    },
  });

  useEffect(() => {
    return () => {
      if (snapshotUrl) {
        URL.revokeObjectURL(snapshotUrl);
      }
    };
  }, [snapshotUrl]);

  useEffect(() => {
    setSnapshotUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setDraftStart(null);
    setDraftCurrent(null);
    polygonDraftPointsRef.current = [];
    setPolygonDraftPoints([]);
    isPolygonDrawingRef.current = false;
    setIsPolygonDrawing(false);
  }, [effectiveSelectedCameraId]);

  useEffect(() => {
    setDraftStart(null);
    setDraftCurrent(null);
    polygonDraftPointsRef.current = [];
    setPolygonDraftPoints([]);
    isPolygonDrawingRef.current = false;
    setIsPolygonDrawing(false);
    if (!roiEnabled) {
      return;
    }
    if (roiShape === 'polygon') {
      form.setFieldsValue({
        roi_x: undefined,
        roi_y: undefined,
        roi_width: undefined,
        roi_height: undefined,
      });
      return;
    }
    form.setFieldsValue({
      roi_points: undefined,
    });
  }, [form, roiEnabled, roiShape]);

  const persistedRoi = useMemo<RoiRect | null>(() => {
    if (!roiEnabled || roiShape !== 'rect') {
      return null;
    }
    const values = [roiX, roiY, roiWidth, roiHeight];
    if (values.some((item) => typeof item !== 'number')) {
      return null;
    }
    return normalizeRoi({
      x: Number(roiX),
      y: Number(roiY),
      width: Number(roiWidth),
      height: Number(roiHeight),
    });
  }, [roiEnabled, roiShape, roiX, roiY, roiWidth, roiHeight]);

  const persistedPolygon = useMemo<RoiPoint[] | null>(() => {
    if (!roiEnabled || roiShape !== 'polygon' || !Array.isArray(roiPoints)) {
      return null;
    }
    const parsed = roiPoints
      .map((point) => ({
        x: Number((point as RoiPoint).x),
        y: Number((point as RoiPoint).y),
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .map(normalizePoint);
    if (parsed.length < 3) {
      return null;
    }
    return parsed;
  }, [roiEnabled, roiShape, roiPoints]);

  const drawingRoi = useMemo<RoiRect | null>(() => {
    if (roiShape !== 'rect') {
      return null;
    }
    if (!draftStart || !draftCurrent) {
      return null;
    }
    return normalizeRoi({
      x: Math.min(draftStart.x, draftCurrent.x),
      y: Math.min(draftStart.y, draftCurrent.y),
      width: Math.abs(draftCurrent.x - draftStart.x),
      height: Math.abs(draftCurrent.y - draftStart.y),
    });
  }, [draftCurrent, draftStart, roiShape]);

  const activeRoi = drawingRoi || persistedRoi;
  const activePolygon = polygonDraftPoints.length > 0 ? polygonDraftPoints : persistedPolygon;
  const summaryPreviewUrl = snapshotUrl ?? null;
  const summaryRoiEnabled = roiEnabled || Boolean(monitorConfigData?.roi_enabled);
  const summaryRoiShape = summaryRoiEnabled
    ? roiShape === 'polygon' || monitorConfigData?.roi_shape === 'polygon'
      ? 'polygon'
      : 'rect'
    : 'rect';
  const summaryPolygonPoints = Array.isArray(roiPoints) && roiPoints.length > 0
    ? roiPoints
    : Array.isArray(monitorConfigData?.roi_points)
      ? monitorConfigData?.roi_points
      : [];
  const summaryRect = persistedRoi ?? (
    typeof monitorConfigData?.roi_x === 'number' &&
    typeof monitorConfigData?.roi_y === 'number' &&
    typeof monitorConfigData?.roi_width === 'number' &&
    typeof monitorConfigData?.roi_height === 'number'
      ? {
          x: monitorConfigData.roi_x,
          y: monitorConfigData.roi_y,
          width: monitorConfigData.roi_width,
          height: monitorConfigData.roi_height,
        }
      : null
  );

  const pointFromMouse = (event: React.MouseEvent<HTMLDivElement>) => {
    const element = previewRef.current;
    if (!element) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01((event.clientY - rect.top) / rect.height);
    return { x, y };
  };

  const handleRoiMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!snapshotUrl || roiShape !== 'rect') {
      return;
    }
    const point = pointFromMouse(event);
    if (!point) {
      return;
    }
    setDraftStart(point);
    setDraftCurrent(point);
  };

  const handleRoiMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (roiShape !== 'rect') {
      return;
    }
    if (!draftStart) {
      return;
    }
    const point = pointFromMouse(event);
    if (!point) {
      return;
    }
    setDraftCurrent(point);
  };

  const commitDraftRoi = () => {
    if (roiShape !== 'rect') {
      return;
    }
    if (!drawingRoi) {
      setDraftStart(null);
      setDraftCurrent(null);
      return;
    }
    form.setFieldsValue({
      roi_enabled: true,
      roi_x: Number(drawingRoi.x.toFixed(4)),
      roi_y: Number(drawingRoi.y.toFixed(4)),
      roi_width: Number(drawingRoi.width.toFixed(4)),
      roi_height: Number(drawingRoi.height.toFixed(4)),
      roi_points: undefined,
    });
    setDraftStart(null);
    setDraftCurrent(null);
  };

  const clearRoi = () => {
    form.setFieldsValue({
      roi_enabled: false,
      roi_shape: 'rect',
      roi_x: undefined,
      roi_y: undefined,
      roi_width: undefined,
      roi_height: undefined,
      roi_points: undefined,
    });
    setPolygonDraftPoints([]);
    polygonDraftPointsRef.current = [];
    isPolygonDrawingRef.current = false;
    setIsPolygonDrawing(false);
  };

  const pushPolygonPoint = (point: RoiPoint, force = false) => {
    const normalized = normalizePoint(point);
    const prev = polygonDraftPointsRef.current;
    if (prev.length === 0) {
      polygonDraftPointsRef.current = [normalized];
      setPolygonDraftPoints([normalized]);
      return;
    }
    const last = prev[prev.length - 1];
    const dx = normalized.x - last.x;
    const dy = normalized.y - last.y;
    // 控制采样密度，避免拖拽时点数爆炸；结束时强制补最后一个点
    if (!force && Math.sqrt(dx * dx + dy * dy) < 0.004) {
      return;
    }
    const next = [...prev, normalized];
    polygonDraftPointsRef.current = next;
    setPolygonDraftPoints(next);
  };

  const startPolygonDrawing = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!snapshotUrl || roiShape !== 'polygon') {
      return;
    }
    const point = pointFromMouse(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    setIsPolygonDrawing(true);
    isPolygonDrawingRef.current = true;
    const normalized = [normalizePoint(point)];
    polygonDraftPointsRef.current = normalized;
    setPolygonDraftPoints(normalized);
  };

  const updatePolygonDrawing = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPolygonDrawingRef.current || roiShape !== 'polygon') {
      return;
    }
    const point = pointFromMouse(event);
    if (!point) {
      return;
    }
    pushPolygonPoint(point);
  };

  const clearPolygonDraft = () => {
    polygonDraftPointsRef.current = [];
    setPolygonDraftPoints([]);
    isPolygonDrawingRef.current = false;
    setIsPolygonDrawing(false);
  };

  const finishPolygonDrawing = (event?: React.MouseEvent<HTMLDivElement>) => {
    if (!isPolygonDrawingRef.current || roiShape !== 'polygon') {
      return;
    }
    if (event) {
      const point = pointFromMouse(event);
      if (point) {
        pushPolygonPoint(point, true);
      }
    }
    isPolygonDrawingRef.current = false;
    setIsPolygonDrawing(false);
    const normalized = normalizePolygonPoints(polygonDraftPointsRef.current);
    if (normalized.length < 3) {
      message.warning('圈选区域过小，请按住鼠标重新圈选');
      polygonDraftPointsRef.current = [];
      setPolygonDraftPoints([]);
      return;
    }
    form.setFieldsValue({
      roi_enabled: true,
      roi_shape: 'polygon',
      roi_points: normalized,
      roi_x: undefined,
      roi_y: undefined,
      roi_width: undefined,
      roi_height: undefined,
    });
    message.success('不规则 ROI 已写入表单，点击“保存配置”后生效');
    polygonDraftPointsRef.current = [];
    setPolygonDraftPoints([]);
  };

  const startPolygonDrawingPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!snapshotUrl || roiShape !== 'polygon') {
      return;
    }
    const point = pointFromMouse(event as unknown as React.MouseEvent<HTMLDivElement>);
    if (!point) {
      return;
    }
    event.preventDefault();
    polygonPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPolygonDrawing(true);
    isPolygonDrawingRef.current = true;
    const normalized = [normalizePoint(point)];
    polygonDraftPointsRef.current = normalized;
    setPolygonDraftPoints(normalized);
  };

  const updatePolygonDrawingPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (roiShape !== 'polygon' || !isPolygonDrawingRef.current) {
      return;
    }
    if (polygonPointerIdRef.current !== null && event.pointerId !== polygonPointerIdRef.current) {
      return;
    }
    const point = pointFromMouse(event as unknown as React.MouseEvent<HTMLDivElement>);
    if (!point) {
      return;
    }
    pushPolygonPoint(point);
  };

  const finishPolygonDrawingPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (polygonPointerIdRef.current !== null && event.pointerId !== polygonPointerIdRef.current) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    polygonPointerIdRef.current = null;
    finishPolygonDrawing(event as unknown as React.MouseEvent<HTMLDivElement>);
  };

  const handleRoiMouseLeave = () => {
    commitDraftRoi();
    finishPolygonDrawing();
  };

  const handleSubmitForm = async () => {
    const fullValues = form.getFieldsValue(true) as MonitorConfigFormValues;
    await onSubmit({
      ...fullValues,
      roi_shape: fullValues.roi_shape === 'polygon' ? 'polygon' : 'rect',
      roi_enabled: Boolean(fullValues.roi_enabled),
    });
  };

  const isMonitorConfigSaving = saveMonitorConfigLoading || monitorConfigLoading;
  const { showScheduleFields, showManualField } = getRuntimeFlags(runtimeMode);

  return (
    <SectionCard title="监测配置">
      {effectiveSelectedCameraId ? (
        <Space direction="vertical" size={12} className="stack-full">
          <Alert
            type="info"
            showIcon
            title="自动监测配置"
            description="这里统一配置自动轮询、手动时段和按计划三种运行模式；开启“本地严格门控”后，本地状态未命中时不会触发大模型调用。"
          />

          <Form layout="vertical" form={form} onFinish={handleSubmitForm}>
            <Row gutter={16}>
              <Col xs={24} md={6}>
                <Form.Item label="运行模式" name="runtime_mode" rules={[{ required: true, message: '请选择运行模式' }]}>
                  <Select options={RUNTIME_MODE_OPTIONS} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="监测开关" name="enabled" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="本地严格门控" name="strict_local_gate" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="信号策略" name="signal_strategy_id">
                  <Select allowClear showSearch placeholder="选择信号策略" options={monitorStrategyOptions} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  label="监测间隔(秒)"
                  name="monitor_interval_seconds"
                  rules={[{ required: true, message: '请输入监测间隔' }]}
                >
                  <InputNumber min={1} max={3600} className="input-full" />
                </Form.Item>
              </Col>

              {showScheduleFields ? renderScheduleFields(scheduleType) : null}

              {showManualField ? (
                <Col xs={24} md={8}>
                  <Form.Item label="手动有效期" name="manual_until">
                    <Input placeholder="例如 2026-03-25T23:59:59+08:00" />
                  </Form.Item>
                </Col>
              ) : null}
            </Row>

            <Space wrap>
              <Button type="primary" htmlType="submit" loading={isMonitorConfigSaving}>
                保存配置
              </Button>
              <Button onClick={onStart} loading={toggleMonitorLoading}>
                启动监测
              </Button>
              <Button onClick={onStop} loading={toggleMonitorLoading}>
                停止监测
              </Button>
            </Space>

            <SectionCard title="分析区域（ROI）" subtitle="配置后仅分析圈选区域，不再做全画面识别。">
              <Row gutter={16}>
                <Col xs={24} md={6}>
                  <Form.Item label="启用 ROI" name="roi_enabled" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item label="区域形状" name="roi_shape" initialValue="rect">
                    <Select
                      options={[
                        { label: '矩形', value: 'rect' },
                        { label: '不规则多边形', value: 'polygon' },
                      ]}
                      disabled={!roiEnabled}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={18}>
                  <Space wrap>
                    <Button
                      onClick={() => {
                        if (!effectiveSelectedCameraId) {
                          return;
                        }
                        captureRoiSnapshotMutation.mutate(effectiveSelectedCameraId);
                      }}
                      loading={captureRoiSnapshotMutation.isPending}
                    >
                      拍照取景并圈选
                    </Button>
                    <Button onClick={clearRoi} disabled={!roiEnabled}>
                      清空区域
                    </Button>
                    {roiShape === 'polygon' ? (
                      <>
                        <Button onClick={clearPolygonDraft} disabled={polygonDraftPoints.length === 0}>
                          清空当前圈选
                        </Button>
                      </>
                    ) : null}
                  </Space>
                </Col>
              </Row>

              {roiShape === 'rect' ? (
                <Row gutter={16}>
                  <Col xs={24} md={6}>
                    <Form.Item
                      label="X"
                      name="roi_x"
                      rules={roiEnabled ? [{ required: true, message: '请设置 X' }] : []}
                    >
                      <InputNumber
                        min={0}
                        max={1}
                        step={0.01}
                        precision={4}
                        className="input-full"
                        disabled={!roiEnabled}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      label="Y"
                      name="roi_y"
                      rules={roiEnabled ? [{ required: true, message: '请设置 Y' }] : []}
                    >
                      <InputNumber
                        min={0}
                        max={1}
                        step={0.01}
                        precision={4}
                        className="input-full"
                        disabled={!roiEnabled}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      label="宽度"
                      name="roi_width"
                      rules={roiEnabled ? [{ required: true, message: '请设置宽度' }] : []}
                    >
                      <InputNumber
                        min={0.01}
                        max={1}
                        step={0.01}
                        precision={4}
                        className="input-full"
                        disabled={!roiEnabled}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      label="高度"
                      name="roi_height"
                      rules={roiEnabled ? [{ required: true, message: '请设置高度' }] : []}
                    >
                      <InputNumber
                        min={0.01}
                        max={1}
                        step={0.01}
                        precision={4}
                        className="input-full"
                        disabled={!roiEnabled}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              ) : (
                <Row gutter={16}>
                  <Col xs={24}>
                    <Text type="secondary">
                      多边形模式：按住鼠标左键在图中直接圈选，松开后自动保存不规则区域。
                    </Text>
                  </Col>
                </Row>
              )}

              {snapshotUrl ? (
                <div>
                  <div
                    ref={previewRef}
                    className="camera-roi-selector"
                    onMouseDown={handleRoiMouseDown}
                    onMouseMove={handleRoiMouseMove}
                    onMouseUp={commitDraftRoi}
                    onMouseLeave={handleRoiMouseLeave}
                    onMouseDownCapture={startPolygonDrawing}
                    onMouseMoveCapture={updatePolygonDrawing}
                    onMouseUpCapture={finishPolygonDrawing}
                    onPointerDownCapture={startPolygonDrawingPointer}
                    onPointerMoveCapture={updatePolygonDrawingPointer}
                    onPointerUpCapture={finishPolygonDrawingPointer}
                    onPointerCancelCapture={finishPolygonDrawingPointer}
                  >
                    <img src={snapshotUrl} alt="ROI snapshot" className="camera-roi-selector__image" />
                    {roiShape === 'rect' && activeRoi ? (
                      <div
                        className="camera-roi-selector__rect"
                        style={{
                          left: `${activeRoi.x * 100}%`,
                          top: `${activeRoi.y * 100}%`,
                          width: `${activeRoi.width * 100}%`,
                          height: `${activeRoi.height * 100}%`,
                        }}
                      />
                    ) : null}
                    {roiShape === 'polygon' && activePolygon && activePolygon.length > 0 ? (
                      <svg className="camera-roi-selector__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {activePolygon.length >= 2 ? (
                          <polyline
                            className="camera-roi-selector__polyline"
                            points={activePolygon.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')}
                          />
                        ) : null}
                        {activePolygon.length >= 3 ? (
                          <polygon
                            className="camera-roi-selector__polygon"
                            points={activePolygon.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')}
                          />
                        ) : null}
                        {activePolygon.map((point, index) => (
                          <circle
                            key={`roi-point-${point.x}-${point.y}-${index}`}
                            className="camera-roi-selector__point"
                            cx={point.x * 100}
                            cy={point.y * 100}
                            r={0.8}
                          />
                        ))}
                      </svg>
                    ) : null}
                  </div>
                  <Text type="secondary">
                    {roiShape === 'polygon'
                      ? '操作方式：先点“拍照取景并圈选”，再按住鼠标左键在图片上直接圈选，松开自动保存。坐标为归一化比例（0~1）。'
                      : '操作方式：先点“拍照取景并圈选”，再在图片上拖拽矩形区域。坐标为归一化比例（0~1）。'}
                  </Text>
                </div>
              ) : (
                <Text type="secondary">未加载取景图片。请先点击“拍照取景并圈选”。</Text>
              )}
            </SectionCard>
          </Form>

          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="当前模式">{RUNTIME_MODE_LABELS[runtimeMode] ?? runtimeMode}</Descriptions.Item>
            <Descriptions.Item label="ROI 分析区域">
              {summaryRoiEnabled
                ? summaryRoiShape === 'polygon'
                  ? summaryPolygonPoints.length >= 3
                    ? (
                      <Space direction="vertical" size={2}>
                        <Text>多边形（点数 {summaryPolygonPoints.length}）</Text>
                        <Text type="secondary">
                          外接矩形：{formatRect(computePolygonBounds(summaryPolygonPoints))}
                        </Text>
                        <Text type="secondary">点位：{formatPointList(summaryPolygonPoints)}</Text>
                        {summaryPreviewUrl ? (
                          <div className="camera-roi-summary-preview">
                            <img src={summaryPreviewUrl} alt="ROI preview" />
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                              <polygon
                                className="camera-roi-summary-preview__polygon"
                                points={summaryPolygonPoints.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')}
                              />
                              {summaryPolygonPoints.map((point, index) => (
                                <circle
                                  key={`roi-summary-point-${point.x}-${point.y}-${index}`}
                                  className="camera-roi-summary-preview__point"
                                  cx={point.x * 100}
                                  cy={point.y * 100}
                                  r={0.9}
                                />
                              ))}
                            </svg>
                          </div>
                        ) : null}
                      </Space>
                    )
                    : '多边形（点位不足，请重新圈选）'
                  : summaryRect
                    ? (
                      <Space direction="vertical" size={2}>
                        <Text>矩形 {formatRect(summaryRect)}</Text>
                        {summaryPreviewUrl ? (
                          <div className="camera-roi-summary-preview">
                            <img src={summaryPreviewUrl} alt="ROI preview" />
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                              <rect
                                className="camera-roi-summary-preview__rect"
                                x={summaryRect.x * 100}
                                y={summaryRect.y * 100}
                                width={summaryRect.width * 100}
                                height={summaryRect.height * 100}
                              />
                            </svg>
                          </div>
                        ) : null}
                      </Space>
                    )
                    : '矩形（参数未读取到，请重新保存配置）'
                : '未启用'}
            </Descriptions.Item>
            <Descriptions.Item label="最近运行">{formatRuntimeTime(monitorConfigData?.last_run_at)}</Descriptions.Item>
            <Descriptions.Item label="下次运行">{formatRuntimeTime(monitorConfigData?.next_run_at)}</Descriptions.Item>
            <Descriptions.Item label="最近错误">{formatMonitorError(monitorConfigData?.last_error)}</Descriptions.Item>
          </Descriptions>
        </Space>
      ) : (
        <Empty description="请选择一个摄像头后配置监测参数" />
      )}
    </SectionCard>
  );
}
