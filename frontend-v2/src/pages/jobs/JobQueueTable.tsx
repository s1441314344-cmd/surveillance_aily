import { Table } from 'antd';
import type { Camera } from '@/shared/api/cameras';
import type { Job } from '@/shared/api/jobs';
import { buildSelectableTableRowProps } from '@/pages/jobs/jobsTableRowSelection';
import { useJobQueueColumns } from './useJobQueueColumns';

export type JobQueueTableDataProps = {
  jobs: Job[];
  cameras: Camera[];
};

export type JobQueueTableSelectionProps = {
  selectedJobId?: string | null;
};

export type JobQueueTableStateProps = {
  loading: boolean;
  cancelLoading: boolean;
  retryLoading: boolean;
};

export type JobQueueTableHandlersProps = {
  onSelectJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onRetryJob: (jobId: string) => void;
};

type JobQueueTableProps = {
  data: JobQueueTableDataProps;
  selection: JobQueueTableSelectionProps;
  state: JobQueueTableStateProps;
  handlers: JobQueueTableHandlersProps;
};

export function JobQueueTable({ data, selection, state, handlers }: JobQueueTableProps) {
  const columns = useJobQueueColumns({
    lookups: { cameras: data.cameras },
    actions: {
      loading: {
        cancelLoading: state.cancelLoading,
        retryLoading: state.retryLoading,
      },
      handlers: {
        onCancelJob: handlers.onCancelJob,
        onRetryJob: handlers.onRetryJob,
      },
    },
  });
  const rowSelectionProps = buildSelectableTableRowProps<Job>({
    selectedId: selection.selectedJobId,
    onSelect: handlers.onSelectJob,
  });

  return (
    <Table<Job>
      rowKey="id"
      dataSource={data.jobs}
      loading={state.loading}
      pagination={{ pageSize: 6 }}
      {...rowSelectionProps}
      columns={columns}
    />
  );
}
