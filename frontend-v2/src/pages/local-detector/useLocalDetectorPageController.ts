import { useEffect, useMemo, useState } from 'react';
import { Form, message } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';
import {
  detectWithLocalDetector,
  getLocalDetectorConfig,
  getLocalDetectorHealth,
  updateLocalDetectorConfig,
  type LocalDetectorDetectResult,
  type LocalDetectorRuleConfig,
} from '@/shared/api/localDetector';
import { captureCameraPhoto, fetchCameraMediaFile, listCameras } from '@/shared/api/cameras';
import { useObjectUrl } from '@/shared/hooks/useObjectUrl';
import { getLocalDetectorErrorMessage } from '@/pages/local-detector/localDetectorErrorMessage';

export type LocalDetectorFormValues = {
  personThreshold: number;
  selectedCameraId?: string;
  ruleMode: 'and' | 'or';
  rules?: Array<{
    signal_key: string;
    labels_text?: string;
    min_confidence: number;
    min_detections: number;
  }>;
};

export type DetectionRecord = {
  id: string;
  createdAt: string;
  fileName: string;
  threshold: number;
  source: 'upload' | 'camera';
  result: LocalDetectorDetectResult;
};

export type LocalDetectorConfigFormValues = {
  model_profile: 'speed' | 'balance' | 'custom';
  preprocess_mode: 'auto' | 'bgr_255' | 'rgb_255' | 'bgr_01' | 'rgb_01';
  score_threshold: number;
  nms_threshold: number;
  default_person_threshold: number;
  input_size: number;
  auto_download: boolean;
  model_name?: string;
  model_path?: string;
  model_url?: string;
};

export function useLocalDetectorPageController() {
  const [form] = Form.useForm<LocalDetectorFormValues>();
  const [configForm] = Form.useForm<LocalDetectorConfigFormValues>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileSource, setSelectedFileSource] = useState<'upload' | 'camera'>('upload');
  const [latestResult, setLatestResult] = useState<LocalDetectorDetectResult | null>(null);
  const [records, setRecords] = useState<DetectionRecord[]>([]);
  const previewUrl = useObjectUrl(selectedFile);

  const healthQuery = useQuery({
    queryKey: ['local-detector', 'health'],
    queryFn: getLocalDetectorHealth,
    refetchInterval: 10000,
  });
  const configQuery = useQuery({
    queryKey: ['local-detector', 'config'],
    queryFn: getLocalDetectorConfig,
  });
  const camerasQuery = useQuery({
    queryKey: ['local-detector', 'cameras'],
    queryFn: listCameras,
  });

  const selectedModelProfile = Form.useWatch('model_profile', configForm);

  useEffect(() => {
    const config = configQuery.data?.config;
    if (!config) {
      return;
    }
    configForm.setFieldsValue({
      model_profile: config.model_profile,
      preprocess_mode: config.preprocess_mode,
      score_threshold: config.score_threshold,
      nms_threshold: config.nms_threshold,
      default_person_threshold: config.default_person_threshold,
      input_size: config.input_size,
      auto_download: config.auto_download,
      model_name: config.model_name,
      model_path: config.model_path,
      model_url: config.model_url,
    });
    form.setFieldValue('personThreshold', config.default_person_threshold);
  }, [configForm, configQuery.data, form]);

  const configMutation = useMutation({
    mutationFn: updateLocalDetectorConfig,
    onSuccess: () => {
      message.success('检测服务配置已保存');
      void Promise.all([configQuery.refetch(), healthQuery.refetch()]);
    },
    onError: (error) => {
      message.error(getLocalDetectorErrorMessage(error, '保存配置失败'));
    },
  });

  const cameraPhotoMutation = useMutation({
    mutationFn: async (cameraId: string) => {
      const photo = await captureCameraPhoto(cameraId, { sourceKind: 'local_detector_debug' });
      if (!photo.success || !photo.media?.id) {
        throw new Error(photo.error_message || '摄像头拍照失败');
      }
      const blob = await fetchCameraMediaFile(cameraId, photo.media.id);
      const file = new File([blob], photo.media.original_name || `camera-${cameraId}.jpg`, {
        type: photo.media.mime_type || 'image/jpeg',
      });
      return file;
    },
    onSuccess: (file) => {
      setSelectedFile(file);
      setSelectedFileSource('camera');
      message.success(`拍照成功，已加载：${file.name}`);
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '摄像头拍照失败'));
    },
  });

  const detectMutation = useMutation({
    mutationFn: detectWithLocalDetector,
    onSuccess: (result, variables) => {
      setLatestResult(result);
      setRecords((previous) => {
        const next: DetectionRecord[] = [
          {
            id: `${Date.now()}`,
            createdAt: new Date().toLocaleString(),
            fileName: variables.file.name,
            threshold: variables.personThreshold,
            source: selectedFileSource,
            result,
          },
          ...previous,
        ];
        return next.slice(0, 10);
      });
      message.success('本地检测完成');
    },
    onError: (error) => {
      message.error(getLocalDetectorErrorMessage(error, '本地检测失败'));
    },
  });

  const signalRows = useMemo(() => {
    if (!latestResult) {
      return [];
    }
    return Object.entries(latestResult.signals).map(([signalKey, confidence]) => ({
      signalKey,
      confidence: Number(confidence ?? 0),
    }));
  }, [latestResult]);

  const ruleRows = latestResult?.rule_evaluation || [];
  const canRunDetect = Boolean(selectedFile)
    && healthQuery.data?.ready === true
    && !detectMutation.isPending;
  const cameraOptions = (camerasQuery.data || []).map((item) => ({
    label: `${item.name} (${item.id.slice(0, 8)})`,
    value: item.id,
  }));
  const modelProfileOptions = (configQuery.data?.model_profile_options || []).map((item) => ({
    label: item.label,
    value: item.value,
  }));
  const preprocessModeOptions = (configQuery.data?.preprocess_mode_options || []).map((item) => ({
    label: item.label,
    value: item.value,
  }));

  return {
    forms: {
      form,
      configForm,
    },
    state: {
      selectedFile,
      selectedFileSource,
      latestResult,
      records,
      previewUrl,
      selectedModelProfile,
    },
    queries: {
      healthQuery,
      configQuery,
      camerasQuery,
      signalRows,
      ruleRows,
    },
    mutations: {
      configMutation,
      cameraPhotoMutation,
      detectMutation,
    },
    options: {
      canRunDetect,
      cameraOptions,
      modelProfileOptions,
      preprocessModeOptions,
    },
    actions: {
      handleConfigSubmit(values: LocalDetectorConfigFormValues) {
        const payload: LocalDetectorConfigFormValues = {
          model_profile: values.model_profile,
          preprocess_mode: values.preprocess_mode,
          score_threshold: Number(values.score_threshold),
          nms_threshold: Number(values.nms_threshold),
          default_person_threshold: Number(values.default_person_threshold),
          input_size: Number(values.input_size),
          auto_download: Boolean(values.auto_download),
          model_name: values.model_name?.trim(),
          model_path: values.model_path?.trim(),
          model_url: values.model_url?.trim(),
        };
        configMutation.mutate(payload);
      },
      handleCaptureCameraPhoto() {
        const cameraId = form.getFieldValue('selectedCameraId');
        if (!cameraId) {
          message.warning('请先选择摄像头');
          return;
        }
        cameraPhotoMutation.mutate(cameraId);
      },
      handleSelectUpload(file: File) {
        setSelectedFile(file);
        setSelectedFileSource('upload');
        return false;
      },
      handleRemoveUpload() {
        setSelectedFile(null);
      },
      handleDetectSubmit({ personThreshold, ruleMode, rules }: LocalDetectorFormValues) {
        if (!selectedFile) {
          message.warning('请先上传图片');
          return;
        }
        const normalizedRules: LocalDetectorRuleConfig[] = (rules || [])
          .filter((item) => item.signal_key && item.labels_text)
          .map((item) => ({
            signal_key: item.signal_key.trim().toLowerCase(),
            labels: String(item.labels_text || '')
              .split(',')
              .map((label) => label.trim().toLowerCase())
              .filter(Boolean),
            min_confidence: Number(item.min_confidence),
            min_detections: Number(item.min_detections),
          }))
          .filter((item) => item.labels.length > 0);
        detectMutation.mutate({
          file: selectedFile,
          personThreshold: Number(personThreshold),
          ruleMode,
          rules: normalizedRules,
        });
      },
      handleClear() {
        form.resetFields();
        setSelectedFile(null);
        setLatestResult(null);
      },
      handleOpenPreviewWindow() {
        if (!previewUrl) {
          return;
        }
        window.open(previewUrl, '_blank', 'noopener,noreferrer');
      },
    },
  };
}
