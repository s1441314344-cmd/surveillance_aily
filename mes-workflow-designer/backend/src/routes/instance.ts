import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 获取所有生产实例
router.get('/', async (req, res) => {
  try {
    const instances = await prisma.recipeInstance.findMany({
      include: {
        template: {
          select: { name: true, version: true }
        },
        processes: true
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(instances);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch instances' });
  }
});

// 获取单个生产实例详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await prisma.recipeInstance.findUnique({
      where: { id },
      include: {
        template: true,
        processes: {
          include: {
            nodes: {
              include: { parameters: true }
            },
            edges: true
          }
        }
      }
    });
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    res.json(instance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch instance' });
  }
});

// 从研发模板生成生产实例
router.post('/generate', async (req, res) => {
  try {
    const { templateId, name, description, createdBy } = req.body;
    
    // 1. 获取研发模板
    const template = await prisma.recipeTemplate.findUnique({
      where: { id: templateId },
      include: {
        groups: true,
        nodes: {
          include: { parameters: true }
        },
        edges: true
      }
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // 2. 创建生产实例
    const instance = await prisma.recipeInstance.create({
      data: {
        name: name || `${template.name} - 实例`,
        description,
        templateId,
        templateVersion: template.version,
        createdBy: createdBy || 'system'
      }
    });
    
    // 3. 按组拆分生成工艺
    for (const group of template.groups) {
      const groupNodes = template.nodes.filter(n => n.groupId === group.id);
      const groupNodeIds = new Set(groupNodes.map(n => n.id));
      
      // 组内连线
      const groupEdges = template.edges.filter(
        e => groupNodeIds.has(e.sourceId) && groupNodeIds.has(e.targetId)
      );
      
      // 处理跨组引用
      const referenceEdges = template.edges.filter(
        e => e.type === 'inter-group' && 
             (groupNodeIds.has(e.sourceId) || groupNodeIds.has(e.targetId))
      );
      
      // 创建工艺实例
      await prisma.processInstance.create({
        data: {
          instanceId: instance.id,
          groupId: group.id,
          name: group.name,
          bpmnXml: '', // 稍后生成
          nodes: {
            create: groupNodes.map(node => ({
              templateNodeId: node.id,
              name: node.name,
              type: node.type,
              positionX: node.positionX,
              positionY: node.positionY,
              parameters: {
                create: node.parameters.map(param => ({
                  templateParamId: param.id,
                  name: param.name,
                  inheritedValue: param.value,
                  currentValue: param.value,
                  isOverridden: false,
                  unit: param.unit
                }))
              }
            }))
          },
          edges: {
            create: [...groupEdges, ...referenceEdges].map(edge => ({
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              type: edge.type,
              condition: edge.condition
            }))
          }
        }
      });
    }
    
    // 4. 返回完整实例
    const fullInstance = await prisma.recipeInstance.findUnique({
      where: { id: instance.id },
      include: {
        template: true,
        processes: {
          include: {
            nodes: {
              include: { parameters: true }
            },
            edges: true
          }
        }
      }
    });
    
    res.status(201).json(fullInstance);
  } catch (error) {
    console.error('Generate instance error:', error);
    res.status(500).json({ error: 'Failed to generate instance' });
  }
});

// 更新生产实例参数
router.put('/:id/parameters', async (req, res) => {
  try {
    const { id } = req.params;
    const { parameters } = req.body;
    
    for (const param of parameters) {
      await prisma.parameterInstance.update({
        where: { id: param.id },
        data: {
          currentValue: param.currentValue,
          isOverridden: true
        }
      });
    }
    
    res.json({ message: 'Parameters updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update parameters' });
  }
});

// 重置参数为模板值
router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    const { paramIds } = req.body;
    
    for (const paramId of paramIds) {
      const param = await prisma.parameterInstance.findUnique({
        where: { id: paramId }
      });
      
      if (param) {
        await prisma.parameterInstance.update({
          where: { id: paramId },
          data: {
            currentValue: param.inheritedValue,
            isOverridden: false
          }
        });
      }
    }
    
    res.json({ message: 'Parameters reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset parameters' });
  }
});

// 删除生产实例
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.recipeInstance.delete({ where: { id } });
    res.json({ message: 'Instance deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete instance' });
  }
});

export default router;
