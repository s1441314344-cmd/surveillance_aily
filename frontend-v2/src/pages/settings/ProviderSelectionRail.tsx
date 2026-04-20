import { Space } from 'antd';
import { type ModelProvider } from '@/shared/api/modelProviders';
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

type ProviderSelectionRailProps = {
  loading: boolean;
  error: string | null;
  providers: ModelProvider[];
  selectedProvider: string | null;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onResetFilter: () => void;
  onSelectProvider: (provider: string) => void;
};

const STATUS_FILTER_OPTIONS = buildAllOptions(
  ACTIVE_STATUS_OPTIONS,
  FILTER_ALL_LABELS.status,
  (item) => ({ label: item.label, value: item.value }),
);

export function ProviderSelectionRail({
  loading,
  error,
  providers,
  selectedProvider,
  statusFilter,
  onStatusFilterChange,
  onResetFilter,
  onSelectProvider,
}: ProviderSelectionRailProps) {
  return (
    <SectionCard title="提供方列表" subtitle="选择一个提供方后，在右侧维护参数并执行联调">
      <FilterToolbar
        dense
        title="列表筛选"
        description="可按状态筛选提供方"
        actions={(
          <StatusFilterActions
            value={statusFilter}
            onChange={onStatusFilterChange}
            onReset={onResetFilter}
            options={STATUS_FILTER_OPTIONS}
          />
        )}
      />
      <DataStateBlock
        loading={loading}
        error={error}
        empty={!loading && !providers.length}
        emptyDescription="暂无模型提供方配置"
      >
        <div className="selection-rail">
          {providers.map((item) => {
            const selected = item.provider === selectedProvider;
            return (
              <button
                key={item.provider}
                type="button"
                className={`selection-rail__item ${selected ? 'selection-rail__item--active' : ''}`}
                aria-pressed={selected}
                onClick={() => onSelectProvider(item.provider)}
              >
                <div className="selection-rail__header">
                  <div className="selection-rail__title">{item.display_name}</div>
                  <Space size={6}>
                    <StatusBadge
                      namespace="generic"
                      value={item.status}
                      label={ACTIVE_STATUS_LABELS[item.status] ?? UNKNOWN_LABELS.generic}
                    />
                    <StatusBadge
                      namespace="generic"
                      value={item.has_api_key ? 'enabled' : 'disabled'}
                      label={item.has_api_key ? '已配密钥' : '未配密钥'}
                    />
                  </Space>
                </div>
                <div className="selection-rail__body">
                  <div className="selection-rail__meta">{item.provider}</div>
                  <div className="selection-rail__meta">{item.default_model || '未设置默认模型'}</div>
                  <div className="selection-rail__meta">{item.api_key_masked || '尚未配置 API Key'}</div>
                </div>
              </button>
            );
          })}
        </div>
      </DataStateBlock>
    </SectionCard>
  );
}
