import { Button, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageHeader, SectionCard } from '@/shared/ui';

const { Paragraph, Text } = Typography;

export function AccessDeniedPage() {
  const navigate = useNavigate();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="访问控制"
        title="无权限访问"
        description="当前账号缺少访问该模块的角色权限。请联系系统管理员授权后重试。"
      />
      <SectionCard title="处理建议" subtitle="可先返回可访问页面继续操作">
        <Space orientation="vertical" size={12} className="stack-full">
          <Paragraph type="secondary" className="access-denied__description">
            你仍可继续使用已有权限的功能模块。若权限刚完成变更，建议重新登录后再进入该页面。
          </Paragraph>
          <div className="access-denied__actions">
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              返回总览看板
            </Button>
            <Text type="secondary">如需排查权限问题，请联系系统管理员检查角色分配。</Text>
          </div>
        </Space>
      </SectionCard>
    </div>
  );
}
