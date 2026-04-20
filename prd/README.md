# PRD 目录说明

这个目录承接智能巡检系统 V2 的新版 PRD 重构结果。

## 目录角色
- `需求总览.md`
  - 作为总览 PRD，承接产品定位、范围边界、角色权限、共享实体、状态字典、指标口径和页面地图
  - 当前作为 `/prd` 下的总览入口使用
- `modules/*.md`
  - 页面级 PRD、模块索引和共享上下文文档
  - 当前作为 `/prd/modules/*.md` 的正式页面 PRD 使用
- `reviews/*.md`
  - `prd-review` 产出的核查报告，记录两轮 review 结果和问题收敛情况

## 适用规则
- 页面 PRD 默认按前端路由拆分
- 同一路由下的 tab 视为同一页面
- 摄像头中心属于多子路由域，因此允许有一份索引/共享上下文文档，再加四份页面 PRD
- 共享实体、全局状态和全局权限不在模块文件重复定义，统一引用 `需求总览.md`

## 当前模块清单
- `auth-login.md`
- `dashboard-overview.md`
- `dashboards-config.md`
- `strategies-center.md`
- `cameras-索引.md`
- `cameras-devices.md`
- `cameras-monitoring.md`
- `cameras-media.md`
- `cameras-diagnostics.md`
- `alerts-center.md`
- `jobs-center.md`
- `records-center.md`
- `feedback-center.md`
- `settings-model-system.md`
- `users-and-permissions.md`
- `audit-logs.md`
- `local-detector.md`

## 使用方式
1. 先读 `需求总览.md`
2. 再读目标页面对应的模块文件
3. 如果是摄像头域，先读 `cameras-索引.md`
4. 如果要判断结构完整性和代码一致性，继续读 `reviews/`
