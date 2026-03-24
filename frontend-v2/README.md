# frontend-v2

智能巡检系统 V2 前端，采用 React + TypeScript + Vite + Ant Design。

## 本地启动

```bash
npm install
npm run dev
```

默认开发端口：`5174`

## 测试与构建

```bash
npm run lint
npm run test
npm run build
```

## E2E 回归

```bash
npx playwright install chromium
npm run e2e
```

## 当前包含

- 登录、会话状态与路由守卫
- 基于角色的菜单过滤与页面级 RBAC 访问控制
- 任务中心（上传任务、摄像头单次任务、定时计划管理、队列跟踪）
- 任务记录、人工反馈、看板分析、审计日志页面
- 前端单元测试基线（Vitest）
