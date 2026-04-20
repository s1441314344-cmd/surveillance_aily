import { Descriptions, Empty, Space, Table, Tag } from 'antd';
import { DataStateBlock, SectionCard } from '@/shared/ui';
import type { useLocalDetectorPageController } from '@/pages/local-detector/useLocalDetectorPageController';

type LocalDetectorPageController = ReturnType<typeof useLocalDetectorPageController>;

type LocalDetectorResultSectionProps = {
  controller: LocalDetectorPageController;
};

export function LocalDetectorResultSection({ controller }: LocalDetectorResultSectionProps) {
  return (
    <SectionCard title="检测结果" subtitle="展示 decision / signals / detections 三类核心信息">
      {!controller.state.latestResult ? (
        <DataStateBlock empty emptyDescription="执行一次本地检测后，这里会展示结果。" minHeight={220} />
      ) : (
        <Space orientation="vertical" className="stack-full" size={12}>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="门控判定">
              <Tag color={controller.state.latestResult.decision.pass ? 'success' : 'error'}>
                {controller.state.latestResult.decision.pass ? 'PASS' : 'BLOCK'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="判定原因">{controller.state.latestResult.decision.reason}</Descriptions.Item>
            <Descriptions.Item label="模型">{controller.state.latestResult.model_meta.model_name}</Descriptions.Item>
            <Descriptions.Item label="预处理方案">
              {controller.state.latestResult.model_meta.preprocess_variant || 'unknown'}
            </Descriptions.Item>
            <Descriptions.Item label="检测阈值">
              模型阈值 {typeof controller.state.latestResult.model_meta.score_threshold === 'number'
                ? controller.state.latestResult.model_meta.score_threshold.toFixed(2)
                : '-'}
              {' / '}
              人员门控阈值 {typeof controller.state.latestResult.model_meta.person_threshold === 'number'
                ? controller.state.latestResult.model_meta.person_threshold.toFixed(2)
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="推理时延">{controller.state.latestResult.model_meta.latency_ms} ms</Descriptions.Item>
          </Descriptions>

          <Table
            rowKey="signalKey"
            size="small"
            pagination={false}
            dataSource={controller.queries.signalRows}
            columns={[
              { title: 'Signal', dataIndex: 'signalKey', key: 'signalKey' },
              {
                title: '置信度',
                dataIndex: 'confidence',
                key: 'confidence',
                render: (value: number) => value.toFixed(4),
              },
            ]}
          />

          <Table
            rowKey={(_, index) => String(index)}
            size="small"
            pagination={{ pageSize: 5, showSizeChanger: false }}
            dataSource={controller.state.latestResult.detections}
            locale={{ emptyText: <Empty description="无检测框" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            columns={[
              { title: '类别', dataIndex: 'label', key: 'label' },
              {
                title: '置信度',
                dataIndex: 'confidence',
                key: 'confidence',
                render: (value: number) => value.toFixed(4),
              },
              {
                title: 'BBox',
                dataIndex: 'bbox',
                key: 'bbox',
                render: (value: [number, number, number, number]) => value.join(', '),
              },
            ]}
          />

          <Table
            rowKey={(_, index) => String(index)}
            size="small"
            pagination={false}
            dataSource={controller.queries.ruleRows}
            locale={{ emptyText: <Empty description="未配置规则或无规则评估结果" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            columns={[
              { title: 'Signal', dataIndex: 'signal_key', key: 'signal_key' },
              {
                title: 'Labels',
                dataIndex: 'labels',
                key: 'labels',
                render: (value: string[]) => (value || []).join(', '),
              },
              {
                title: '命中数',
                dataIndex: 'matched_count',
                key: 'matched_count',
              },
              {
                title: '结果',
                dataIndex: 'passed',
                key: 'passed',
                render: (value: boolean) => (
                  <Tag color={value ? 'success' : 'error'}>{value ? 'PASS' : 'BLOCK'}</Tag>
                ),
              },
            ]}
          />
        </Space>
      )}
    </SectionCard>
  );
}
