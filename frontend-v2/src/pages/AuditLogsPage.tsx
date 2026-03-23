import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { listAuditLogs, type AuditLog } from '@/shared/api/auditLogs';
import { useAuthStore } from '@/shared/state/authStore';

const { Paragraph, Text, Title } = Typography;
const { RangePicker } = DatePicker;

type FilterState = {
  httpMethod?: string;
  requestPath?: string;
  operatorUsername?: string;
  success?: boolean;
  range?: [Dayjs, Dayjs] | null;
};

export function AuditLogsPage() {
  const [filters, setFilters] = useState<FilterState>({
    httpMethod: undefined,
    requestPath: '',
    operatorUsername: '',
    success: undefined,
    range: null,
  });
  const currentUser = useAuthStore((state) => state.user);
  const canViewAuditLogs = currentUser?.roles.includes('system_admin') ?? false;

  const createdFrom = filters.range?.[0]?.toISOString();
  const createdTo = filters.range?.[1]?.toISOString();

  const auditLogsQuery = useQuery({
    queryKey: [
      'audit-logs',
      filters.httpMethod,
      filters.requestPath,
      filters.operatorUsername,
      filters.success,
      createdFrom,
      createdTo,
    ],
    queryFn: () =>
      listAuditLogs({
        httpMethod: filters.httpMethod || undefined,
        requestPath: filters.requestPath?.trim() || undefined,
        operatorUsername: filters.operatorUsername?.trim() || undefined,
        success: filters.success,
        createdFrom,
        createdTo,
        limit: 200,
      }),
    enabled: canViewAuditLogs,
  });

  const columns: ColumnsType<AuditLog> = useMemo(
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
        render: (_, record) => <Text>{record.operator_username || record.operator_user_id || 'unknown'}</Text>,
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
            <Tag color={record.success ? 'green' : 'red'}>{record.success ? '成功' : '失败'}</Tag>
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
        render: (_, record) => <Text type={record.error_message ? 'danger' : 'secondary'}>{record.error_message || '-'}</Text>,
      },
    ],
    [],
  );

  const handleReset = () => {
    setFilters({
      httpMethod: undefined,
      requestPath: '',
      operatorUsername: '',
      success: undefined,
      range: null,
    });
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          操作审计日志
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          审计记录覆盖写操作请求，用于安全追踪、问题排查与合规留痕。
        </Paragraph>
      </div>

      {!canViewAuditLogs ? (
        <Alert
          type="warning"
          showIcon
          title="当前账号无权限查看审计日志"
          description="审计日志仅开放给 system_admin。"
        />
      ) : (
        <Card>
          <Space wrap style={{ marginBottom: 16 }}>
            <Select
              allowClear
              placeholder="请求方法"
              style={{ width: 130 }}
              value={filters.httpMethod}
              options={[
                { label: 'POST', value: 'POST' },
                { label: 'PUT', value: 'PUT' },
                { label: 'PATCH', value: 'PATCH' },
                { label: 'DELETE', value: 'DELETE' },
              ]}
              onChange={(value) => setFilters((prev) => ({ ...prev, httpMethod: value }))}
            />
            <Select
              allowClear
              placeholder="执行结果"
              style={{ width: 130 }}
              value={filters.success}
              options={[
                { label: '成功', value: true },
                { label: '失败', value: false },
              ]}
              onChange={(value) => setFilters((prev) => ({ ...prev, success: value }))}
            />
            <Input
              allowClear
              placeholder="按路径筛选，如 /api/jobs"
              style={{ width: 260 }}
              value={filters.requestPath}
              onChange={(event) => setFilters((prev) => ({ ...prev, requestPath: event.target.value }))}
            />
            <Input
              allowClear
              placeholder="操作人用户名"
              style={{ width: 180 }}
              value={filters.operatorUsername}
              onChange={(event) => setFilters((prev) => ({ ...prev, operatorUsername: event.target.value }))}
            />
            <RangePicker
              showTime
              value={filters.range ?? null}
              onChange={(value) => setFilters((prev) => ({ ...prev, range: value as [Dayjs, Dayjs] | null }))}
            />
            <Button onClick={handleReset}>重置</Button>
          </Space>

          <Table<AuditLog>
            rowKey="id"
            loading={auditLogsQuery.isLoading}
            dataSource={auditLogsQuery.data ?? []}
            columns={columns}
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            locale={{ emptyText: auditLogsQuery.isError ? '审计日志加载失败' : '暂无审计日志' }}
          />
        </Card>
      )}
    </Space>
  );
}
