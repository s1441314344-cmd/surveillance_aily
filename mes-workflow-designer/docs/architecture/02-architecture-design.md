# MES 工艺流程编辑器 - 架构设计文档

**版本**: v1.0  
**日期**: 2026-03-16  
**状态**: 设计中

---

## 1. 系统架构概览

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              前端层 (Frontend)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐ │
│  │   研发工艺编辑器     │    │   生产工艺生成器     │    │    工艺库管理    │ │
│  │  (RecipeEditor)     │    │  (InstanceGenerator) │    │  (RecipeLibrary) │ │
│  └──────────┬──────────┘    └──────────┬──────────┘    └────────┬────────┘ │
│             │                          │                        │          │
│             └──────────────────────────┼────────────────────────┘          │
│                                        │                                   │
│  ┌─────────────────────────────────────┴─────────────────────────────────┐ │
│  │                      共享组件层 (Shared Components)                    │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │  GraphCanvas│  │  NodePanel  │  │ PropertyPanel│  │  BPMNViewer │  │ │
│  │  │  (图画布)    │  │  (节点面板)  │  │  (属性面板)  │  │ (BPMN查看器) │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                        │                                   │
└────────────────────────────────────────┼───────────────────────────────────┘
                                         │ API / WebSocket
┌────────────────────────────────────────┼───────────────────────────────────┐
│                              后端层 (Backend)                              │
│                                        │                                   │
│  ┌─────────────────────────────────────┴─────────────────────────────────┐ │
│  │                         API Gateway (Express/NestJS)                   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                        │                                   │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┬───────────┐ │
│  │  Recipe      │  Instance    │  BPMN        │  User        │  File     │ │
│  │  Service     │  Service     │  Service     │  Service     │  Service  │ │
│  │  (工艺服务)   │  (实例服务)   │  (BPMN服务)   │  (用户服务)   │  (文件服务)│ │
│  └──────────────┴──────────────┴──────────────┴──────────────┴───────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         Data Access Layer (Prisma)                     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────┼───────────────────────────────────┐
│                              数据层 (Data Layer)                           │
│                                        │                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │   PostgreSQL     │  │      Redis       │  │   File Storage   │          │
│  │   (主数据库)      │  │    (缓存/会话)    │  │    (文件存储)     │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 两层架构数据流

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           研发工艺层 (R&D Layer)                             │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      RecipeTemplate (研发模板)                       │   │
│   │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │   │
│   │  │ 溶解工艺组   │───→│  跨组引用    │←───│ 调配工艺组   │             │   │
│   │  │ [P1,P2,P3]  │    │  (虚线连接)  │    │  [P5,P6]    │             │   │
│   │  └─────────────┘    └─────────────┘    └─────────────┘             │   │
│   │         │                                        │                  │   │
│   │         └────────────────┬───────────────────────┘                  │   │
│   │                          │                                         │   │
│   │                   组内连线 (实线)                                    │   │
│   │                          │                                         │   │
│   │                   ┌──────┴──────┐                                  │   │
│   │                   │  统一画布    │                                  │   │
│   │                   │  (多工艺组)  │                                  │   │
│   │                   └─────────────┘                                  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ 发布/版本控制                            │
│                                    ▼                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ 引用模板
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          生产工艺层 (Production Layer)                       │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     RecipeInstance (生产实例)                        │   │
│   │                                                                     │   │
│   │   引用模板: RecipeTemplate v1.0                                      │   │
│   │                                                                     │   │
│   │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │   │
│   │   │ 溶解工艺实例 │    │ 调配工艺实例 │    │ 其他工艺实例 │            │   │
│   │   │  BPMN图1    │    │  BPMN图2    │    │  BPMN图N    │            │   │
│   │   │             │    │             │    │             │            │   │
│   │   │ ┌───┐┌───┐ │    │ ┌───┐┌───┐ │    │ ┌───┐┌───┐ │            │   │
│   │   │ │开始│→│加水│ │    │ │开始│→│加糖浆││    │ │...│→│...│ │            │   │
│   │   │ └───┘└───┘ │    │ └───┘└───┘ │    │ └───┘└───┘ │            │   │
│   │   │     ↓      │    │     ↓      │    │            │            │   │
│   │   │ ┌───┐┌───┐ │    │ ┌───┐┌───┐ │    │            │            │   │
│   │   │ │搅拌│→│结束│ │    │ │搅拌│→│结束│ │    │            │            │   │
│   │   │ └───┘└───┘ │    │ └───┘└───┘ │    │            │            │   │
│   │   └─────────────┘    └─────────────┘    └─────────────┘            │   │
│   │                                                                     │   │
│   │   参数继承: 温度=18°C (继承) → 可覆盖为 20°C                          │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 模块设计

### 2.1 前端模块

#### 2.1.1 模块结构

```
frontend/
├── src/
│   ├── apps/
│   │   ├── recipe-editor/          # 研发工艺编辑器应用
│   │   │   ├── components/         # 编辑器专用组件
│   │   │   ├── hooks/              # 编辑器专用hooks
│   │   │   └── RecipeEditor.tsx    # 主编辑器组件
│   │   │
│   │   ├── instance-generator/     # 生产工艺生成器应用
│   │   │   ├── components/         # 生成器专用组件
│   │   │   ├── hooks/              # 生成器专用hooks
│   │   │   └── InstanceGenerator.tsx
│   │   │
│   │   └── recipe-library/         # 工艺库管理应用
│   │       └── RecipeLibrary.tsx
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── GraphCanvas/        # 图画布组件
│   │   │   ├── NodePanel/          # 节点面板
│   │   │   ├── PropertyPanel/      # 属性面板
│   │   │   ├── BPMNViewer/         # BPMN查看器
│   │   │   └── GroupContainer/     # 分组容器
│   │   │
│   │   ├── hooks/
│   │   │   ├── useGraph.ts         # 图操作hook
│   │   │   ├── useNode.ts          # 节点操作hook
│   │   │   ├── useGroup.ts         # 分组操作hook
│   │   │   └── useBPMN.ts          # BPMN操作hook
│   │   │
│   │   ├── stores/
│   │   │   ├── graphStore.ts       # 图状态管理
│   │   │   ├── nodeStore.ts        # 节点状态管理
│   │   │   └── groupStore.ts       # 分组状态管理
│   │   │
│   │   └── utils/
│   │       ├── bpmnConverter.ts    # BPMN转换工具
│   │       ├── graphLayout.ts      # 图布局算法
│   │       └── validators.ts       # 数据校验
│   │
│   ├── services/
│   │   ├── recipeService.ts        # 工艺API服务
│   │   ├── instanceService.ts      # 实例API服务
│   │   └── bpmnService.ts          # BPMN API服务
│   │
│   └── types/
│       ├── recipe.ts               # 工艺类型定义
│       ├── instance.ts             # 实例类型定义
│       └── bpmn.ts                 # BPMN类型定义
```

#### 2.1.2 核心组件设计

**GraphCanvas (图画布)**
```typescript
interface GraphCanvasProps {
  mode: 'edit' | 'view';              // 编辑/查看模式
  nodes: Node[];                       // 节点列表
  edges: Edge[];                       // 连线列表
  groups: Group[];                     // 分组列表
  onNodeAdd: (node: Node) => void;     // 添加节点回调
  onNodeUpdate: (node: Node) => void;  // 更新节点回调
  onEdgeAdd: (edge: Edge) => void;     // 添加连线回调
  onGroupUpdate: (group: Group) => void;
}

// 功能：
// - 基于ReactFlow实现画布
// - 支持节点拖拽、连线、分组
// - 支持缩放、平移
// - 支持框选、多选
```

**GroupContainer (分组容器)**
```typescript
interface GroupContainerProps {
  group: Group;
  children: React.ReactNode;
  onResize: (size: Size) => void;
  onCollapse: () => void;
  theme: GroupTheme;
}

// 功能：
// - 可视化分组区域
// - 支持拖拽调整大小
// - 支持折叠/展开
// - 不同组不同主题色
```

**PropertyPanel (属性面板)**
```typescript
interface PropertyPanelProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  selectedGroup: Group | null;
  onPropertyChange: (key: string, value: any) => void;
}

// 功能：
// - 节点参数配置
// - 连线样式配置
// - 分组属性配置
// - 参数继承/覆盖状态显示
```

### 2.2 后端模块

#### 2.2.1 服务架构

```
backend/
├── src/
│   ├── modules/
│   │   ├── recipe/                   # 研发工艺模块
│   │   │   ├── recipe.controller.ts
│   │   │   ├── recipe.service.ts
│   │   │   ├── recipe.repository.ts
│   │   │   └── dto/
│   │   │       ├── create-recipe.dto.ts
│   │   │       ├── update-recipe.dto.ts
│   │   │       └── recipe-response.dto.ts
│   │   │
│   │   ├── instance/                 # 生产工艺模块
│   │   │   ├── instance.controller.ts
│   │   │   ├── instance.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── bpmn/                     # BPMN处理模块
│   │   │   ├── bpmn.controller.ts
│   │   │   ├── bpmn.service.ts
│   │   │   └── converters/
│   │   │       ├── to-bpmn.converter.ts    # 转换为BPMN
│   │   │       └── from-bpmn.converter.ts  # 从BPMN解析
│   │   │
│   │   └── user/                     # 用户模块
│   │
│   ├── core/
│   │   ├── database/                 # 数据库配置
│   │   │   └── prisma.service.ts
│   │   ├── websocket/                # WebSocket服务
│   │   │   └── collaboration.gateway.ts
│   │   └── middleware/               # 中间件
│   │
│   └── main.ts                       # 应用入口
```

#### 2.2.2 核心服务设计

**RecipeService (研发工艺服务)**
```typescript
class RecipeService {
  // 创建研发工艺模板
  async createRecipe(dto: CreateRecipeDto): Promise<Recipe>;
  
  // 更新工艺（含版本控制）
  async updateRecipe(id: string, dto: UpdateRecipeDto): Promise<Recipe>;
  
  // 获取工艺详情（含节点、连线、分组）
  async getRecipeById(id: string): Promise<RecipeDetail>;
  
  // 发布工艺版本
  async publishVersion(id: string): Promise<RecipeVersion>;
  
  // 获取版本历史
  async getVersionHistory(id: string): Promise<RecipeVersion[]>;
  
  // 处理跨组引用同步
  private async syncReferenceNodes(recipeId: string): Promise<void>;
}
```

**InstanceService (生产工艺服务)**
```typescript
class InstanceService {
  // 从研发模板生成生产实例
  async generateFromTemplate(
    templateId: string, 
    config: GenerationConfig
  ): Promise<RecipeInstance>;
  
  // 按组拆分工艺
  private async splitByGroups(
    template: Recipe, 
    groups: string[]
  ): Promise<ProcessInstance[]>;
  
  // 参数实例化
  private async instantiateParameters(
    templateNodes: ProcessNode[],
    overrides: ParameterOverride[]
  ): Promise<NodeInstance[]>;
  
  // 更新实例参数
  async updateInstanceParams(
    instanceId: string,
    params: ParameterUpdate[]
  ): Promise<RecipeInstance>;
}
```

**BPMNService (BPMN服务)**
```typescript
class BPMNService {
  // 转换为BPMN 2.0 XML
  async convertToBPMN(instance: RecipeInstance): Promise<string>;
  
  // 从BPMN XML解析
  async parseFromBPMN(xml: string): Promise<ProcessInstance>;
  
  // 验证BPMN合规性
  async validateBPMN(xml: string): Promise<ValidationResult>;
  
  // 生成BPMN图预览
  async generatePreview(instance: RecipeInstance): Promise<string>;
}
```

---

## 3. 数据模型详细设计

### 3.1 数据库Schema (Prisma)

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== 研发工艺层 ====================

model RecipeTemplate {
  id          String   @id @default(uuid())
  name        String
  description String?
  version     Int      @default(1)
  status      String   @default("draft") // draft, published, archived
  
  // 关联
  groups      ProcessGroup[]
  nodes       ProcessNode[]
  edges       ProcessEdge[]
  versions    RecipeVersion[]
  instances   RecipeInstance[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String
  
  @@index([status])
  @@index([createdAt])
}

model RecipeVersion {
  id          String   @id @default(uuid())
  recipeId    String
  version     Int
  snapshot    Json     // 完整工艺快照
  changelog   String?
  
  recipe      RecipeTemplate @relation(fields: [recipeId], references: [id])
  
  createdAt   DateTime @default(now())
  createdBy   String
  
  @@unique([recipeId, version])
}

model ProcessGroup {
  id          String   @id @default(uuid())
  recipeId    String
  name        String   // 溶解、调配等
  color       String   // 主题色 #1890ff
  
  // 位置信息
  positionX   Float
  positionY   Float
  width       Float
  height      Float
  
  // 状态
  isCollapsed Boolean  @default(false)
  
  recipe      RecipeTemplate @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  nodes       ProcessNode[]
  
  @@index([recipeId])
}

model ProcessNode {
  id          String   @id @default(uuid())
  recipeId    String
  groupId     String
  
  // 基础信息
  name        String   // 加水、搅拌等
  type        String   // task, gateway, event, start, end
  
  // 位置
  positionX   Float
  positionY   Float
  
  // 引用关系
  isReference Boolean  @default(false)
  refNodeId   String?  // 引用的源节点ID
  refGroupId  String?  // 引用的源组ID
  
  // 关联
  recipe      RecipeTemplate @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  group       ProcessGroup   @relation(fields: [groupId], references: [id], onDelete: Cascade)
  parameters  NodeParameter[]
  
  // 关联的边
  sourceEdges ProcessEdge[] @relation("SourceNode")
  targetEdges ProcessEdge[] @relation("TargetNode")
  
  @@index([recipeId])
  @@index([groupId])
}

model NodeParameter {
  id          String   @id @default(uuid())
  nodeId      String
  
  // 参数定义
  name        String   // 温度、容量等
  code        String   // temperature, volume
  type        String   // number, range, select, text
  value       Json?    // 参数值
  unit        String?  // 单位
  options     Json?    // 选项值
  
  // 验证规则
  min         Float?
  max         Float?
  required    Boolean  @default(false)
  
  node        ProcessNode @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  
  @@index([nodeId])
}

model ProcessEdge {
  id          String   @id @default(uuid())
  recipeId    String
  
  // 连接节点
  sourceId    String
  targetId    String
  
  // 连线类型
  type        String   // intra-group, inter-group
  style       String   // solid, dashed
  
  // 条件（用于网关）
  condition   String?
  
  recipe      RecipeTemplate @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  source      ProcessNode    @relation("SourceNode", fields: [sourceId], references: [id])
  target      ProcessNode    @relation("TargetNode", fields: [targetId], references: [id])
  
  @@index([recipeId])
  @@index([sourceId])
  @@index([targetId])
}

// ==================== 生产工艺层 ====================

model RecipeInstance {
  id              String   @id @default(uuid())
  name            String
  description     String?
  
  // 引用关系
  templateId      String
  templateVersion Int
  
  // 状态
  status          String   @default("draft") // draft, active, archived
  
  // 关联
  template        RecipeTemplate   @relation(fields: [templateId], references: [id])
  processes       ProcessInstance[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdBy       String
  
  @@index([templateId])
  @@index([status])
}

model ProcessInstance {
  id          String   @id @default(uuid())
  instanceId  String
  groupId     String   // 对应的研发组ID
  name        String
  
  // BPMN内容
  bpmnXml     String   @db.Text
  
  // 关联
  instance    RecipeInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  nodes       NodeInstance[]
  edges       EdgeInstance[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([instanceId])
}

model NodeInstance {
  id              String   @id @default(uuid())
  processId       String
  templateNodeId  String   // 对应的研发节点ID
  
  name            String
  type            String
  positionX       Float
  positionY       Float
  
  // 关联
  process         ProcessInstance @relation(fields: [processId], references: [id], onDelete: Cascade)
  parameters      ParameterInstance[]
  
  @@index([processId])
}

model ParameterInstance {
  id              String   @id @default(uuid())
  nodeInstanceId  String
  templateParamId String   // 对应的研发参数ID
  
  name            String
  inheritedValue  Json?    // 继承值
  currentValue    Json?    // 当前值
  isOverridden    Boolean  @default(false)
  unit            String?
  
  nodeInstance    NodeInstance @relation(fields: [nodeInstanceId], references: [id], onDelete: Cascade)
  
  @@index([nodeInstanceId])
}

model EdgeInstance {
  id          String   @id @default(uuid())
  processId   String
  
  sourceId    String
  targetId    String
  type        String
  condition   String?
  
  process     ProcessInstance @relation(fields: [processId], references: [id], onDelete: Cascade)
  
  @@index([processId])
}

// ==================== 用户与权限 ====================

model User {
  id        String   @id @default(uuid())
  username  String   @unique
  email     String   @unique
  role      String   // admin, rd_engineer, prod_engineer
  
  createdAt DateTime @default(now())
}
```

---

## 4. 关键算法设计

### 4.1 跨组引用同步算法

```typescript
/**
 * 同步跨组引用节点
 * 当被引用节点变更时，更新所有引用节点
 */
async function syncReferenceNodes(
  recipeId: string,
  changedNodeId: string
): Promise<void> {
  // 1. 获取被变更的节点
  const changedNode = await prisma.processNode.findUnique({
    where: { id: changedNodeId },
    include: { parameters: true }
  });
  
  // 2. 查找所有引用该节点的节点
  const referenceNodes = await prisma.processNode.findMany({
    where: { 
      recipeId,
      refNodeId: changedNodeId 
    }
  });
  
  // 3. 批量更新引用节点
  for (const refNode of referenceNodes) {
    await prisma.processNode.update({
      where: { id: refNode.id },
      data: {
        name: changedNode.name,
        type: changedNode.type,
        parameters: {
          deleteMany: {},
          create: changedNode.parameters.map(param => ({
            name: param.name,
            code: param.code,
            type: param.type,
            value: param.value,
            unit: param.unit,
            options: param.options,
            min: param.min,
            max: param.max,
            required: param.required
          }))
        }
      }
    });
  }
  
  // 4. 发送WebSocket通知（实时协作）
  websocketServer.emit('nodes:synced', {
    recipeId,
    changedNodeId,
    affectedNodes: referenceNodes.map(n => n.id)
  });
}
```

### 4.2 工艺拆分算法

```typescript
/**
 * 按组拆分研发工艺为生产工艺
 */
async function splitRecipeByGroups(
  template: RecipeTemplate,
  targetGroups: string[]
): Promise<ProcessInstance[]> {
  const instances: ProcessInstance[] = [];
  
  for (const groupId of targetGroups) {
    const group = template.groups.find(g => g.id === groupId);
    if (!group) continue;
    
    // 1. 获取组内所有节点
    const groupNodes = template.nodes.filter(n => n.groupId === groupId);
    const groupNodeIds = new Set(groupNodes.map(n => n.id));
    
    // 2. 获取组内连线
    const groupEdges = template.edges.filter(
      e => groupNodeIds.has(e.sourceId) && groupNodeIds.has(e.targetId)
    );
    
    // 3. 处理跨组引用（将引用节点复制到当前组）
    const referenceEdges = template.edges.filter(
      e => e.type === 'inter-group' && 
           (groupNodeIds.has(e.sourceId) || groupNodeIds.has(e.targetId))
    );
    
    for (const refEdge of referenceEdges) {
      const isSourceInGroup = groupNodeIds.has(refEdge.sourceId);
      const refNodeId = isSourceInGroup ? refEdge.targetId : refEdge.sourceId;
      const refNode = template.nodes.find(n => n.id === refNodeId);
      
      if (refNode && !groupNodeIds.has(refNodeId)) {
        // 复制引用节点到当前组
        const copiedNode = await copyNodeToGroup(refNode, groupId);
        groupNodes.push(copiedNode);
        groupNodeIds.add(copiedNode.id);
        
        // 更新连线
        if (isSourceInGroup) {
          groupEdges.push({
            ...refEdge,
            targetId: copiedNode.id
          });
        } else {
          groupEdges.push({
            ...refEdge,
            sourceId: copiedNode.id
          });
        }
      }
    }
    
    // 4. 生成BPMN XML
    const bpmnXml = await generateBPMNForGroup(group, groupNodes, groupEdges);
    
    // 5. 创建工艺实例
    const instance = await prisma.processInstance.create({
      data: {
        groupId: group.id,
        name: group.name,
        bpmnXml,
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
          create: groupEdges.map(edge => ({
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            type: edge.type,
            condition: edge.condition
          }))
        }
      }
    });
    
    instances.push(instance);
  }
  
  return instances;
}
```

### 4.3 BPMN转换算法

```typescript
/**
 * 将工艺实例转换为BPMN 2.0 XML
 */
function convertToBPMN(
  processName: string,
  nodes: NodeInstance[],
  edges: EdgeInstance[]
): string {
  const bpmn = {
    definitions: {
      '@xmlns': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
      '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@xmlns:mes': 'http://mes.example.com/schema',
      '@id': `Definitions_${uuid()}`,
      '@targetNamespace': 'http://bpmn.io/schema/bpmn',
      process: {
        '@id': `Process_${uuid()}`,
        '@name': processName,
        '@isExecutable': 'true',
        
        // 开始事件
        startEvent: {
          '@id': 'StartEvent_1',
          '@name': '开始',
          outgoing: 'Flow_1'
        },
        
        // 任务节点
        task: nodes.map(node => ({
          '@id': node.id,
          '@name': node.name,
          '@mes:templateNodeId': node.templateNodeId,
          extensionElements: {
            'mes:parameters': {
              'mes:parameter': node.parameters.map(param => ({
                '@name': param.name,
                '@inherited': String(!param.isOverridden),
                '#text': param.currentValue
              }))
            }
          },
          incoming: edges.filter(e => e.targetId === node.id).map(e => e.id),
          outgoing: edges.filter(e => e.sourceId === node.id).map(e => e.id)
        })),
        
        // 结束事件
        endEvent: {
          '@id': 'EndEvent_1',
          '@name': '结束',
          incoming: `Flow_${edges.length + 1}`
        },
        
        // 连线
        sequenceFlow: edges.map(edge => ({
          '@id': edge.id,
          '@sourceRef': edge.sourceId,
          '@targetRef': edge.targetId,
          '@name': edge.condition || undefined
        }))
      }
    }
  };
  
  // 转换为XML
  return jsonToXml(bpmn);
}
```

---

## 5. API 设计

### 5.1 研发工艺 API

```yaml
# 研发工艺管理
POST   /api/recipes                    # 创建研发工艺
GET    /api/recipes                    # 获取工艺列表
GET    /api/recipes/:id                # 获取工艺详情
PUT    /api/recipes/:id                # 更新工艺
DELETE /api/recipes/:id                # 删除工艺
POST   /api/recipes/:id/publish        # 发布版本
GET    /api/recipes/:id/versions       # 获取版本历史

# 工艺组管理
POST   /api/recipes/:id/groups         # 创建工艺组
PUT    /api/groups/:id                 # 更新工艺组
DELETE /api/groups/:id                 # 删除工艺组

# 节点管理
POST   /api/recipes/:id/nodes          # 创建节点
PUT    /api/nodes/:id                  # 更新节点
DELETE /api/nodes/:id                  # 删除节点

# 连线管理
POST   /api/recipes/:id/edges          # 创建连线
PUT    /api/edges/:id                  # 更新连线
DELETE /api/edges/:id                  # 删除连线

# 跨组引用
POST   /api/recipes/:id/references     # 创建跨组引用
DELETE /api/references/:id             # 删除引用
```

### 5.2 生产工艺 API

```yaml
# 生产工艺管理
POST   /api/instances                  # 从模板生成实例
GET    /api/instances                  # 获取实例列表
GET    /api/instances/:id              # 获取实例详情
PUT    /api/instances/:id              # 更新实例
DELETE /api/instances/:id              # 删除实例

# 参数管理
PUT    /api/instances/:id/parameters   # 批量更新参数
POST   /api/instances/:id/reset        # 重置为模板值

# BPMN导出
GET    /api/instances/:id/bpmn         # 导出BPMN XML
POST   /api/bpmn/validate              # 验证BPMN
POST   /api/bpmn/import                # 导入BPMN
```

---

## 6. 部署架构

```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    environment:
      - API_URL=http://backend:3000

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/mes_workflow
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=mes_workflow
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 7. 开发计划

### Phase 1: 基础架构 (2周)
- [ ] 项目初始化（前端+后端）
- [ ] 数据库设计与迁移
- [ ] 基础API框架搭建
- [ ] 前端路由与布局

### Phase 2: 研发工艺编辑器 (3周)
- [ ] 图画布组件（ReactFlow集成）
- [ ] 节点创建与编辑
- [ ] 连线功能
- [ ] 工艺分组管理
- [ ] 跨组引用功能
- [ ] 节点参数配置

### Phase 3: 生产工艺生成器 (2周)
- [ ] 引用模板功能
- [ ] 工艺拆分算法
- [ ] 参数实例化
- [ ] BPMN导出功能

### Phase 4: 完善与优化 (1周)
- [ ] UI/UX优化
- [ ] 性能优化
- [ ] 测试与Bug修复
- [ ] 文档完善

---

## 8. 技术选型理由

### 8.1 前端
- **ReactFlow**: 成熟的React图编辑库，支持自定义节点、连线、分组
- **Zustand**: 轻量级状态管理，适合复杂图状态
- **Ant Design**: 企业级UI组件库，支持国际化

### 8.2 后端
- **NestJS**: 模块化架构，支持TypeScript，适合大型项目
- **Prisma**: 类型安全的ORM，支持复杂查询
- **PostgreSQL**: 关系型数据库，支持JSON字段和复杂关联

### 8.3 BPMN
- **bpmn-js**: BPMN标准实现，支持导入导出和验证

---

## 9. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| BPMN 2.0规范复杂 | 高 | 中 | 使用成熟库bpmn-js，充分测试 |
| 大量节点性能问题 | 中 | 中 | 虚拟滚动、懒加载、Web Worker |
| 跨组引用同步复杂 | 中 | 高 | 完善的单元测试，事务处理 |
| 用户学习成本 | 中 | 高 | 提供操作引导、示例模板 |

---

## 10. 附录

### 10.1 参考资源
- [BPMN 2.0 Specification](https://www.omg.org/spec/BPMN/2.0/)
- [ReactFlow Documentation](https://reactflow.dev/)
- [bpmn-js Examples](https://github.com/bpmn-io/bpmn-js-examples)

### 10.2 变更历史
| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0 | 2026-03-16 | 初始版本 | AI Assistant |
