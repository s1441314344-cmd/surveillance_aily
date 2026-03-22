import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Input, Space, Modal, message } from 'antd';
import { SearchOutlined, DeleteOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

export default function RecipeLibrary() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/recipes`);
      setRecipes(response.data);
    } catch (error) {
      message.error('加载工艺库失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个工艺吗？此操作不可恢复。',
      onOk: async () => {
        try {
          await axios.delete(`${API_BASE}/recipes/${id}`);
          message.success('删除成功');
          loadRecipes();
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const handleViewDetail = async (recipe: any) => {
    try {
      const response = await axios.get(`${API_BASE}/recipes/${recipe.id}`);
      setSelectedRecipe(response.data);
      setIsDetailModalOpen(true);
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const filteredRecipes = recipes.filter(recipe =>
    recipe.name.toLowerCase().includes(searchText.toLowerCase()) ||
    recipe.description?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: '工艺名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (version: number) => <Tag>v{version}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={
          status === 'published' ? 'green' : 
          status === 'draft' ? 'orange' : 'default'
        }>
          {status === 'published' ? '已发布' : 
           status === 'draft' ? '草稿' : '已归档'}
        </Tag>
      )
    },
    {
      title: '工艺组',
      dataIndex: 'groups',
      key: 'groups',
      render: (groups: any[]) => groups?.length || 0
    },
    {
      title: '节点数',
      dataIndex: '_count',
      key: 'nodes',
      render: (count: any) => count?.nodes || 0
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          <Button 
            type="link" 
            icon={<CopyOutlined />}
          >
            复制
          </Button>
          <Button 
            type="link" 
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="recipe-library">
      <Card
        title="工艺库管理"
        extra={
          <Input
            placeholder="搜索工艺..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
          />
        }
      >
        <Table
          dataSource={filteredRecipes}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 详情模态框 */}
      <Modal
        title="工艺详情"
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalOpen(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedRecipe && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3>{selectedRecipe.name}</h3>
              <p style={{ color: '#666' }}>{selectedRecipe.description || '暂无描述'}</p>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <h4>工艺组 ({selectedRecipe.groups?.length || 0})</h4>
              <div>
                {selectedRecipe.groups?.map((group: any) => (
                  <Tag 
                    key={group.id} 
                    color={group.color}
                    style={{ marginBottom: 8, marginRight: 8 }}
                  >
                    {group.name}
                  </Tag>
                ))}
              </div>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <h4>节点 ({selectedRecipe.nodes?.length || 0})</h4>
              <div>
                {selectedRecipe.nodes?.map((node: any) => (
                  <Tag 
                    key={node.id}
                    style={{ marginBottom: 8, marginRight: 8 }}
                  >
                    {node.name}
                  </Tag>
                ))}
              </div>
            </div>
            
            <div>
              <h4>连线 ({selectedRecipe.edges?.length || 0})</h4>
              <div>
                {selectedRecipe.edges?.map((edge: any) => (
                  <Tag 
                    key={edge.id}
                    color={edge.type === 'inter-group' ? 'orange' : 'blue'}
                    style={{ marginBottom: 8, marginRight: 8 }}
                  >
                    {edge.sourceId} → {edge.targetId}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
