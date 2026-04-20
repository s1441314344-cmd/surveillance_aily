import { useMemo } from 'react';
import { Space, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AuditLog } from '@/shared/api/auditLogs';
import { GENERIC_STATE_LABELS, StatusBadge, UNKNOWN_LABELS } from '@/shared/ui';

const { Text } = Typography;

export function useAuditLogTableColumns() {
  const columns = useMemo<ColumnsType<AuditLog>>(
    () => [
      {
        title: '时间',
        dataIndex: 'created_at',
        width: 210,
        render: (value: string | null) => <Text>{value ? new Date(value).toLocaleString() : '-'}</Text>,
      },
      {
        title: '操作人',
        width: 160,
        render: (_, record) => <Text>{record.operator_username || record.operator_user_id || UNKNOWN_LABELS.generic}</Text>,
      },
      {
        title: '请求',
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Tag color="blue">{record.http_method}</Tag>
            <Text code>{record.request_path}</Text>
          </Space>
        ),
      },
      {
        title: '结果',
        width: 120,
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <StatusBadge
              namespace="generic"
              value={record.success ? 'success' : 'failed'}
              label={record.success ? GENERIC_STATE_LABELS.success : GENERIC_STATE_LABELS.failed}
            />
            <Text type="secondary">{record.status_code}</Text>
          </Space>
        ),
      },
      {
        title: '耗时(ms)',
        dataIndex: 'duration_ms',
        width: 110,
      },
      {
        title: '客户端',
        width: 140,
        render: (_, record) => <Text>{record.client_ip || '-'}</Text>,
      },
      {
        title: '异常信息',
        width: 240,
        ellipsis: true,
        render: (_, record) => (
          <Text type={record.error_message ? 'danger' : 'secondary'}>{record.error_message || '-'}</Text>
        ),
      },
    ],
    [],
  );

  return columns;
}
