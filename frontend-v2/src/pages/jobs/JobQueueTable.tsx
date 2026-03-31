import { Table } from 'antd';
import type { Camera } from '@/shared/api/configCenter';
import type { Job } from '@/shared/api/tasks';
import { useJobQueueColumns } from './useJobQueueColumns';

type JobQueueTableProps = {
  jobs: Job[];
  cameras: Camera[];
  selectedJobId?: string | null;
  loading: boolean;
  cancelLoading: boolean;
  retryLoading: boolean;
  onSelectJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onRetryJob: (jobId: string) => void;
};

export function JobQueueTable({
  jobs,
  cameras,
  selectedJobId,
  loading,
  cancelLoading,
  retryLoading,
  onSelectJob,
  onCancelJob,
  onRetryJob,
}: JobQueueTableProps) {
  const columns = useJobQueueColumns({ cameras, cancelLoading, retryLoading, onCancelJob, onRetryJob });

  return (
    <Table<Job>
      rowKey="id"
      dataSource={jobs}
      loading={loading}
      pagination={{ pageSize: 6 }}
      onRow={(record) => ({
        onClick: () => onSelectJob(record.id),
        tabIndex: 0,
        'aria-selected': record.id === selectedJobId,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectJob(record.id);
          }
        },
      })}
      rowClassName={(record) => `table-row-clickable ${record.id === selectedJobId ? 'table-row-selected' : ''}`}
      columns={columns}
    />
  );
}
