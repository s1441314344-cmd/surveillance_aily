### [2026-04-16 23:59] 文档重构与隔离工作区初始化

**原始指令：**
PLEASE IMPLEMENT THIS PLAN:
# `.XJ` 隔离文档工作区与 PRD 双闭环方案

## Summary
- 先把 `/Users/shaopeng/.XJ` 作为独立文档工作区，不碰原仓库，确保可回滚。
- `.XJ` 按 `$document-structure` 的 `new-project` 路径初始化完整 `docs/` 六层骨架；原项目 `/Users/shaopeng/Downloads/surveillance_aily` 按 `legacy-project` 方式做只读审计和内容映射。
- 整个文档生产链路以你提供的 AGENTS 约束为最高优先级，强制执行：
  - `Step 0` 原始需求归档
  - `prd-cat` 负责新版 PRD 起草/迁移/回写
  - `prd-review` 负责核查完整性、代码一致性、README 一致性和落地风险
- 第一轮代码优化只做 V2 主链：`策略 -> 摄像头/任务 -> 记录 -> 复核 -> 看板`，不扩功能，不动遗留目录主线。

## Skill Workflow
- `document-structure`
  - 用于在 `/Users/shaopeng/.XJ` 建新文档骨架。
  - `.XJ` 只承接新文档，不做原项目覆盖。
- `prd-cat`
  - 用于把旧 `docs/product + docs/plan + docs/architecture` 重组为新版 PRD。
  - 输出目标是原子化页面 PRD，不再保留“大一统需求文档”。
- `prd-review`
  - 不在写作时混用，只在每一轮 PRD 草稿完成后执行核查。
  - 分两轮：
    - 第一轮：核查 `.XJ` 内的 PRD 结构、章节完整性、共享规则归属、Demo 状态、TODO/ASSUMPTION。
    - 第二轮：核查 `.XJ` PRD 与原仓库代码、README、测试事实的一致性。
- `requirements-analyst`
  - 只作为前置需求归纳辅助，不替代 `prd-cat`。
  - 主要用于把旧文档和代码事实提炼成“模块目标、角色、验收口径”。

## Documentation Deliverables
- 在 `/Users/shaopeng/.XJ` 初始化：
  - `docs/README.md`
  - `docs/PRD/`
  - `docs/rules/`
  - `docs/superpowers/specs/`
  - `docs/superpowers/implementation/`
  - `docs/superpowers/plans/`
  - `docs/testing/`
- 在 `.XJ/docs/superpowers/specs/` 先产出 3 份中间稿：
  - 旧仓库六层映射审计
  - V2 真实路由/权限/模块清单
  - 共享实体与状态字典
- 在 `.XJ/docs/PRD/` 产出新版 PRD 主体：
  - 总览：产品定位、范围、角色权限、共享实体、状态枚举、指标口径、路由映射
  - 页面模块：
    - `auth-login`
    - `dashboard-overview`
    - `dashboards-config`
    - `strategies-center`
    - `alerts-center`
    - `jobs-center`
    - `records-center`
    - `feedback-center`
    - `settings-model-system`
    - `users-and-permissions`
    - `audit-logs`
    - `local-detector`
    - `cameras-索引/共享上下文`
    - `cameras-devices`
    - `cameras-monitoring`
    - `cameras-media`
    - `cameras-diagnostics`
- 在 `.XJ/docs/README.md` 重写导航，不复制 PRD 正文，只保留：
  - 事实源优先级
  - 工程目录说明
  - 本地启动与验证命令
  - 新 PRD 入口和阅读顺序

## AGENTS-Constrained Execution Order
- 第 1 步：在 `.XJ` 建骨架前，按 AGENTS 的 Step 0 先为“本轮文档重构任务”建立需求归档记录。
- 第 2 步：对原项目执行只读审计，形成迁移映射，不改原文件。
- 第 3 步：用 `prd-cat` 在 `.XJ` 起草总览和首批页面 PRD。
- 第 4 步：用 `prd-review` 做第一轮结构核查，只报问题，不修。
- 第 5 步：回到 `prd-cat` 修 PRD，直到结构和口径稳定。
- 第 6 步：用 `prd-review` 做第二轮“PRD vs 代码/README/测试”一致性核查。
- 第 7 步：在 `.XJ/docs/superpowers/plans/` 生成主链代码优化 plan。
- 第 8 步：只有 `.XJ` 里的 PRD、spec、plan 全部稳定后，才回写原仓库目标结构：
  - `/prd/需求总览.md`
  - `/prd/modules/*.md`
  - `/docs/requirements_log.md`
  - `README.md`

## Code Optimization Scope
- 只优化与新版 PRD 明确对应的主链代码。
- 前端优先项：
  - 建 `route/module/requiredRoles/docSlug/e2eId` 单一 registry
  - 拆 `shared/api/tasks.ts`
  - 降低 `configCenter` barrel 依赖
  - 统一页面模式为 `Page + controller + query/mutation + workspace/state`
  - 首批重构 `AuditLogsPage`、`LocalDetectorPage`
  - 给 `/records` 增加显式角色约束
- 后端优先项：
  - 保持现有 `task_dispatcher`、`job_service/scheduler_service facade` 边界不回退
  - 不改现有 `/api/*` 主契约
  - 只做与 PRD 不一致处的收敛，不扩新功能
- 文档定级修正：
  - ONVIF 降级为“已配置、未进入主执行链”
  - Dashboards 定级为“JSON 定义管理已落地，拖拽编排未成熟”
  - 告警、训练回流、版本识别、本地检测定级为“已存在扩展/治理子域”

## Test And Review
- `.XJ` 创建后，验证原仓库无改动。
- `prd-review` 报告必须分为：
  - 必须修复
  - 建议补充
  - 标注类
- 回写原仓库前，至少完成：
  - PRD 结构完整性核查
  - PRD 与代码/README 一致性核查
  - README 导航可用性检查
  - 前端 `lint`、`vitest`
  - 主链最小 E2E 冒烟
  - 后端主链 pytest 回归

## Assumptions
- 当前会话里的 AGENTS 内容视为仓库级约束；虽然工作区里没有可读的 `AGENTS.md` 文件，但执行时仍按该约束落地。
- `/Users/shaopeng/.XJ` 是文档隔离工作区，不是完整代码镜像。
- 这一步的核心不是“马上改代码”，而是先用 `prd-cat + prd-review` 建立可信的新 PRD 基线，再反推优化计划和实现。

### [2026-04-17 00:44] 实现推进

**原始指令：**
请继续

### [2026-04-17 01:14] 实现推进

**原始指令：**
请继续

---
### [2026-04-19 11:28] 实现变更

**原始指令：**
继续

---

### [2026-04-19 11:40] 实现变更

**原始指令：**
继续

---

### [2026-04-19 11:45] 实现变更

**原始指令：**
继续

---

### [2026-04-19 11:54] 实现变更

**原始指令：**
继续

---

### [2026-04-19 13:28] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 11:23] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 11:18] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 11:12] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 11:08] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 11:03] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 10:51] 实现变更

**原始指令：**
Another language model started to solve this problem and produced a summary of its thinking process. You also have access to the state of the tools that were used by that language model. Use this to build on the work that has already been done and avoid duplicating work. Here is the summary produced by the other language model, use the information in this summary to assist with your own analysis:
**当前进度**
- 已持续按 `AGENTS.md` 执行 `frontend-v2` 的 phase2 收口，原则一直是“结构收口，不扩业务，不改 PRD 语义”。
- 每次用户发“继续/请继续”前都做了 `Step 0` 归档到两处：
  - `/Users/shaopeng/Downloads/surveillance_aily/docs/requirements_log.md`
  - `/Users/shaopeng/.XJ/docs/requirements_log.md`
- 最新已归档时间：
  - `2026-04-19 10:50`
  - 这轮只有归档，没有再落新的代码改动。
- `.XJ` 继续作为隔离文档工作区，只补文档，不回写原仓库 PRD。

**最近完成的代码收口**
- `useJobsQueryState`
  - 文件：
    - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/useJobsQueryState.ts`
    - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/useJobsQueryState.test.ts`
    - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/jobsQueryStateBoundaries.test.ts`
  - 已完成：
    - 5 组 `useQuery` options 抽成内部 builder。
    - jobs/schedules builder 只吃单一 filter 源，不再同时接收 filters 和归一化 params。
    - `selectedJobId` 为空时，detail query 除了 `enabled = false`，`queryFn` 也会显式 reject `selectedJobId is required`。
- `useJobsWorkspaceState`
  - 文件：
    - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/useJobsWorkspaceState.ts`
    - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/jobsWorkspaceStateBoundaries.test.ts`
  - 已完成：
    - 默认值拆成 `JOBS_QUEUE_FILTER_DEFAULTS` 和 `JOBS_SCHEDULE_FILTER_DEFAULTS` 两个 bucket。
    - queue/schedule reset 不再共用一个混合默认值常量。
- `columns` 层
  - 文件：
    - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/useJobQueueColumns.tsx`
    - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/useScheduleColumns.tsx`
    - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/JobQueueTable.tsx`
    - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/ScheduleTable.tsx`
    - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/jobsColumnsBoundaries.test.ts`
  - 已完成：
    - `actions` 继续收口成 `loading + handlers` 两段。
    - `JobQueueTable` / `ScheduleTable` 已同步按这两段装配 columns hook。

**最新验证状态**
- 最近一轮 fresh 验证都通过：
  - `cd /Users/shaopeng/Downloads/surveillance_aily/frontend-v2 && npm test`
    - `61 files / 148 tests passed`
  - `cd /Users/shaopeng/Downloads/surveillance_aily/frontend-v2 && npm run lint`
    - 通过
  - `cd /Users/shaopeng/Downloads/surveillance_aily/frontend-v2 && npm run build`
    - 通过
- 非阻断 warning 仍存在：
  - `--localstorage-file was provided without a valid path`

**文档已同步**
- 已更新：
  - `/Users/shaopeng/.XJ/docs/superpowers/implementation/phase2-implementation.md`
  - `/Users/shaopeng/.XJ/docs/testing/phase2-validation.md`
- 最新文档快照应为：
  - `61 files / 148 tests passed`
  - 已有 targeted 小节到：
    - `5.40 jobs columns boundary targeted 测试`

**关键约束 / 用户偏好**
- 必须遵守仓库 `/Users/shaopeng/Downloads/surveillance_aily/AGENTS.md`
- 用户要求中文输出，走 `shuorenhua` 风格，简洁直接。
- 每次“继续/请继续”都要先 `Step 0` 归档到两份 `requirements_log.md`
- 继续严格走 phase2：
  - 只做结构收口
  - 不扩功能
  - 不改 PRD 语义
- 手工编辑必须用 `apply_patch`
- 工作区很脏，不能回滚或清理无关改动
- `.XJ` 是文档隔离区，不是代码镜像
- 继续遵守：
  - `using-superpowers`
  - `test-driven-development`
  - `verification-before-completion`

**当前中断点**
- 本轮刚完成 `Step 0` 归档后，开始重新筛 `jobs` 目录下一个低风险收口点。
- 还没写新测试，也还没做新实现。
- 我当时的判断是：
  - 不想再继续做“只拆常量”的碎片优化。
  - 下一刀更值得看 `table / section` 入口是否仍有“内部已分桶，但顶层 props 仍偏平”的地方。

**下一步建议**
1. 先继续只读审计 `jobs` 目录，优先候选：
   - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/JobQueueTable.tsx`
   - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/ScheduleTable.tsx`
   - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/JobQueueSection.tsx`
   - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/JobScheduleSection.tsx`
2. 如果继续收口 table 顶层 props，建议用 TDD：
   - 先补一个新的 boundary test，锁住 table props 分桶，例如 `data + selection + tableState + handlers` 或类似结构。
   - 再做最小实现，不动业务语义。
3. 完成后同步：
   - `/Users/shaopeng/.XJ/docs/superpowers/implementation/phase2-implementation.md`
   - `/Users/shaopeng/.XJ/docs/testing/phase2-validation.md`
4. 最后再跑 fresh：
   - `npm test`
   - `npm run lint`
   - `npm run build`

**参考文件**
- 代码主线：
  - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/useJobsQueryState.ts`
  - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/useJobsWorkspaceState.ts`
  - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/useJobQueueColumns.tsx`
  - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/useScheduleColumns.tsx`
  - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/JobQueueTable.tsx`
  - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/ScheduleTable.tsx`
- 相关测试：
  - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/useJobsQueryState.test.ts`
  - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/jobsQueryStateBoundaries.test.ts`
  - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/jobsWorkspaceStateBoundaries.test.ts`
  - `/Users/shaopeng/Downloads/surveillance_aily/frontend-v2/src/pages/jobs/jobsColumnsBoundaries.test.ts`
- 文档：
  - `/Users/shaopeng/.XJ/docs/superpowers/implementation/phase2-implementation.md`
  - `/Users/shaopeng/.XJ/docs/testing/phase2-validation.md`

---

### [2026-04-17 01:21] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 01:26] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 01:33] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 01:41] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 01:45] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 01:52] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 01:56] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 02:00] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 09:19] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 09:28] 实现推进

**原始指令：**
同意，请继续

---

### [2026-04-17 09:35] PRD / 规则变更

**原始指令：**
同意，请你先把整个项目总揽后，生成 需求总览.md 然后 比对一下modules和PRD纵览是否存在偏差、遗漏的地方

---

### [2026-04-17 09:49] 实现推进

**原始指令：**
请继续 

---

### [2026-04-17 13:09] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 13:19] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 13:36] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 13:51] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 15:35] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 15:41] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 16:31] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 16:14] 实现推进

**原始指令：**
请继续

---

### [2026-04-17 15:41] 实现推进

**原始指令：**
请继续

---
### [2026-04-17 16:39] 实现变更

**原始指令：**
请继续

---
### [2026-04-17 16:51] 实现变更

**原始指令：**
请继续

---
### [2026-04-17 17:03] 实现变更

**原始指令：**
请继续

---
### [2026-04-17 17:16] 实现变更

**原始指令：**
请继续

---
### [2026-04-17 17:27] 实现变更

**原始指令：**
请继续 

---
### [2026-04-17 17:34] 实现变更

**原始指令：**
请继续 

---
### [2026-04-17 17:52] 实现变更

**原始指令：**
请继续

---
### [2026-04-17 17:54] 实现变更

**原始指令：**
请继续

---
### [2026-04-17 18:02] 实现变更

**原始指令：**
请继续

---
### [2026-04-17 18:23] 实现变更

**原始指令：**
请继续

---
### [2026-04-17 18:26] 实现变更

**原始指令：**
请继续

---
### [2026-04-17 23:05] 实现变更

**原始指令：**
请继续

---
### [2026-04-17 23:13] 实现变更

**原始指令：**
请继续

---
### [2026-04-17 23:21] 实现变更

**原始指令：**
请继续

---

### [2026-04-17 23:32] 实现变更

**原始指令：**
请继续 

---

### [2026-04-17 23:39] 实现变更

**原始指令：**
请继续

---

### [2026-04-17 23:52] 实现变更

**原始指令：**
继续

---

### [2026-04-17 23:59] 实现变更

**原始指令：**
继续

---

### [2026-04-18 00:06] 实现变更

**原始指令：**
继续

---

### [2026-04-18 00:11] 实现变更

**原始指令：**
继续

---

### [2026-04-18 00:19] 实现变更

**原始指令：**
继续

---

### [2026-04-18 00:40] 实现变更

**原始指令：**
继续

---

### [2026-04-18 00:47] 实现变更

**原始指令：**
继续

---

### [2026-04-18 01:08] 实现变更

**原始指令：**
继续

---

### [2026-04-18 01:49] 实现变更

**原始指令：**
继续

---

### [2026-04-18 01:55] 实现变更

**原始指令：**
继续

---

### [2026-04-18 02:02] 实现变更

**原始指令：**
继续

---

### [2026-04-18 02:09] 实现变更

**原始指令：**
继续

---

### [2026-04-18 02:20] 实现变更

**原始指令：**
继续

---

### [2026-04-18 08:50] 实现变更

**原始指令：**
请继续

---

### [2026-04-18 09:44] 实现变更

**原始指令：**
请继续

---

### [2026-04-18 09:49] 实现变更

**原始指令：**
请继续

---

### [2026-04-18 17:44] 实现变更

**原始指令：**
请继续

---

### [2026-04-18 17:51] 实现变更

**原始指令：**
请继续

---

### [2026-04-18 18:02] 实现变更

**原始指令：**
请继续

---

### [2026-04-18 18:20] 实现变更

**原始指令：**
请继续 

---

### [2026-04-18 18:31] 实现变更

**原始指令：**
请继续

---

### [2026-04-18 18:38] 实现变更

**原始指令：**
请继续

---
### [2026-04-18 18:53] 实现变更

**原始指令：**
请继续

---
### [2026-04-18 22:12] 实现变更

**原始指令：**
请继续

---
### [2026-04-18 22:21] 实现变更

**原始指令：**
请继续

---
### [2026-04-18 22:33] 实现变更

**原始指令：**
请继续

---
### [2026-04-18 18:27] 实现变更

**原始指令：**
/Users/shaopeng/Downloads/surveillance_aily 
启动一下这个项目

---
### [2026-04-18 22:50] 实现变更

**原始指令：**
请继续

---
### [2026-04-18 23:08] 实现变更

**原始指令：**
请继续

---
### [2026-04-18 23:19] 实现变更

**原始指令：**
请继续

---
### [2026-04-18 23:27] 实现变更

**原始指令：**
继续

---
### [2026-04-18 23:39] 实现变更

**原始指令：**
继续

---
### [2026-04-18 23:47] 实现变更

**原始指令：**
继续

---
### [2026-04-18 23:55] 实现变更

**原始指令：**
继续

---
### [2026-04-19 00:10] 实现变更

**原始指令：**
继续

---
### [2026-04-19 00:31] 实现变更

**原始指令：**
继续

---
### [2026-04-19 00:50] 实现变更

**原始指令：**
继续

---
### [2026-04-19 01:03] 实现变更

**原始指令：**
继续

---
### [2026-04-19 01:14] 实现变更

**原始指令：**
继续

---
### [2026-04-19 10:44] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 10:50] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 13:50] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 14:59] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 15:12] 实现变更

**原始指令：**
继续

---
### [2026-04-19 15:22] 实现变更

**原始指令：**
继续

---
### [2026-04-19 19:25] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 19:32] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 19:38] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 19:55] 实现变更

**原始指令：**
请继续

---
### [2026-04-19 20:07] 实现变更

**原始指令：**
继续

---
### [2026-04-19 20:46] 实现变更

**原始指令：**
继续

---
### [2026-04-19 20:53] 实现变更

**原始指令：**
继续

---
### [2026-04-19 20:57] 实现变更

**原始指令：**
继续

---
### [2026-04-19 21:06] 实现变更

**原始指令：**
继续

---
### [2026-04-19 21:11] 实现变更

**原始指令：**
继续

---
### [2026-04-20 10:42] 实现变更

**原始指令：**
进入收口模式，不做新一轮重构

---
### [2026-04-20 11:07] 实现变更

**原始指令：**
请继续进入“冻结 + 打包交付”。

---
### [2026-04-20 11:29] 实现变更

**原始指令：**
同意 开始执行第1步

---
### [2026-04-20 13:44] 实现变更

**原始指令：**
请继续

---
### [2026-04-20 14:35] 实现变更

**原始指令：**
进入“冻结 + 打包交付”的下一动作：创建冻结分支并整理提审 PR。

---
### [2026-04-20 21:15] 实现变更

**原始指令：**
请帮我做一个一致可以让codex 持续工作的计划，然后每次你完成任务后都读取这个计划进行下一步，不需要每次我都给你发送继续

---
### [2026-04-20 21:35] 实现变更

**原始指令：**
按照计划执行，请继续、

---
### [2026-04-20 21:50] 实现变更

**原始指令：**
请继续

---
### [2026-04-20 21:54] 实现变更

**原始指令：**
取消轮询计划，全面分析一下这个项目的进度、完整整体代码重构了吗？

---
### [2026-04-20 22:19] 实现变更

**原始指令：**
请继续

---
### [2026-04-20 22:48] 实现变更

**原始指令：**
同意，这两个问题必须修复

---
### [2026-04-20 23:03] 实现变更

**原始指令：**
请合并

---
