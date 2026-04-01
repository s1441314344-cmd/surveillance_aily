import { App, type FormInstance } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { Camera } from '@/shared/api/configCenter';
import type { JobSchedule } from '@/shared/api/tasks';
import type { EditScheduleFormValues, UploadFormValues } from '@/pages/jobs/types';
import { DEFAULT_FORM_VALUES } from '@/pages/jobs/types';
import type { useJobsMutationState } from '@/pages/jobs/useJobsMutationState';
import { useJobsScheduleEditorActions } from '@/pages/jobs/useJobsScheduleEditorActions';
import { handleJobsUploadSubmit } from './jobsSubmitActions';

const SCHEDULE_RESET_FIELDS = {
  precheckStrategyId: undefined,
  precheckPersonThreshold: DEFAULT_FORM_VALUES.precheckPersonThreshold,
  precheckSoftNegativeThreshold: DEFAULT_FORM_VALUES.precheckSoftNegativeThreshold,
  precheckStateTtlSeconds: DEFAULT_FORM_VALUES.precheckStateTtlSeconds,
  scheduleType: DEFAULT_FORM_VALUES.scheduleType,
  intervalMinutes: DEFAULT_FORM_VALUES.intervalMinutes,
  dailyTime: DEFAULT_FORM_VALUES.dailyTime,
};

const UPLOAD_MODE_DEFAULT_FIELDS = {
  uploadSource: 'local_file' as const,
  uploadCameraId: undefined,
  cameraId: undefined,
  ...SCHEDULE_RESET_FIELDS,
};

const CAMERA_ONCE_DEFAULT_FIELDS = {
  uploadSource: 'local_file' as const,
  uploadCameraId: undefined,
  ...SCHEDULE_RESET_FIELDS,
};

const CAMERA_ID_FIELD = 'cameraId';
const UPLOAD_CAMERA_FIELD = 'uploadCameraId';

type UseJobsFormActionStateParams = {
  form: FormInstance<UploadFormValues>;
  scheduleEditForm: FormInstance<EditScheduleFormValues>;
  taskMode: UploadFormValues['taskMode'];
  uploadSource: UploadFormValues['uploadSource'];
  fileList: UploadFile[];
  selectedCameraInForm: Camera | null;
  selectedUploadCameraInForm: Camera | null;
  editingSchedule: JobSchedule | null;
  setFileList: (value: UploadFile[]) => void;
  setEditScheduleType: (value: EditScheduleFormValues['scheduleType']) => void;
  setEditingSchedule: (value: JobSchedule | null) => void;
  mutations: ReturnType<typeof useJobsMutationState>;
};

function isUploadTaskMode(taskMode: UploadFormValues['taskMode']) {
  return taskMode === 'upload';
}

function isCameraOnceTaskMode(taskMode: UploadFormValues['taskMode']) {
  return taskMode === 'camera_once';
}

function isLocalUploadSource(uploadSource: UploadFormValues['uploadSource'] | undefined) {
  return uploadSource === 'local_file';
}

function clearFileList(setFileList: (value: UploadFile[]) => void) {
  setFileList([]);
}

function getSubmitLoadingState(mutations: ReturnType<typeof useJobsMutationState>) {
  return [
    mutations.uploadMutation.isPending,
    mutations.cameraOnceMutation.isPending,
    mutations.cameraSnapshotUploadMutation.isPending,
    mutations.scheduleMutation.isPending,
  ].some(Boolean);
}

function applyTaskModeDefaults(
  nextTaskMode: UploadFormValues['taskMode'],
  form: FormInstance<UploadFormValues>,
  setFileList: (value: UploadFile[]) => void,
) {
  const isUpload = isUploadTaskMode(nextTaskMode);
  const isCameraOnce = isCameraOnceTaskMode(nextTaskMode);
  if (!isUpload) {
    clearFileList(setFileList);
  }

  if (isUpload) {
    form.setFieldsValue(UPLOAD_MODE_DEFAULT_FIELDS);
    return;
  }

  if (isCameraOnce) {
    form.setFieldsValue(CAMERA_ONCE_DEFAULT_FIELDS);
  }
}

function applyUploadSourceDefaults(
  uploadSource: UploadFormValues['uploadSource'] | undefined,
  form: FormInstance<UploadFormValues>,
  setFileList: (value: UploadFile[]) => void,
) {
  if (isLocalUploadSource(uploadSource)) {
    form.setFieldValue(UPLOAD_CAMERA_FIELD, undefined);
    return;
  }

  if (uploadSource === 'camera_snapshot') {
    clearFileList(setFileList);
  }
}

function shouldApplyUploadSourceDefaults(changedValues: Partial<UploadFormValues>) {
  return Object.prototype.hasOwnProperty.call(changedValues, 'uploadSource');
}

function resetJobInputFields({
  taskMode,
  uploadSource,
  setFileList,
  form,
}: {
  taskMode: UploadFormValues['taskMode'];
  uploadSource: UploadFormValues['uploadSource'];
  setFileList: (value: UploadFile[]) => void;
  form: FormInstance<UploadFormValues>;
}) {
  if (isUploadTaskMode(taskMode)) {
    if (isLocalUploadSource(uploadSource)) {
      clearFileList(setFileList);
    }
    form.setFieldValue(UPLOAD_CAMERA_FIELD, undefined);
    return;
  }

  form.setFieldValue(CAMERA_ID_FIELD, undefined);
  form.setFieldsValue(SCHEDULE_RESET_FIELDS);
}

export function useJobsFormActionState({
  form,
  scheduleEditForm,
  taskMode,
  uploadSource,
  fileList,
  selectedCameraInForm,
  selectedUploadCameraInForm,
  editingSchedule,
  setFileList,
  setEditScheduleType,
  setEditingSchedule,
  mutations,
}: UseJobsFormActionStateParams) {
  const { message } = App.useApp();
  const {
    uploadMutation,
    cameraOnceMutation,
    cameraSnapshotUploadMutation,
    scheduleMutation,
    updateScheduleMutation,
  } = mutations;

  const { handleOpenScheduleEditor, handleCloseScheduleEditor, handleSubmitScheduleEdit } =
    useJobsScheduleEditorActions({
      scheduleEditForm,
      editingSchedule,
      setEditScheduleType,
      setEditingSchedule,
      updateScheduleMutation,
    });

  const handleUploadSubmit = (values: UploadFormValues) =>
    handleJobsUploadSubmit(values, {
      message,
      fileList,
      selectedCameraInForm,
      selectedUploadCameraInForm,
      mutations,
    });

  const handleResetInput = () =>
    resetJobInputFields({
      taskMode,
      uploadSource,
      setFileList,
      form,
    });

  const handleFormValuesChange = (changedValues: Partial<UploadFormValues>) => {
    if (changedValues.taskMode) {
      applyTaskModeDefaults(changedValues.taskMode, form, setFileList);
    }

    if (shouldApplyUploadSourceDefaults(changedValues)) {
      applyUploadSourceDefaults(changedValues.uploadSource, form, setFileList);
    }
  };

  return {
    submitLoading: getSubmitLoadingState(mutations),
    handleUploadSubmit,
    handleResetInput,
    handleFormValuesChange,
    handleOpenScheduleEditor,
    handleCloseScheduleEditor,
    handleSubmitScheduleEdit,
  };
}
