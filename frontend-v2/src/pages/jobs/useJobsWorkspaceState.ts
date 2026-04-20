import { useCallback, useState } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import type { JobSchedule } from '@/shared/api/jobs';
import type { EditScheduleFormValues } from '@/pages/jobs/types';

const JOBS_QUEUE_FILTER_DEFAULTS = {
  statusFilter: 'all',
  strategyFilter: 'all',
  triggerModeFilter: 'all',
  cameraFilter: 'all',
  scheduleFilter: 'all',
  createdFromFilter: '',
  createdToFilter: '',
} as const;

const JOBS_SCHEDULE_FILTER_DEFAULTS = {
  scheduleStatusFilter: 'all',
  scheduleCameraFilter: 'all',
  scheduleStrategyFilter: 'all',
} as const;

export function useJobsWorkspaceState() {
  const [statusFilter, setStatusFilter] = useState<string>(JOBS_QUEUE_FILTER_DEFAULTS.statusFilter);
  const [strategyFilter, setStrategyFilter] = useState<string>(JOBS_QUEUE_FILTER_DEFAULTS.strategyFilter);
  const [triggerModeFilter, setTriggerModeFilter] = useState<string>(JOBS_QUEUE_FILTER_DEFAULTS.triggerModeFilter);
  const [cameraFilter, setCameraFilter] = useState<string>(JOBS_QUEUE_FILTER_DEFAULTS.cameraFilter);
  const [scheduleFilter, setScheduleFilter] = useState<string>(JOBS_QUEUE_FILTER_DEFAULTS.scheduleFilter);
  const [createdFromFilter, setCreatedFromFilter] = useState<string>(JOBS_QUEUE_FILTER_DEFAULTS.createdFromFilter);
  const [createdToFilter, setCreatedToFilter] = useState<string>(JOBS_QUEUE_FILTER_DEFAULTS.createdToFilter);
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<string>(JOBS_SCHEDULE_FILTER_DEFAULTS.scheduleStatusFilter);
  const [scheduleCameraFilter, setScheduleCameraFilter] = useState<string>(JOBS_SCHEDULE_FILTER_DEFAULTS.scheduleCameraFilter);
  const [scheduleStrategyFilter, setScheduleStrategyFilter] = useState<string>(JOBS_SCHEDULE_FILTER_DEFAULTS.scheduleStrategyFilter);
  const [editScheduleType, setEditScheduleType] = useState<EditScheduleFormValues['scheduleType']>('interval_minutes');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<JobSchedule | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'queue' | 'schedule'>('queue');

  const handleResetQueueFilters = useCallback(() => {
    setStatusFilter(JOBS_QUEUE_FILTER_DEFAULTS.statusFilter);
    setStrategyFilter(JOBS_QUEUE_FILTER_DEFAULTS.strategyFilter);
    setTriggerModeFilter(JOBS_QUEUE_FILTER_DEFAULTS.triggerModeFilter);
    setCameraFilter(JOBS_QUEUE_FILTER_DEFAULTS.cameraFilter);
    setScheduleFilter(JOBS_QUEUE_FILTER_DEFAULTS.scheduleFilter);
    setCreatedFromFilter(JOBS_QUEUE_FILTER_DEFAULTS.createdFromFilter);
    setCreatedToFilter(JOBS_QUEUE_FILTER_DEFAULTS.createdToFilter);
  }, []);

  const handleResetScheduleFilters = useCallback(() => {
    setScheduleStatusFilter(JOBS_SCHEDULE_FILTER_DEFAULTS.scheduleStatusFilter);
    setScheduleCameraFilter(JOBS_SCHEDULE_FILTER_DEFAULTS.scheduleCameraFilter);
    setScheduleStrategyFilter(JOBS_SCHEDULE_FILTER_DEFAULTS.scheduleStrategyFilter);
  }, []);

  return {
    queueFilters: {
      statusFilter,
      setStatusFilter,
      strategyFilter,
      setStrategyFilter,
      triggerModeFilter,
      setTriggerModeFilter,
      cameraFilter,
      setCameraFilter,
      scheduleFilter,
      setScheduleFilter,
      createdFromFilter,
      setCreatedFromFilter,
      createdToFilter,
      setCreatedToFilter,
      handleResetQueueFilters,
    },
    scheduleFilters: {
      scheduleStatusFilter,
      setScheduleStatusFilter,
      scheduleCameraFilter,
      setScheduleCameraFilter,
      scheduleStrategyFilter,
      setScheduleStrategyFilter,
      handleResetScheduleFilters,
    },
    draftState: {
      editScheduleType,
      setEditScheduleType,
      fileList,
      setFileList,
    },
    selection: {
      selectedJobId,
      setSelectedJobId,
      selectedScheduleId,
      setSelectedScheduleId,
      editingSchedule,
      setEditingSchedule,
      workspaceTab,
      setWorkspaceTab,
    },
  };
}
