import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AlertRecord } from '@/shared/api/configCenter';
import { DataStateBlock, SectionCard } from '@/shared/ui';
import { AlertEventFilters } from '@/pages/alerts/AlertEventFilters';
import type { KeyboardEvent } from 'react';

type AlertEventsTabProps = {
  statusFilter: string;
  severityFilter: string;
  keyword: string;
  loading: boolean;
  error: string | null;
  alerts: AlertRecord[];
  selectedAlertId: string | null;
  alertColumns: ColumnsType<AlertRecord>;
  onStatusFilterChange: (value: string) => void;
  onSeverityFilterChange: (value: string) => void;
  onKeywordChange: (value: string) => void;
  onReset: () => void;
  onSelectAlert: (alertId: string) => void;
};

function handleRowKeyboardSelect(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

export function AlertEventsTab({
  statusFilter,
  severityFilter,
  keyword,
  loading,
  error,
  alerts,
  selectedAlertId,
  alertColumns,
  onStatusFilterChange,
  onSeverityFilterChange,
  onKeywordChange,
  onReset,
  onSelectAlert,
}: AlertEventsTabProps) {
  return (
    <SectionCard title="事件处理台" subtitle="按状态、级别和关键字快速定位并处理告警">
      <div className="page-stack">
        <AlertEventFilters
          statusFilter={statusFilter}
          severityFilter={severityFilter}
          keyword={keyword}
          onStatusFilterChange={onStatusFilterChange}
          onSeverityFilterChange={onSeverityFilterChange}
          onKeywordChange={onKeywordChange}
          onReset={onReset}
        />

        <DataStateBlock
          loading={loading}
          error={error}
          empty={!loading && !alerts.length}
          emptyDescription="当前筛选条件下暂无告警事件"
        >
          <Table<AlertRecord>
            rowKey="id"
            dataSource={alerts}
            columns={alertColumns}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            onRow={(record) => ({
              onClick: () => onSelectAlert(record.id),
              tabIndex: 0,
              'aria-selected': record.id === selectedAlertId,
              onKeyDown: (event) => handleRowKeyboardSelect(event, () => onSelectAlert(record.id)),
            })}
            rowClassName={(record) => `table-row-clickable ${record.id === selectedAlertId ? 'table-row-selected' : ''}`}
          />
        </DataStateBlock>
      </div>
    </SectionCard>
  );
}
