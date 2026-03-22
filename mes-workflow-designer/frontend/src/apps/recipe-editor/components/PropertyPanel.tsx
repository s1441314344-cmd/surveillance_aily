import { Card, Form, Input, Button, Tag, Divider } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

interface PropertyPanelProps {
  selectedNode: any;
  selectedEdge: any;
  groups: any[];
  onUpdate: () => void;
  onDeleteNode: () => void;
}

export default function PropertyPanel({ 
  selectedNode, 
  selectedEdge, 
  groups,
  onDeleteNode 
}: PropertyPanelProps) {
  if (selectedNode) {
    const group = groups.find(g => g.id === selectedNode.data?.groupId);
    
    return (
      <Card title="节点属性" size="small">
        <Form layout="vertical">
          <Form.Item label="节点名称">
            <Input value={selectedNode.data?.name} disabled />
          </Form.Item>
          <Form.Item label="节点类型">
            <Input value={selectedNode.type} disabled />
          </Form.Item>
          <Form.Item label="所属工艺组">
            <Tag color={group?.color || 'blue'}>{group?.name || '未分组'}</Tag>
          </Form.Item>
          <Form.Item label="位置">
            <div>X: {Math.round(selectedNode.position?.x || 0)}</div>
            <div>Y: {Math.round(selectedNode.position?.y || 0)}</div>
          </Form.Item>
          
          <Divider />
          
          <Form.Item label="工艺参数">
            {selectedNode.data?.parameters?.map((param: any) => (
              <div key={param.id} style={{ marginBottom: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                <div style={{ fontWeight: 'bold' }}>{param.name}</div>
                <div>{param.value} {param.unit}</div>
                <div style={{ fontSize: 12, color: '#999' }}>类型: {param.type}</div>
              </div>
            ))}
            {(!selectedNode.data?.parameters || selectedNode.data.parameters.length === 0) && (
              <div style={{ color: '#999' }}>暂无参数</div>
            )}
          </Form.Item>
          
          <Divider />
          
          <Button danger block icon={<DeleteOutlined />} onClick={onDeleteNode}>
            删除节点
          </Button>
        </Form>
      </Card>
    );
  }
  
  if (selectedEdge) {
    const isInterGroup = selectedEdge.data?.type === 'inter-group';
    
    return (
      <Card title="连线属性" size="small">
        <Form layout="vertical">
          <Form.Item label="连线类型">
            <Tag color={isInterGroup ? 'orange' : 'blue'}>
              {isInterGroup ? '跨组引用' : '组内连接'}
            </Tag>
          </Form.Item>
          <Form.Item label="连线样式">
            <div>{selectedEdge.data?.style === 'dashed' ? '虚线' : '实线'}</div>
          </Form.Item>
          <Form.Item label="源节点">
            <div>{selectedEdge.source}</div>
          </Form.Item>
          <Form.Item label="目标节点">
            <div>{selectedEdge.target}</div>
          </Form.Item>
          {selectedEdge.data?.condition && (
            <Form.Item label="条件">
              <div>{selectedEdge.data.condition}</div>
            </Form.Item>
          )}
        </Form>
      </Card>
    );
  }
  
  return (
    <Card title="属性面板" size="small">
      <div style={{ color: '#999', textAlign: 'center', padding: '20px 0' }}>
        选择一个节点或连线查看属性
      </div>
    </Card>
  );
}
