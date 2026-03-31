import { Space } from 'antd';
import { type Strategy } from '@/shared/api/configCenter';
import {
  ACTIVE_STATUS_LABELS,
  ACTIVE_STATUS_OPTIONS,
  buildAllOptions,
  DataStateBlock,
  FILTER_ALL_LABELS,
  FilterToolbar,
  RESULT_FORMAT_LABELS,
  SectionCard,
  StatusFilterActions,
  StatusBadge,
  UNKNOWN_LABELS,
} from '@/shared/ui';

type StrategySelectionRailProps = {
  loading: boolean;
  error: string | null;
  strategies: Strategy[];
  selectedStrategyId: string | null;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onResetListFilter: () => void;
  onSelectStrategy: (strategyId: string) => void;
};

const STATUS_FILTER_OPTIONS = buildAllOptions(
  ACTIVE_STATUS_OPTIONS,
  FILTER_ALL_LABELS.status,
  (item) => ({ label: item.label, value: item.value }),
);

export function StrategySelectionRail({
  loading,
  error,
  strategies,
  selectedStrategyId,
  statusFilter,
  onStatusFilterChange,
  onResetListFilter,
  onSelectStrategy,
}: StrategySelectionRailProps) {
  return (
    <SectionCard title="策略列表" subtitle="左侧选择策略，右侧查看或编辑详细配置">
      <FilterToolbar
        dense
        title="列表筛选"
        description="可按状态快速筛选策略"
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
        empty={!loading && !strategies.length}
        emptyDescription="当前筛选条件下暂无策略"
      >
        <div className="selection-rail">
          {strategies.map((item) => {
            const selected = item.id === selectedStrategyId;
            return (
              <button
                key={item.id}
                type="button"
                className={`selection-rail__item ${selected ? 'selection-rail__item--active' : ''}`}
                aria-pressed={selected}
                onClick={() => onSelectStrategy(item.id)}
              >
                <div className="selection-rail__header">
                  <div className="selection-rail__title">{item.name}</div>
                  <Space size={6}>
                    {item.is_preset ? <StatusBadge namespace="generic" value="info" label="预设" /> : null}
                    <StatusBadge
                      namespace="generic"
                      value={item.status}
                      label={ACTIVE_STATUS_LABELS[item.status] ?? UNKNOWN_LABELS.generic}
                    />
                  </Space>
                </div>
                <div className="selection-rail__body">
                  <div className="selection-rail__meta">
                    {item.model_provider} / {item.model_name}
                  </div>
                  <div className="selection-rail__meta">版本 v{item.version}</div>
                  <div className="selection-rail__meta">
                    输出格式 {RESULT_FORMAT_LABELS[item.result_format] ?? UNKNOWN_LABELS.generic}
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
