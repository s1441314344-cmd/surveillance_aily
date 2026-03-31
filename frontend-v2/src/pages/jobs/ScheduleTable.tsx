import { Table } from 'antd';
import type { Camera, Strategy } from '@/shared/api/configCenter';
import type { JobSchedule } from '@/shared/api/tasks';
import { useScheduleColumns } from './useScheduleColumns';

type ScheduleTableProps = {
  schedules: JobSchedule[];
  cameras: Camera[];
  strategies: Strategy[];
  loading: boolean;
  scheduleStatusLoading: boolean;
  runNowLoading: boolean;
  updateLoading: boolean;
  deleteLoading: boolean;
  selectedScheduleId?: string | null;
  onSelectSchedule: (scheduleId: string) => void;
  onViewJobs: (scheduleId: string) => void;
  onRunNow: (scheduleId: string) => void;
  onEdit: (schedule: JobSchedule) => void;
  onToggleStatus: (scheduleId: string, status: string) => void;
  onDelete: (scheduleId: string) => void;
};

export function ScheduleTable({
  schedules,
  cameras,
  strategies,
  loading,
  scheduleStatusLoading,
  runNowLoading,
  updateLoading,
  deleteLoading,
  selectedScheduleId,
  onSelectSchedule,
  onViewJobs,
  onRunNow,
  onEdit,
  onToggleStatus,
  onDelete,
}: ScheduleTableProps) {
  const columns = useScheduleColumns({
    cameras,
    strategies,
    scheduleStatusLoading,
    runNowLoading,
    updateLoading,
    deleteLoading,
    onViewJobs,
    onRunNow,
    onEdit,
    onToggleStatus,
    onDelete,
  });

  return (
    <Table<JobSchedule>
      rowKey="id"
      dataSource={schedules}
      loading={loading}
      pagination={{ pageSize: 6 }}
      locale={{ emptyText: '暂无定时任务计划' }}
      onRow={(record) => ({
        onClick: () => onSelectSchedule(record.id),
        tabIndex: 0,
        'aria-selected': record.id === selectedScheduleId,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectSchedule(record.id);
          }
        },
      })}
      rowClassName={(record) => `table-row-clickable ${record.id === selectedScheduleId ? 'table-row-selected' : ''}`}
      columns={columns}
    />
  );
}
