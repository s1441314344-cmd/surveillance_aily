import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 导出BPMN
router.get('/export/:instanceId/:processId', async (req, res) => {
  try {
    const { instanceId, processId } = req.params;
    
    const process = await prisma.processInstance.findUnique({
      where: { id: processId },
      include: {
        nodes: {
          include: { parameters: true }
        },
        edges: true
      }
    });
    
    if (!process) {
      return res.status(404).json({ error: 'Process not found' });
    }
    
    // 生成BPMN XML
    const bpmnXml = generateBPMN(process.name, process.nodes, process.edges);
    
    // 更新BPMN内容
    await prisma.processInstance.update({
      where: { id: processId },
      data: { bpmnXml }
    });
    
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${process.name}.bpmn"`);
    res.send(bpmnXml);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export BPMN' });
  }
});

// 验证BPMN
router.post('/validate', async (req, res) => {
  try {
    const { bpmnXml } = req.body;
    
    // 简单验证XML格式
    const isValid = bpmnXml.includes('<?xml') && 
                    bpmnXml.includes('<definitions') &&
                    bpmnXml.includes('</definitions>');
    
    res.json({ 
      valid: isValid,
      errors: isValid ? [] : ['Invalid BPMN XML format']
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate BPMN' });
  }
});

// 生成BPMN XML
function generateBPMN(
  processName: string,
  nodes: any[],
  edges: any[]
): string {
  const processId = `Process_${Date.now()}`;
  
  let bpmn = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:mes="http://mes.example.com/schema"
             id="Definitions_${Date.now()}"
             targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="${processId}" name="${processName}" isExecutable="true">
    
    <!-- 开始事件 -->
    <startEvent id="StartEvent_1" name="开始">
      <outgoing>Flow_start</outgoing>
    </startEvent>
    
    <sequenceFlow id="Flow_start" sourceRef="StartEvent_1" targetRef="${nodes[0]?.id || 'EndEvent_1'}" />
`;

  // 添加任务节点
  nodes.forEach((node, index) => {
    const params = node.parameters.map((p: any) => 
      `        <mes:parameter name="${p.name}" inherited="${!p.isOverridden}" unit="${p.unit || ''}">${p.currentValue || ''}</mes:parameter>`
    ).join('\n');
    
    bpmn += `
    <task id="${node.id}" name="${node.name}" mes:templateNodeId="${node.templateNodeId}">
      <extensionElements>
        <mes:parameters>
${params}
        </mes:parameters>
      </extensionElements>
      <incoming>${index === 0 ? 'Flow_start' : `Flow_${edges.find(e => e.targetId === node.id)?.id || index}`}</incoming>
      <outgoing>Flow_${node.id}</outgoing>
    </task>
`;
  });

  // 添加连线
  edges.forEach(edge => {
    bpmn += `
    <sequenceFlow id="${edge.id}" sourceRef="${edge.sourceId}" targetRef="${edge.targetId}"${edge.condition ? ` name="${edge.condition}"` : ''} />
`;
  });

  // 添加结束事件
  bpmn += `
    <endEvent id="EndEvent_1" name="结束">
      <incoming>Flow_${nodes[nodes.length - 1]?.id || 'start'}</incoming>
    </endEvent>
    
  </process>
</definitions>`;

  return bpmn;
}

export default router;
