import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Select, Space, Spin, Typography } from 'antd';
import {
  searchAlertFeishuChats,
  searchAlertFeishuUsers,
  type AlertFeishuChatCandidate,
  type AlertFeishuUserCandidate,
} from '@/shared/api/alerts';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';

type FeishuRecipientSelectProps = {
  recipientType: 'user' | 'chat';
  value?: string;
  onChange?: (value?: string) => void;
  disabled?: boolean;
};

const DEFAULT_LIMIT = 20;

function useDebouncedKeyword(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function buildUserLabel(item: AlertFeishuUserCandidate) {
  const secondary = item.employee_id
    ? `工号: ${item.employee_id}`
    : `账号ID: ${item.user_id || '-'}`;
  return (
    <Space align="start" size={10}>
      <Avatar src={item.avatar_url || undefined} size={28}>
        {item.name.slice(0, 1)}
      </Avatar>
      <div style={{ lineHeight: 1.2 }}>
        <Typography.Text>{item.name}</Typography.Text>
        <br />
        <Typography.Text type="secondary">
          {secondary}
        </Typography.Text>
      </div>
    </Space>
  );
}

function buildChatLabel(item: AlertFeishuChatCandidate) {
  return (
    <Space align="start" size={10}>
      <Avatar src={item.avatar_url || undefined} size={28}>
        {item.name.slice(0, 1)}
      </Avatar>
      <div style={{ lineHeight: 1.2 }}>
        <Typography.Text>{item.name}</Typography.Text>
        <br />
        <Typography.Text type="secondary">
          {item.chat_id}
        </Typography.Text>
      </div>
    </Space>
  );
}

export function FeishuRecipientSelect({
  recipientType,
  value,
  onChange,
  disabled,
}: FeishuRecipientSelectProps) {
  const [searchState, setSearchState] = useState<{
    recipientType: FeishuRecipientSelectProps['recipientType'];
    keyword: string;
  }>({
    recipientType,
    keyword: '',
  });
  const keyword = searchState.recipientType === recipientType ? searchState.keyword : '';
  const debouncedKeyword = useDebouncedKeyword(keyword, 250).trim();
  const canSearchUser = recipientType === 'user' && debouncedKeyword.length > 0;
  const userQuery = useQuery({
    queryKey: ['alert-feishu-user-search', debouncedKeyword],
    queryFn: () => searchAlertFeishuUsers({ keyword: debouncedKeyword, limit: DEFAULT_LIMIT }),
    enabled: canSearchUser,
    staleTime: 30 * 1000,
  });
  const chatQuery = useQuery({
    queryKey: ['alert-feishu-chat-search', debouncedKeyword],
    queryFn: () =>
      searchAlertFeishuChats({
        keyword: debouncedKeyword || undefined,
        limit: DEFAULT_LIMIT,
      }),
    enabled: recipientType === 'chat',
    staleTime: 30 * 1000,
  });
  const activeQuery = recipientType === 'user' ? userQuery : chatQuery;

  const options = useMemo(() => {
    if (recipientType === 'user') {
      if (!userQuery.data) {
        return [];
      }
      return userQuery.data.items.map((item) => ({
        value: item.open_id,
        label: buildUserLabel(item),
      }));
    }
    if (!chatQuery.data) {
      return [];
    }
    return chatQuery.data.items.map((item) => ({
      value: item.chat_id,
      label: buildChatLabel(item),
    }));
  }, [chatQuery.data, recipientType, userQuery.data]);

  const mergedOptions = useMemo(() => {
    if (!value || options.some((item) => item.value === value)) {
      return options;
    }
    return [
      ...options,
      {
        value,
        label: (
          <Space>
            <Avatar size={28}>{recipientType === 'user' ? '人' : '群'}</Avatar>
            <div style={{ lineHeight: 1.2 }}>
              <Typography.Text>{`已选${recipientType === 'user' ? '人员' : '群组'}`}</Typography.Text>
              <br />
              <Typography.Text type="secondary">{value}</Typography.Text>
            </div>
          </Space>
        ),
      },
    ];
  }, [options, recipientType, value]);

  const placeholder = recipientType === 'user'
    ? '输入姓名/工号搜索人员'
    : '输入群名称搜索（留空显示可见群）';

  let notFoundContent: ReactNode = null;
  if (activeQuery.isFetching) {
    notFoundContent = <Spin size="small" />;
  } else if (activeQuery.isError) {
    notFoundContent = (
      <Typography.Text type="danger">
        {getApiErrorMessage(activeQuery.error, '飞书搜索失败')}
      </Typography.Text>
    );
  } else if (recipientType === 'user' && !canSearchUser) {
    notFoundContent = <Typography.Text type="secondary">请输入姓名或工号开始搜索</Typography.Text>;
  } else {
    notFoundContent = <Typography.Text type="secondary">暂无匹配结果</Typography.Text>;
  }

  return (
    <Select<string>
      showSearch
      allowClear
      disabled={disabled}
      value={value}
      placeholder={placeholder}
      options={mergedOptions}
      filterOption={false}
      onSearch={(nextKeyword) => {
        setSearchState({
          recipientType,
          keyword: nextKeyword,
        });
      }}
      onChange={(nextValue) => onChange?.(nextValue)}
      notFoundContent={notFoundContent}
      optionLabelProp="label"
    />
  );
}
