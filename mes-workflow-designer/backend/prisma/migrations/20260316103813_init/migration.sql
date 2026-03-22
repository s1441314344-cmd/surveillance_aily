-- CreateTable
CREATE TABLE "RecipeTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "RecipeVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "changelog" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "RecipeVersion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "RecipeTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#1890ff',
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "width" REAL NOT NULL DEFAULT 300,
    "height" REAL NOT NULL DEFAULT 200,
    "isCollapsed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ProcessGroup_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "RecipeTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'task',
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "isReference" BOOLEAN NOT NULL DEFAULT false,
    "refNodeId" TEXT,
    "refGroupId" TEXT,
    CONSTRAINT "ProcessNode_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "RecipeTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessNode_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProcessGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NodeParameter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "value" TEXT,
    "unit" TEXT,
    "options" TEXT,
    "min" REAL,
    "max" REAL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "NodeParameter_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "ProcessNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'intra-group',
    "style" TEXT NOT NULL DEFAULT 'solid',
    "condition" TEXT,
    CONSTRAINT "ProcessEdge_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "RecipeTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProcessNode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProcessEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "ProcessNode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "RecipeInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RecipeTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bpmnXml" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProcessInstance_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "RecipeInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NodeInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "templateNodeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "positionX" REAL NOT NULL,
    "positionY" REAL NOT NULL,
    CONSTRAINT "NodeInstance_processId_fkey" FOREIGN KEY ("processId") REFERENCES "ProcessInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParameterInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeInstanceId" TEXT NOT NULL,
    "templateParamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inheritedValue" TEXT,
    "currentValue" TEXT,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "unit" TEXT,
    CONSTRAINT "ParameterInstance_nodeInstanceId_fkey" FOREIGN KEY ("nodeInstanceId") REFERENCES "NodeInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EdgeInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "condition" TEXT,
    CONSTRAINT "EdgeInstance_processId_fkey" FOREIGN KEY ("processId") REFERENCES "ProcessInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'rd_engineer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "RecipeTemplate_status_idx" ON "RecipeTemplate"("status");

-- CreateIndex
CREATE INDEX "RecipeTemplate_createdAt_idx" ON "RecipeTemplate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersion_recipeId_version_key" ON "RecipeVersion"("recipeId", "version");

-- CreateIndex
CREATE INDEX "ProcessGroup_recipeId_idx" ON "ProcessGroup"("recipeId");

-- CreateIndex
CREATE INDEX "ProcessNode_recipeId_idx" ON "ProcessNode"("recipeId");

-- CreateIndex
CREATE INDEX "ProcessNode_groupId_idx" ON "ProcessNode"("groupId");

-- CreateIndex
CREATE INDEX "NodeParameter_nodeId_idx" ON "NodeParameter"("nodeId");

-- CreateIndex
CREATE INDEX "ProcessEdge_recipeId_idx" ON "ProcessEdge"("recipeId");

-- CreateIndex
CREATE INDEX "ProcessEdge_sourceId_idx" ON "ProcessEdge"("sourceId");

-- CreateIndex
CREATE INDEX "ProcessEdge_targetId_idx" ON "ProcessEdge"("targetId");

-- CreateIndex
CREATE INDEX "RecipeInstance_templateId_idx" ON "RecipeInstance"("templateId");

-- CreateIndex
CREATE INDEX "RecipeInstance_status_idx" ON "RecipeInstance"("status");

-- CreateIndex
CREATE INDEX "ProcessInstance_instanceId_idx" ON "ProcessInstance"("instanceId");

-- CreateIndex
CREATE INDEX "NodeInstance_processId_idx" ON "NodeInstance"("processId");

-- CreateIndex
CREATE INDEX "ParameterInstance_nodeInstanceId_idx" ON "ParameterInstance"("nodeInstanceId");

-- CreateIndex
CREATE INDEX "EdgeInstance_processId_idx" ON "EdgeInstance"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
