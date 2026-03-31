import { Button, Space, Table, Typography } from 'antd';
import { type TaskRecord } from '@/shared/api/tasks';
import {
  FEEDBACK_STATUS_LABELS,
  RESULT_STATUS_LABELS,
  SectionCard,
  StatusBadge,
  UNKNOWN_LABELS,
} from '@/shared/ui';
import { formatTimestamp } from '@/pages/records/types';

const { Text } = Typography;

type RecordsListSectionProps = {
  records: TaskRecord[];
  loading: boolean;
  selectedRecordId: string | null;
  onSelectRecord: (recordId: string) => void;
};

export function RecordsListSection({
  records,
  loading,
  selectedRecordId,
  onSelectRecord,
}: RecordsListSectionProps) {
  return (
    <SectionCard title="记录列表" className="page-master-list">
      <Table<TaskRecord>
        dataSource={records}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 12 }}
        loading={loading}
        columns={[
          {
            title: '任务 ID',
            dataIndex: 'job_id',
            sorter: true,
          },
          {
            title: '策略',
            dataIndex: 'strategy_name',
          },
          {
            title: '摄像头',
            render: (_, record) => (
              <Space direction="vertical" size={0}>
                <Text strong>{record.camera_id ? '摄像头任务' : '上传任务'}</Text>
                <Text type="secondary">{record.camera_id || '无'}</Text>
              </Space>
            ),
          },
          {
            title: '状态',
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
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectRecord(record.id);
                }}
              >
                查看详情
              </Button>
            ),
          },
        ]}
        onRow={(record) => ({
          onClick: () => onSelectRecord(record.id),
          tabIndex: 0,
          'aria-selected': record.id === selectedRecordId,
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelectRecord(record.id);
            }
          },
        })}
        rowClassName={(record) => `table-row-clickable ${record.id === selectedRecordId ? 'table-row-selected' : ''}`}
      />
    </SectionCard>
  );
}
