import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ANOMALY_TYPE_LABELS, RESULT_STATUS_LABELS, SectionCard, StatusBadge, UNKNOWN_LABELS } from '@/shared/ui';

export type AnomalyRecord = {
  id: string;
  type: string;
  status: string;
  model_name: string;
  strategy_name: string;
  created_at: string | null;
  detail: string;
};

export function AnomalyTable({ data, loading }: { data: AnomalyRecord[]; loading?: boolean }) {
  const columns: ColumnsType<AnomalyRecord> = [
    {
      title: '记录',
      dataIndex: 'id',
      render: (value: string) => <span className="anomaly-record-id">{value.slice(0, 8)}</span>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (value: string) => (
        <StatusBadge
          namespace="generic"
          value="warning"
          label={ANOMALY_TYPE_LABELS[value] ?? UNKNOWN_LABELS.generic}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value) => <StatusBadge namespace="result" value={value} label={RESULT_STATUS_LABELS[value] ?? UNKNOWN_LABELS.generic} />,
    },
    {
      title: '策略 / 模型',
      key: 'strategy',
      render: (_, record) => (
        <div>
          <div>{record.strategy_name || UNKNOWN_LABELS.strategy}</div>
          <div className="anomaly-model-meta">{record.model_name || '未提供模型信息'}</div>
        </div>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      render: (value) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: '详情',
      dataIndex: 'detail',
      render: (value: string) => <span className="anomaly-detail-text">{value}</span>,
    },
  ];

  return (
    <SectionCard title="异常案例" subtitle="仅展示已标记或模型结构化异常">
      <Table<AnomalyRecord>
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
      />
    </SectionCard>
  );
}
