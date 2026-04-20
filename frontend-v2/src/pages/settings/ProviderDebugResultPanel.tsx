import { Input } from 'antd';
import { type ModelProviderDebugResult } from '@/shared/api/modelProviders';
import {
  ACTIVE_STATUS_LABELS,
  DataStateBlock,
  GENERIC_STATE_LABELS,
  StatusBadge,
  UNKNOWN_LABELS,
} from '@/shared/ui';

type ProviderDebugResultPanelProps = {
  result: ModelProviderDebugResult | null;
};

function stringifyValue(value: unknown, fallback = '无') {
  if (value == null) {
    return fallback;
  }
  return JSON.stringify(value, null, 2);
}

export function ProviderDebugResultPanel({ result }: ProviderDebugResultPanelProps) {
  if (!result) {
    return (
      <DataStateBlock empty emptyDescription="保存配置后点击“执行调试”，这里会展示请求日志、输入与输出。">
        <div />
      </DataStateBlock>
    );
  }

  return (
    <div className="page-stack">
      <div className="console-grid console-grid--two">
        <div className="console-block">
          <div className="console-block__title">运行时</div>
          <div className="console-log-list">
            <div className="console-log-line">提供方：{result.provider}</div>
            <div className="console-log-line">模型：{result.model}</div>
            <div className="console-log-line">接口地址：{result.base_url}</div>
            <div className="console-log-line">超时：{result.timeout_seconds}秒</div>
            <div className="console-log-line">
              状态：{ACTIVE_STATUS_LABELS[result.status] ?? UNKNOWN_LABELS.generic}
            </div>
          </div>
        </div>

        <div className="console-block">
          <div className="console-block__title">
            运行日志{' '}
            <StatusBadge
              namespace="generic"
              value={result.success ? 'success' : 'failed'}
              label={result.success ? GENERIC_STATE_LABELS.success : GENERIC_STATE_LABELS.failed}
            />
          </div>
          <div className="console-log-list">
            {result.logs.length ? (
              result.logs.map((item, index) => (
                <div
                  key={`${item.level}-${index}`}
                  className={`console-log-line ${item.level === 'error' ? 'console-log-line--error' : ''}`}
                >
                  [{item.level}] {item.message}
                </div>
              ))
            ) : (
              <div className="console-log-line">本次无额外日志输出</div>
            )}
          </div>
        </div>
      </div>

      <div className="console-grid">
        <div className="console-block">
          <div className="console-block__title">输入摘要</div>
          <Input.TextArea
            readOnly
            autoSize={{ minRows: 4, maxRows: 10 }}
            value={stringifyValue(result.request_payload, '{}')}
          />
        </div>

        <div className="console-block">
          <div className="console-block__title">原始输出</div>
          <Input.TextArea
            readOnly
            autoSize={{ minRows: 4, maxRows: 10 }}
            value={result.raw_response || result.error_message || ''}
          />
        </div>

        <div className="console-block">
          <div className="console-block__title">结构化结果</div>
          <Input.TextArea
            readOnly
            autoSize={{ minRows: 4, maxRows: 10 }}
            value={stringifyValue(result.normalized_json)}
          />
        </div>

        {result.usage ? (
          <div className="console-block">
            <div className="console-block__title">用量统计</div>
            <Input.TextArea
              readOnly
              autoSize={{ minRows: 3, maxRows: 8 }}
              value={stringifyValue(result.usage, '{}')}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
