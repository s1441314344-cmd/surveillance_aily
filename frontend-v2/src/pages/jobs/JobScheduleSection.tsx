import { Button, Select } from 'antd';
import type { Camera, Strategy } from '@/shared/api/configCenter';
import type { JobSchedule } from '@/shared/api/tasks';
import { FILTER_ALL_LABELS, FilterToolbar, SCHEDULE_STATUS_OPTIONS, SectionCard } from '@/shared/ui';
import { ScheduleTable } from '@/pages/jobs/ScheduleTable';

type OptionItem = {
  label: string;
  value: string;
};

type JobScheduleSectionProps = {
  schedules: JobSchedule[];
  cameras: Camera[];
  strategies: Strategy[];
  loading: boolean;
  scheduleStatusLoading: boolean;
  runNowLoading: boolean;
  updateLoading: boolean;
  deleteLoading: boolean;
  selectedScheduleId?: string | null;
  scheduleStatusFilter: string;
  scheduleCameraFilter: string;
  scheduleStrategyFilter: string;
  cameraOptions: OptionItem[];
  strategyOptions: OptionItem[];
  onScheduleStatusFilterChange: (value: string) => void;
  onScheduleCameraFilterChange: (value: string) => void;
  onScheduleStrategyFilterChange: (value: string) => void;
  onResetFilters: () => void;
  onSelectSchedule: (scheduleId: string) => void;
  onViewJobs: (scheduleId: string) => void;
  onRunNow: (scheduleId: string) => void;
  onEdit: (schedule: JobSchedule) => void;
  onToggleStatus: (scheduleId: string, status: string) => void;
  onDelete: (scheduleId: string) => void;
};

const SCHEDULE_STATUS_FILTER_OPTIONS = [
  { label: FILTER_ALL_LABELS.status, value: 'all' },
  ...SCHEDULE_STATUS_OPTIONS,
];

export function JobScheduleSection({
  schedules,
  cameras,
  strategies,
  loading,
  scheduleStatusLoading,
  runNowLoading,
  updateLoading,
  deleteLoading,
  selectedScheduleId,
  scheduleStatusFilter,
  scheduleCameraFilter,
  scheduleStrategyFilter,
  cameraOptions,
  strategyOptions,
  onScheduleStatusFilterChange,
  onScheduleCameraFilterChange,
  onScheduleStrategyFilterChange,
  onResetFilters,
  onSelectSchedule,
  onViewJobs,
  onRunNow,
  onEdit,
  onToggleStatus,
  onDelete,
}: JobScheduleSectionProps) {
  return (
    <SectionCard title="定时任务计划" subtitle="管理计划启停、编辑和立即触发">
      <FilterToolbar dense title="计划筛选" description="按状态、摄像头和策略快速过滤定时计划">
        <Select
          size="small"
          data-testid="schedule-filter-status"
          value={scheduleStatusFilter}
          onChange={onScheduleStatusFilterChange}
          options={SCHEDULE_STATUS_FILTER_OPTIONS}
          className="page-toolbar-field"
        />
        <Select
          size="small"
          data-testid="schedule-filter-camera"
          value={scheduleCameraFilter}
          onChange={onScheduleCameraFilterChange}
          options={cameraOptions}
          className="page-toolbar-field page-toolbar-field--md"
        />
        <Select
          size="small"
          data-testid="schedule-filter-strategy"
          value={scheduleStrategyFilter}
          onChange={onScheduleStrategyFilterChange}
          options={strategyOptions}
          className="page-toolbar-field page-toolbar-field--md"
        />
        <Button size="small" onClick={onResetFilters}>
          重置筛选
        </Button>
      </FilterToolbar>

      <ScheduleTable
        schedules={schedules}
        cameras={cameras}
        strategies={strategies}
        loading={loading}
        scheduleStatusLoading={scheduleStatusLoading}
        runNowLoading={runNowLoading}
        updateLoading={updateLoading}
        deleteLoading={deleteLoading}
        selectedScheduleId={selectedScheduleId}
        onSelectSchedule={onSelectSchedule}
        onViewJobs={onViewJobs}
        onRunNow={onRunNow}
        onEdit={onEdit}
        onToggleStatus={onToggleStatus}
        onDelete={onDelete}
      />
    </SectionCard>
  );
}
