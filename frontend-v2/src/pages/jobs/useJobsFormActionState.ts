import { App, type FormInstance } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { Camera } from '@/shared/api/cameras';
import type { JobSchedule } from '@/shared/api/jobs';
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

type UseJobsFormActionStateFormsParams = {
  form: FormInstance<UploadFormValues>;
  scheduleEditForm: FormInstance<EditScheduleFormValues>;
};

type UseJobsFormActionStateWorkflowParams = {
  taskMode: UploadFormValues['taskMode'];
  uploadSource: UploadFormValues['uploadSource'];
};

type UseJobsFormActionStateResourcesParams = {
  selectedCameraInForm: Camera | null;
  selectedUploadCameraInForm: Camera | null;
};

type UseJobsFormActionStateDraftStateParams = {
  fileList: UploadFile[];
  editingSchedule: JobSchedule | null;
  setFileList: (value: UploadFile[]) => void;
  setEditScheduleType: (value: EditScheduleFormValues['scheduleType']) => void;
  setEditingSchedule: (value: JobSchedule | null) => void;
};

type UseJobsFormActionStateParams = {
  forms: UseJobsFormActionStateFormsParams;
  workflow: UseJobsFormActionStateWorkflowParams;
  resources: UseJobsFormActionStateResourcesParams;
  draftState: UseJobsFormActionStateDraftStateParams;
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

function applyTaskModeDefaults({
  nextTaskMode,
  form,
  setFileList,
}: {
  nextTaskMode: UploadFormValues['taskMode'];
  form: FormInstance<UploadFormValues>;
  setFileList: (value: UploadFile[]) => void;
}) {
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

function applyUploadSourceDefaults({
  uploadSource,
  form,
  setFileList,
}: {
  uploadSource: UploadFormValues['uploadSource'] | undefined;
  form: FormInstance<UploadFormValues>;
  setFileList: (value: UploadFile[]) => void;
}) {
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
  forms,
  workflow,
  resources,
  draftState,
  mutations,
}: UseJobsFormActionStateParams) {
  const { message } = App.useApp();
  const {
    updateScheduleMutation,
  } = mutations;

  const { handleOpenScheduleEditor, handleCloseScheduleEditor, handleSubmitScheduleEdit } =
    useJobsScheduleEditorActions({
      form: {
        scheduleEditForm: forms.scheduleEditForm,
      },
      draftState: {
        editingSchedule: draftState.editingSchedule,
        setEditScheduleType: draftState.setEditScheduleType,
        setEditingSchedule: draftState.setEditingSchedule,
      },
      mutations: {
        updateScheduleMutation,
      },
    });

  const handleUploadSubmit = (values: UploadFormValues) =>
    handleJobsUploadSubmit(values, {
      feedback: {
        message,
      },
      resources: {
        fileList: draftState.fileList,
        selectedCameraInForm: resources.selectedCameraInForm,
        selectedUploadCameraInForm: resources.selectedUploadCameraInForm,
      },
      mutations,
    });

  const handleResetInput = () =>
    resetJobInputFields({
      taskMode: workflow.taskMode,
      uploadSource: workflow.uploadSource,
      setFileList: draftState.setFileList,
      form: forms.form,
    });

  const handleFormValuesChange = (changedValues: Partial<UploadFormValues>) => {
    if (changedValues.taskMode) {
      applyTaskModeDefaults({
        nextTaskMode: changedValues.taskMode,
        form: forms.form,
        setFileList: draftState.setFileList,
      });
    }

    if (shouldApplyUploadSourceDefaults(changedValues)) {
      applyUploadSourceDefaults({
        uploadSource: changedValues.uploadSource,
        form: forms.form,
        setFileList: draftState.setFileList,
      });
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
