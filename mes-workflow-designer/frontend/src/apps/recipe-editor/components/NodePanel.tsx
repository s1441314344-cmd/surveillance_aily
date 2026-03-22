import { Card, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

interface NodePanelProps {
  onAddNode: () => void;
}

export default function NodePanel({ onAddNode }: NodePanelProps) {
  return (
    <Card title="节点工具" size="small">
      <Button type="dashed" block icon={<PlusOutlined />} onClick={onAddNode}>
        添加节点
      </Button>
    </Card>
  );
}
