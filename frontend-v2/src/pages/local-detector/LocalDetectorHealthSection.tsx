import { Button, Space, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { DataStateBlock, SectionCard } from '@/shared/ui';
import type { useLocalDetectorPageController } from '@/pages/local-detector/useLocalDetectorPageController';
import { getLocalDetectorErrorMessage } from '@/pages/local-detector/localDetectorErrorMessage';

type LocalDetectorPageController = ReturnType<typeof useLocalDetectorPageController>;

type LocalDetectorHealthSectionProps = {
  controller: LocalDetectorPageController;
};

const { Text } = Typography;

export function LocalDetectorHealthSection({ controller }: LocalDetectorHealthSectionProps) {
  return (
    <SectionCard title="服务状态" subtitle="实时查看 local-detector 可用性与就绪状态">
      <Space size={12} wrap>
        <Tag color={controller.queries.healthQuery.data?.ready ? 'success' : 'warning'}>
          {controller.queries.healthQuery.data?.ready ? '服务就绪' : '未就绪'}
        </Tag>
        <Tag color={controller.queries.healthQuery.data?.status === 'ok' ? 'success' : 'default'}>
          {controller.queries.healthQuery.data?.status ?? 'unknown'}
        </Tag>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => controller.queries.healthQuery.refetch()}
          loading={controller.queries.healthQuery.isFetching}
        >
          刷新状态
        </Button>
      </Space>
      {controller.queries.healthQuery.error ? (
        <DataStateBlock
          error={getLocalDetectorErrorMessage(controller.queries.healthQuery.error, '状态检查失败')}
          minHeight={80}
        />
      ) : null}
      {controller.queries.healthQuery.data?.error ? (
        <Text type="warning">错误信息：{controller.queries.healthQuery.data.error}</Text>
      ) : null}
    </SectionCard>
  );
}
