import { Space } from 'antd';
import { type DashboardDefinition } from '@/shared/api/configCenter';
import {
  ACTIVE_STATUS_LABELS,
  ACTIVE_STATUS_OPTIONS,
  buildAllOptions,
  DataStateBlock,
  FILTER_ALL_LABELS,
  FilterToolbar,
  SectionCard,
  StatusFilterActions,
  StatusBadge,
  UNKNOWN_LABELS,
} from '@/shared/ui';

type DashboardDefinitionRailProps = {
  loading: boolean;
  error: string | null;
  dashboards: DashboardDefinition[];
  selectedDashboardId: string | null;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onResetListFilter: () => void;
  onSelectDashboard: (dashboardId: string) => void;
};

const STATUS_FILTER_OPTIONS = buildAllOptions(
  ACTIVE_STATUS_OPTIONS,
  FILTER_ALL_LABELS.status,
  (item) => ({ label: item.label, value: item.value }),
);

export function DashboardDefinitionRail({
  loading,
  error,
  dashboards,
  selectedDashboardId,
  statusFilter,
  onStatusFilterChange,
  onResetListFilter,
  onSelectDashboard,
}: DashboardDefinitionRailProps) {
  return (
    <SectionCard title="看板定义列表" subtitle="左侧选择定义，右侧编辑 JSON 和元数据">
      <FilterToolbar
        dense
        title="列表筛选"
        actions={(
          <StatusFilterActions
            value={statusFilter}
            onChange={onStatusFilterChange}
            onReset={onResetListFilter}
            options={STATUS_FILTER_OPTIONS}
          />
        )}
      />
      <DataStateBlock
        loading={loading}
        error={error}
        empty={!loading && dashboards.length === 0}
        emptyDescription="当前筛选条件下暂无看板定义"
      >
        <div className="selection-rail">
          {dashboards.map((item) => {
            const selected = item.id === selectedDashboardId;
            return (
              <button
                key={item.id}
                type="button"
                className={`selection-rail__item ${selected ? 'selection-rail__item--active' : ''}`}
                aria-pressed={selected}
                onClick={() => onSelectDashboard(item.id)}
              >
                <div className="selection-rail__header">
                  <div className="selection-rail__title">{item.name}</div>
                  <Space size={6}>
                    <StatusBadge
                      namespace="generic"
                      value={item.status}
                      label={ACTIVE_STATUS_LABELS[item.status] ?? UNKNOWN_LABELS.generic}
                    />
                    {item.is_default ? <StatusBadge namespace="generic" value="info" label="默认" /> : null}
                  </Space>
                </div>
                <div className="selection-rail__body">
                  <div className="selection-rail__meta">{item.description || '无描述'}</div>
                  <div className="selection-rail__meta">
                    更新于 {item.updated_at ? new Date(item.updated_at).toLocaleString() : '-'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DataStateBlock>
    </SectionCard>
  );
}
