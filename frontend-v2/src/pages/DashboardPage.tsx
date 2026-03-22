import { Col, Row, Statistic, Card } from 'antd';
import { PagePlaceholder } from './PagePlaceholder';

export function DashboardPage() {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card><Statistic title="任务总数" value={0} /></Card>
          </Col>
          <Col xs={24} md={8}>
            <Card><Statistic title="结构化成功率" value={0} suffix="%" /></Card>
          </Col>
          <Col xs={24} md={8}>
            <Card><Statistic title="待复核记录" value={0} /></Card>
          </Col>
        </Row>
      </Col>
      <Col span={24}>
        <PagePlaceholder
          title="总览看板"
          description="Phase 1 先建立页面和指标卡骨架，Phase 4 再接入 dashboard 聚合接口与图表组件。"
          bullets={[
            'KPI 卡片：任务总数、成功率、异常比例、结构化成功率、已复核率',
            '趋势图：任务趋势、策略使用趋势',
            '异常案例列表：跳转到记录详情',
          ]}
          phase="Phase 4"
        />
      </Col>
    </Row>
  );
}
