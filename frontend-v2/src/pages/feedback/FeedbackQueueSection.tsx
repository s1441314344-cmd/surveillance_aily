import { Button, Table } from 'antd';
import { type TaskRecord } from '@/shared/api/records';
import {
  FEEDBACK_STATUS_LABELS,
  RESULT_STATUS_LABELS,
  SectionCard,
  StatusBadge,
  UNKNOWN_LABELS,
} from '@/shared/ui';
import { formatTimestamp } from '@/pages/feedback/types';
import type { KeyboardEvent, MouseEvent } from 'react';

type FeedbackQueueSectionProps = {
  records: TaskRecord[];
  loading: boolean;
  selectedRecordId: string | null;
  onSelectRecord: (recordId: string) => void;
};

const withRowClickGuard =
  (action: () => void) => (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    action();
  };

const handleRecordEnterSelect = (
  event: KeyboardEvent<HTMLElement>,
  selectRecord: () => void,
) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectRecord();
  }
};

export function FeedbackQueueSection({
  records,
  loading,
  selectedRecordId,
  onSelectRecord,
}: FeedbackQueueSectionProps) {
  return (
    <SectionCard title="复核队列" className="page-master-list">
      <Table<TaskRecord>
        dataSource={records}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 8 }}
        loading={loading}
        onRow={(record) => ({
          onClick: () => onSelectRecord(record.id),
          tabIndex: 0,
          'aria-selected': record.id === selectedRecordId,
          onKeyDown: (event) => handleRecordEnterSelect(event, () => onSelectRecord(record.id)),
        })}
        rowClassName={(record) => `table-row-clickable ${record.id === selectedRecordId ? 'table-row-selected' : ''}`}
        columns={[
          {
            title: '任务 ID',
            dataIndex: 'job_id',
          },
          {
            title: '策略',
            dataIndex: 'strategy_name',
          },
          {
            title: '结果',
            dataIndex: 'result_status',
            render: (value) => <StatusBadge namespace="result" value={value} label={RESULT_STATUS_LABELS[value] ?? UNKNOWN_LABELS.generic} />,
          },
          {
            title: '反馈',
            dataIndex: 'feedback_status',
            render: (value) => (value ? <StatusBadge namespace="feedback" value={value} label={FEEDBACK_STATUS_LABELS[value] ?? UNKNOWN_LABELS.generic} /> : '-'),
          },
          {
            title: '创建时间',
            dataIndex: 'created_at',
            render: formatTimestamp,
          },
          {
            title: '操作',
            render: (_, record) => (
              <Button
                type="link"
                onClick={withRowClickGuard(() => onSelectRecord(record.id))}
              >
                查看
              </Button>
            ),
          },
        ]}
      />
    </SectionCard>
  );
}
