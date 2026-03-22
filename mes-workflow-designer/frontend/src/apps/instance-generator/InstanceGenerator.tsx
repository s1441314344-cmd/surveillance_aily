import { useState, useEffect } from 'react';
import { Card, Button, Table, Tag, Modal, Form, Input, Select, message, Row, Col, Descriptions } from 'antd';
import { PlusOutlined, ExportOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

export default function InstanceGenerator() {
  const [instances, setInstances] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadInstances();
    loadTemplates();
  }, []);

  const loadInstances = async () => {
    try {
      const response = await axios.get(`${API_BASE}/instances`);
      setInstances(response.data);
    } catch (error) {
      message.error('加载生产实例失败');
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await axios.get(`${API_BASE}/recipes`);
      setTemplates(response.data.filter((r: any) => r.status === 'published'));
    } catch (error) {
      message.error('加载工艺模板失败');
    }
  };

  const handleGenerate = async (values: any) => {
    try {
      await axios.post(`${API_BASE}/instances/generate`, values);
      message.success('生产实例生成成功');
      setIsModalOpen(false);
      form.resetFields();
      loadInstances();
    } catch (error) {
      message.error('生成生产实例失败');
    }
  };

  const handleExportBPMN = async (instance: any, process: any) => {
    try {
      const response = await axios.get(`${API_BASE}/bpmn/export/${instance.id}/${process.id}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${process.name}.bpmn`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      message.success('BPMN导出成功');
    } catch (error) {
      message.error('导出BPMN失败');
    }
  };

  const columns = [
    {
      title: '实例名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '引用模板',
      dataIndex: ['template', 'name'],
      key: 'template',
      render: (text: string, record: any) => (
        <span>{text} (v{record.templateVersion})</span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : status === 'draft' ? 'orange' : 'default'}>
          {status === 'active' ? '已激活' : status === 'draft' ? '草稿' : '已归档'}
        </Tag>
      )
    },
    {
      title: '工艺数量',
      dataIndex: 'processes',
      key: 'processCount',
      render: (processes: any[]) => processes?.length || 0
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <span>
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedInstance(record);
              setIsDetailModalOpen(true);
            }}
          >
            查看
          </Button>
        </span>
      )
    }
  ];

  return (
    <div className="instance-generator">
      <Card
        title="生产工艺生成器"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
            从模板生成
          </Button>
        }
      >
        <Table 
          dataSource={instances} 
          columns={columns} 
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 生成实例模态框 */}
      <Modal
        title="从模板生成生产实例"
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
        width={600}
      >
        <Form form={form} onFinish={handleGenerate} layout="vertical">
          <Form.Item name="templateId" label="选择研发模板" rules={[{ required: true }]}>
            <Select placeholder="请选择工艺模板">
              {templates.map(template => (
                <Select.Option key={template.id} value={template.id}>
                  {template.name} (v{template.version})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="实例名称" rules={[{ required: true }]}>
            <Input placeholder="请输入生产实例名称" />
          </Form.Item>
          <Form.Item name="description" label="实例描述">
            <Input.TextArea placeholder="请输入实例描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 实例详情模态框 */}
      <Modal
        title="生产实例详情"
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={null}
        width={900}
      >
        {selectedInstance && (
          <div>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="实例名称">{selectedInstance.name}</Descriptions.Item>
              <Descriptions.Item label="引用模板">{selectedInstance.template?.name}</Descriptions.Item>
              <Descriptions.Item label="模板版本">v{selectedInstance.templateVersion}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedInstance.status === 'active' ? 'green' : 'orange'}>
                  {selectedInstance.status === 'active' ? '已激活' : '草稿'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <h4 style={{ marginTop: 24, marginBottom: 16 }}>工艺流程</h4>
            <Row gutter={16}>
              {selectedInstance.processes?.map((process: any) => (
                <Col span={12} key={process.id}>
                  <Card 
                    size="small" 
                    title={process.name}
                    extra={
                      <Button 
                        type="link" 
                        icon={<ExportOutlined />}
                        onClick={() => handleExportBPMN(selectedInstance, process)}
                      >
                        导出BPMN
                      </Button>
                    }
                  >
                    <div style={{ maxHeight: 200, overflow: 'auto' }}>
                      <div>节点数: {process.nodes?.length || 0}</div>
                      <div>连线数: {process.edges?.length || 0}</div>
                      <div style={{ marginTop: 8 }}>
                        {process.nodes?.map((node: any) => (
                          <Tag key={node.id} style={{ marginBottom: 4 }}>{node.name}</Tag>
                        ))}
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
}
