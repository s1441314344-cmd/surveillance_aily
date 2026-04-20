import { Table } from 'antd';
import type { Camera } from '@/shared/api/cameras';
import type { Strategy } from '@/shared/api/strategies';
import type { JobSchedule } from '@/shared/api/jobs';
import { buildSelectableTableRowProps } from '@/pages/jobs/jobsTableRowSelection';
import { useScheduleColumns } from './useScheduleColumns';

export type ScheduleTableDataProps = {
  schedules: JobSchedule[];
  cameras: Camera[];
  strategies: Strategy[];
};

export type ScheduleTableSelectionProps = {
  selectedScheduleId?: string | null;
};

export type ScheduleTableStateProps = {
  loading: boolean;
  scheduleStatusLoading: boolean;
  runNowLoading: boolean;
  updateLoading: boolean;
  deleteLoading: boolean;
};

export type ScheduleTableHandlersProps = {
  onSelectSchedule: (scheduleId: string) => void;
  onViewJobs: (scheduleId: string) => void;
  onRunNow: (scheduleId: string) => void;
  onEdit: (schedule: JobSchedule) => void;
  onToggleStatus: (scheduleId: string, status: string) => void;
  onDelete: (scheduleId: string) => void;
};

type ScheduleTableProps = {
  data: ScheduleTableDataProps;
  selection: ScheduleTableSelectionProps;
  state: ScheduleTableStateProps;
  handlers: ScheduleTableHandlersProps;
};

export function ScheduleTable({ data, selection, state, handlers }: ScheduleTableProps) {
  const columns = useScheduleColumns({
    lookups: {
      cameras: data.cameras,
      strategies: data.strategies,
    },
    actions: {
      loading: {
        scheduleStatusLoading: state.scheduleStatusLoading,
        runNowLoading: state.runNowLoading,
        updateLoading: state.updateLoading,
        deleteLoading: state.deleteLoading,
      },
      handlers: {
        onViewJobs: handlers.onViewJobs,
        onRunNow: handlers.onRunNow,
        onEdit: handlers.onEdit,
        onToggleStatus: handlers.onToggleStatus,
        onDelete: handlers.onDelete,
      },
    },
  });
  const rowSelectionProps = buildSelectableTableRowProps<JobSchedule>({
    selectedId: selection.selectedScheduleId,
    onSelect: handlers.onSelectSchedule,
  });

  return (
    <Table<JobSchedule>
      rowKey="id"
      dataSource={data.schedules}
      loading={state.loading}
      pagination={{ pageSize: 6 }}
      locale={{ emptyText: '暂无定时任务计划' }}
      {...rowSelectionProps}
      columns={columns}
    />
  );
}
