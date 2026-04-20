import { Table, Tag, Typography } from 'antd';
import { SectionCard } from '@/shared/ui';
import type {
  DetectionRecord,
  useLocalDetectorPageController,
} from '@/pages/local-detector/useLocalDetectorPageController';

type LocalDetectorPageController = ReturnType<typeof useLocalDetectorPageController>;

type LocalDetectorHistorySectionProps = {
  controller: LocalDetectorPageController;
};

export function LocalDetectorHistorySection({ controller }: LocalDetectorHistorySectionProps) {
  return (
    <SectionCard title="最近调试记录" subtitle="保留最近 10 次执行结果，便于快速比对">
      <Table<DetectionRecord>
        rowKey="id"
        size="small"
        pagination={{ pageSize: 5, showSizeChanger: false }}
        dataSource={controller.state.records}
        locale={{ emptyText: '暂无记录' }}
        columns={[
          { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
          { title: '文件名', dataIndex: 'fileName', key: 'fileName' },
          {
            title: '阈值',
            dataIndex: 'threshold',
            key: 'threshold',
            width: 120,
            render: (value: number) => value.toFixed(2),
          },
          {
            title: '来源',
            dataIndex: 'source',
            key: 'source',
            width: 120,
            render: (value: 'upload' | 'camera') => (
              <Tag color={value === 'camera' ? 'purple' : 'default'}>
                {value === 'camera' ? '摄像头' : '上传'}
              </Tag>
            ),
          },
          {
            title: '结果',
            key: 'decision',
            width: 120,
            render: (_, record) => (
              <Tag color={record.result.decision.pass ? 'success' : 'error'}>
                {record.result.decision.pass ? 'PASS' : 'BLOCK'}
              </Tag>
            ),
          },
          {
            title: '主要原因',
            key: 'reason',
            render: (_, record) => (
              <Typography.Text ellipsis={{ tooltip: record.result.decision.reason }}>
                {record.result.decision.reason}
              </Typography.Text>
            ),
          },
        ]}
      />
    </SectionCard>
  );
}
