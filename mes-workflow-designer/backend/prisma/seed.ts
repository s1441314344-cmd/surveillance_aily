import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始创建示例数据...');

  // 1. 创建研发工艺模板 - 饮料生产工艺
  const recipe = await prisma.recipeTemplate.create({
    data: {
      name: '绿茶饮料生产工艺',
      description: '包含萃取、溶解、调配三个工艺段的完整绿茶饮料生产流程，支持并行处理',
      version: 1,
      status: 'published',
      createdBy: 'admin',
      groups: {
        create: [
          {
            name: '萃取工艺',
            color: '#1890ff',
            positionX: 50,
            positionY: 50,
            width: 500,
            height: 300
          },
          {
            name: '溶解工艺',
            color: '#52c41a',
            positionX: 50,
            positionY: 400,
            width: 500,
            height: 300
          },
          {
            name: '调配工艺',
            color: '#faad14',
            positionX: 600,
            positionY: 225,
            width: 500,
            height: 300
          }
        ]
      }
    },
    include: { groups: true }
  });

  console.log('✅ 创建工艺模板:', recipe.name);

  // 获取工艺组ID
  const extractionGroup = recipe.groups.find(g => g.name === '萃取工艺')!;
  const dissolutionGroup = recipe.groups.find(g => g.name === '溶解工艺')!;
  const blendingGroup = recipe.groups.find(g => g.name === '调配工艺')!;

  // 2. 创建节点 - 萃取工艺组
  const extractionNodes = await Promise.all([
    // 开始节点
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: extractionGroup.id,
        name: '开始',
        type: 'start',
        positionX: 100,
        positionY: 80,
        parameters: { create: [] }
      }
    }),
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: extractionGroup.id,
        name: '加水',
        type: 'task',
        positionX: 100,
        positionY: 180,
        parameters: {
          create: [
            { name: '加水温度', code: 'water_temp', type: 'number', value: '85', unit: '°C', min: 80, max: 90 },
            { name: '加水量', code: 'water_volume', type: 'number', value: '1000', unit: 'L', min: 900, max: 1100 }
          ]
        }
      }
    }),
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: extractionGroup.id,
        name: '投茶',
        type: 'task',
        positionX: 250,
        positionY: 180,
        parameters: {
          create: [
            { name: '茶叶用量', code: 'tea_amount', type: 'number', value: '20', unit: 'kg', min: 18, max: 22 },
            { name: '茶叶品种', code: 'tea_type', type: 'text', value: '绿茶', unit: '' }
          ]
        }
      }
    }),
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: extractionGroup.id,
        name: '萃取',
        type: 'task',
        positionX: 400,
        positionY: 180,
        parameters: {
          create: [
            { name: '萃取温度', code: 'extract_temp', type: 'number', value: '85', unit: '°C', min: 80, max: 90 },
            { name: '萃取时间', code: 'extract_time', type: 'number', value: '15', unit: 'min', min: 10, max: 20 }
          ]
        }
      }
    }),
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: extractionGroup.id,
        name: '过滤',
        type: 'task',
        positionX: 250,
        positionY: 280,
        parameters: {
          create: [
            { name: '过滤精度', code: 'filter_precision', type: 'number', value: '200', unit: 'mesh', min: 150, max: 300 }
          ]
        }
      }
    })
  ]);

  console.log('✅ 创建萃取工艺节点:', extractionNodes.length);

  // 3. 创建节点 - 溶解工艺组
  const dissolutionNodes = await Promise.all([
    // 并行网关 - 分支
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: dissolutionGroup.id,
        name: '并行开始',
        type: 'parallelGateway',
        positionX: 100,
        positionY: 450,
        parameters: { create: [] }
      }
    }),
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: dissolutionGroup.id,
        name: '加糖',
        type: 'task',
        positionX: 100,
        positionY: 550,
        parameters: {
          create: [
            { name: '糖用量', code: 'sugar_amount', type: 'number', value: '80', unit: 'kg', min: 70, max: 90 },
            { name: '糖类型', code: 'sugar_type', type: 'text', value: '白砂糖', unit: '' }
          ]
        }
      }
    }),
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: dissolutionGroup.id,
        name: '溶解',
        type: 'task',
        positionX: 100,
        positionY: 650,
        parameters: {
          create: [
            { name: '溶解温度', code: 'dissolve_temp', type: 'number', value: '60', unit: '°C', min: 50, max: 70 },
            { name: '搅拌速度', code: 'stir_speed', type: 'number', value: '100', unit: 'rpm', min: 80, max: 120 }
          ]
        }
      }
    }),
    // 并行网关 - 合并
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: dissolutionGroup.id,
        name: '并行结束',
        type: 'parallelGateway',
        positionX: 250,
        positionY: 650,
        parameters: { create: [] }
      }
    }),
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: dissolutionGroup.id,
        name: '加酸',
        type: 'task',
        positionX: 400,
        positionY: 550,
        parameters: {
          create: [
            { name: '柠檬酸用量', code: 'citric_acid', type: 'number', value: '2', unit: 'kg', min: 1.5, max: 2.5 }
          ]
        }
      }
    })
  ]);

  console.log('✅ 创建溶解工艺节点:', dissolutionNodes.length);

  // 4. 创建节点 - 调配工艺组
  const blendingNodes = await Promise.all([
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: blendingGroup.id,
        name: '茶汁调配',
        type: 'task',
        positionX: 650,
        positionY: 275,
        parameters: {
          create: [
            { name: '调配比例', code: 'blend_ratio', type: 'text', value: '1:3', unit: '' },
            { name: '调配温度', code: 'blend_temp', type: 'number', value: '25', unit: '°C', min: 20, max: 30 }
          ]
        }
      }
    }),
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: blendingGroup.id,
        name: '加香精',
        type: 'task',
        positionX: 800,
        positionY: 275,
        parameters: {
          create: [
            { name: '香精用量', code: 'flavor_amount', type: 'number', value: '0.5', unit: 'kg', min: 0.3, max: 0.8 },
            { name: '香精类型', code: 'flavor_type', type: 'text', value: '绿茶香精', unit: '' }
          ]
        }
      }
    }),
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: blendingGroup.id,
        name: '均质',
        type: 'task',
        positionX: 950,
        positionY: 275,
        parameters: {
          create: [
            { name: '均质压力', code: 'homogenize_pressure', type: 'number', value: '20', unit: 'MPa', min: 15, max: 25 }
          ]
        }
      }
    }),
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: blendingGroup.id,
        name: '杀菌',
        type: 'task',
        positionX: 800,
        positionY: 375,
        parameters: {
          create: [
            { name: '杀菌温度', code: 'sterilize_temp', type: 'number', value: '121', unit: '°C', min: 115, max: 125 },
            { name: '杀菌时间', code: 'sterilize_time', type: 'number', value: '15', unit: 's', min: 10, max: 20 }
          ]
        }
      }
    }),
    // 结束节点
    prisma.processNode.create({
      data: {
        recipeId: recipe.id,
        groupId: blendingGroup.id,
        name: '结束',
        type: 'end',
        positionX: 950,
        positionY: 375,
        parameters: { create: [] }
      }
    })
  ]);

  console.log('✅ 创建调配工艺节点:', blendingNodes.length);

  // 5. 创建组内连线（实线）
  const intraGroupEdges = await Promise.all([
    // 萃取工艺组内连线
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: extractionNodes[0].id, // 开始
        targetId: extractionNodes[1].id, // 加水
        type: 'intra-group',
        style: 'solid'
      }
    }),
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: extractionNodes[1].id, // 加水
        targetId: extractionNodes[2].id, // 投茶
        type: 'intra-group',
        style: 'solid'
      }
    }),
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: extractionNodes[2].id, // 投茶
        targetId: extractionNodes[3].id, // 萃取
        type: 'intra-group',
        style: 'solid'
      }
    }),
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: extractionNodes[3].id, // 萃取
        targetId: extractionNodes[4].id, // 过滤
        type: 'intra-group',
        style: 'solid'
      }
    }),
    // 溶解工艺组内连线（并行流程）
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: dissolutionNodes[0].id, // 并行开始
        targetId: dissolutionNodes[1].id, // 加糖
        type: 'intra-group',
        style: 'solid'
      }
    }),
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: dissolutionNodes[0].id, // 并行开始
        targetId: dissolutionNodes[4].id, // 加酸
        type: 'intra-group',
        style: 'solid'
      }
    }),
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: dissolutionNodes[1].id, // 加糖
        targetId: dissolutionNodes[2].id, // 溶解
        type: 'intra-group',
        style: 'solid'
      }
    }),
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: dissolutionNodes[2].id, // 溶解
        targetId: dissolutionNodes[3].id, // 并行结束
        type: 'intra-group',
        style: 'solid'
      }
    }),
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: dissolutionNodes[4].id, // 加酸
        targetId: dissolutionNodes[3].id, // 并行结束
        type: 'intra-group',
        style: 'solid'
      }
    }),
    // 调配工艺组内连线
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: blendingNodes[0].id, // 茶汁调配
        targetId: blendingNodes[1].id, // 加香精
        type: 'intra-group',
        style: 'solid'
      }
    }),
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: blendingNodes[1].id, // 加香精
        targetId: blendingNodes[2].id, // 均质
        type: 'intra-group',
        style: 'solid'
      }
    }),
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: blendingNodes[2].id, // 均质
        targetId: blendingNodes[3].id, // 杀菌
        type: 'intra-group',
        style: 'solid'
      }
    }),
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: blendingNodes[3].id, // 杀菌
        targetId: blendingNodes[4].id, // 结束
        type: 'intra-group',
        style: 'solid'
      }
    })
  ]);

  console.log('✅ 创建组内连线:', intraGroupEdges.length);

  // 6. 创建跨组引用连线（虚线）
  const interGroupEdges = await Promise.all([
    // 萃取 -> 调配（茶汁引用）
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: extractionNodes[4].id, // 过滤（萃取组）
        targetId: blendingNodes[0].id,   // 茶汁调配（调配组）
        type: 'inter-group',
        style: 'dashed'
      }
    }),
    // 溶解 -> 调配（糖浆引用）
    prisma.processEdge.create({
      data: {
        recipeId: recipe.id,
        sourceId: dissolutionNodes[3].id, // 并行结束（溶解组）
        targetId: blendingNodes[0].id,    // 茶汁调配（调配组）
        type: 'inter-group',
        style: 'dashed'
      }
    })
  ]);

  console.log('✅ 创建跨组引用连线:', interGroupEdges.length);

  // 7. 创建用户
  const user = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@mes.com',
      password: '$2a$10$YourHashedPasswordHere',
      role: 'admin'
    }
  });

  console.log('✅ 创建用户:', user.username);

  console.log('\n🎉 示例数据创建完成！');
  console.log('📊 统计:');
  console.log(`  - 工艺模板: 1个`);
  console.log(`  - 工艺组: ${recipe.groups.length}个`);
  console.log(`  - 节点: ${extractionNodes.length + dissolutionNodes.length + blendingNodes.length}个`);
  console.log(`  - 连线: ${intraGroupEdges.length + interGroupEdges.length}条`);
  console.log(`  - 用户: 1个`);
  console.log('\n📝 包含的BPMN节点类型:');
  console.log('  - 开始节点 (start)');
  console.log('  - 结束节点 (end)');
  console.log('  - 任务节点 (task)');
  console.log('  - 并行网关 (parallelGateway)');
}

main()
  .catch((e) => {
    console.error('创建示例数据失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
