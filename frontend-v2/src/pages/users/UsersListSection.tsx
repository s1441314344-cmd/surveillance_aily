import { Table } from 'antd';
import { type User } from '@/shared/api/users';
import { DataStateBlock, SectionCard } from '@/shared/ui';

type UsersListSectionProps = {
  users: User[];
  loading: boolean;
  error: string | null;
  selectedUserId: string | null;
  columns: Parameters<typeof Table<User>>[0]['columns'];
  onSelectUser: (userId: string) => void;
};

export function UsersListSection({
  users,
  loading,
  error,
  selectedUserId,
  columns,
  onSelectUser,
}: UsersListSectionProps) {
  return (
    <SectionCard title="用户列表" subtitle="支持启停账号与角色查看">
      <DataStateBlock
        loading={loading}
        error={error}
        empty={!loading && users.length === 0}
        emptyDescription="暂无用户"
      >
        <Table<User>
          rowKey="id"
          dataSource={users}
          columns={columns}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          onRow={(record) => ({
            onClick: () => onSelectUser(record.id),
            tabIndex: 0,
            'aria-selected': record.id === selectedUserId,
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectUser(record.id);
              }
            },
          })}
          rowClassName={(record) => `table-row-clickable ${record.id === selectedUserId ? 'table-row-selected' : ''}`}
        />
      </DataStateBlock>
    </SectionCard>
  );
}
