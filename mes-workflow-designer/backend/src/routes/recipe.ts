import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 获取所有研发工艺
router.get('/', async (req, res) => {
  try {
    const recipes = await prisma.recipeTemplate.findMany({
      include: {
        groups: true,
        _count: {
          select: { nodes: true, instances: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// 获取单个研发工艺详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recipe = await prisma.recipeTemplate.findUnique({
      where: { id },
      include: {
        groups: true,
        nodes: {
          include: { parameters: true }
        },
        edges: true,
        versions: {
          orderBy: { version: 'desc' }
        }
      }
    });
    
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

// 创建研发工艺
router.post('/', async (req, res) => {
  try {
    const { name, description, createdBy } = req.body;
    
    const recipe = await prisma.recipeTemplate.create({
      data: {
        name,
        description,
        createdBy: createdBy || 'system'
      }
    });
    
    res.status(201).json(recipe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

// 更新研发工艺
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    
    const recipe = await prisma.recipeTemplate.update({
      where: { id },
      data: {
        name,
        description,
        status,
        version: { increment: 1 }
      }
    });
    
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

// 删除研发工艺
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.recipeTemplate.delete({ where: { id } });
    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

// ==================== 工艺组管理 ====================

// 创建工艺组
router.post('/:id/groups', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, positionX, positionY, width, height } = req.body;
    
    const group = await prisma.processGroup.create({
      data: {
        recipeId: id,
        name,
        color: color || '#1890ff',
        positionX: positionX || 0,
        positionY: positionY || 0,
        width: width || 300,
        height: height || 200
      }
    });
    
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// 更新工艺组
router.put('/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, color, positionX, positionY, width, height, isCollapsed } = req.body;
    
    const group = await prisma.processGroup.update({
      where: { id: groupId },
      data: {
        name,
        color,
        positionX,
        positionY,
        width,
        height,
        isCollapsed
      }
    });
    
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// 删除工艺组
router.delete('/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    await prisma.processGroup.delete({ where: { id: groupId } });
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// ==================== 节点管理 ====================

// 创建节点
router.post('/:id/nodes', async (req, res) => {
  try {
    const { id } = req.params;
    const { groupId, name, type, positionX, positionY, parameters, isReference, refNodeId, refGroupId } = req.body;
    
    const node = await prisma.processNode.create({
      data: {
        recipeId: id,
        groupId,
        name,
        type: type || 'task',
        positionX: positionX || 0,
        positionY: positionY || 0,
        isReference: isReference || false,
        refNodeId,
        refGroupId,
        parameters: {
          create: parameters?.map((param: any) => ({
            name: param.name,
            code: param.code || param.name,
            type: param.type || 'text',
            value: String(param.value || ''),
            unit: param.unit,
            min: param.min,
            max: param.max,
            required: param.required || false
          })) || []
        }
      },
      include: { parameters: true }
    });
    
    res.status(201).json(node);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create node' });
  }
});

// 更新节点
router.put('/nodes/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { name, type, positionX, positionY, parameters } = req.body;
    
    // 更新节点基本信息
    const node = await prisma.processNode.update({
      where: { id: nodeId },
      data: {
        name,
        type,
        positionX,
        positionY
      }
    });
    
    // 如果有参数更新
    if (parameters && parameters.length > 0) {
      // 删除旧参数
      await prisma.nodeParameter.deleteMany({
        where: { nodeId }
      });
      
      // 创建新参数
      await prisma.nodeParameter.createMany({
        data: parameters.map((param: any) => ({
          nodeId,
          name: param.name,
          code: param.code || param.name,
          type: param.type || 'text',
          value: String(param.value || ''),
          unit: param.unit,
          min: param.min,
          max: param.max,
          required: param.required || false
        }))
      });
      
      // 同步更新引用节点
      await syncReferenceNodes(nodeId);
    }
    
    const updatedNode = await prisma.processNode.findUnique({
      where: { id: nodeId },
      include: { parameters: true }
    });
    
    res.json(updatedNode);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update node' });
  }
});

// 删除节点
router.delete('/nodes/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    await prisma.processNode.delete({ where: { id: nodeId } });
    res.json({ message: 'Node deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

// ==================== 连线管理 ====================

// 创建连线
router.post('/:id/edges', async (req, res) => {
  try {
    const { id } = req.params;
    const { sourceId, targetId, type, style, condition } = req.body;
    
    const edge = await prisma.processEdge.create({
      data: {
        recipeId: id,
        sourceId,
        targetId,
        type: type || 'intra-group',
        style: style || 'solid',
        condition
      }
    });
    
    res.status(201).json(edge);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create edge' });
  }
});

// 删除连线
router.delete('/edges/:edgeId', async (req, res) => {
  try {
    const { edgeId } = req.params;
    await prisma.processEdge.delete({ where: { id: edgeId } });
    res.json({ message: 'Edge deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete edge' });
  }
});

// ==================== 辅助函数 ====================

// 同步引用节点
async function syncReferenceNodes(changedNodeId: string) {
  const changedNode = await prisma.processNode.findUnique({
    where: { id: changedNodeId },
    include: { parameters: true }
  });
  
  if (!changedNode) return;
  
  // 查找所有引用该节点的节点
  const referenceNodes = await prisma.processNode.findMany({
    where: { refNodeId: changedNodeId }
  });
  
  // 批量更新引用节点
  for (const refNode of referenceNodes) {
    // 更新节点基本信息
    await prisma.processNode.update({
      where: { id: refNode.id },
      data: {
        name: changedNode.name,
        type: changedNode.type
      }
    });
    
    // 删除旧参数
    await prisma.nodeParameter.deleteMany({
      where: { nodeId: refNode.id }
    });
    
    // 复制新参数
    await prisma.nodeParameter.createMany({
      data: changedNode.parameters.map(param => ({
        nodeId: refNode.id,
        name: param.name,
        code: param.code,
        type: param.type,
        value: param.value,
        unit: param.unit,
        min: param.min,
        max: param.max,
        required: param.required
      }))
    });
  }
}

export default router;
