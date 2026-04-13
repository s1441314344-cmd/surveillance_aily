# 智能巡检系统 V2 Pre-merge Checklist 流程接入说明

文档定位: V2主线  
事实基线日期: 2026-04-13  
默认发布入口: `make v2-release-gate-final`  
是否允许旁路: 否（如需旁路，必须提供 reason + 产物标记）  
替代/被替代关系: 补充 `docs/plan/智能巡检系统_V2_文档状态头规范与提交流程检查清单_2026-04-13.md`  
Owner: Thread D2（P2治理）+ Supervisor

---

## 1. 目的与边界

本说明只负责把波次1已经定义的 `Pre-merge Checklist` 接入到实际提交流程，不重复定义新口径。

统一来源：

- `docs/plan/智能巡检系统_V2_文档状态头规范与提交流程检查清单_2026-04-13.md` 第 4 节（Checklist）
- `docs/plan/智能巡检系统_V2_文档状态头规范与提交流程检查清单_2026-04-13.md` 第 5 节（监督核查规则）

## 2. PR 模板接入说明（文档化入口）

在 PR 描述中必须新增 `Pre-merge Checklist (V2)` 区块，并原样使用波次1清单。PR 作者不得删减条目，只能补充证据。

建议 PR 描述最小结构：

```md
## 变更摘要
- 改动分类：P0 / P1 / P2
- 联调影响：无 / API / Worker / Scheduler / Frontend

## Pre-merge Checklist (V2)
- [ ] 改动分类已声明：P0 / P1 / P2（可多选）
- [ ] 联调影响已声明：无 / API / Worker / Scheduler / Frontend
- [ ] 验证命令与结果已给出（至少一条）
- [ ] 证据路径已给出（preflight/release-gate 摘要或测试产物）
- [ ] 若使用 bypass/override：已写明 reason，且产物有标记
- [ ] 若涉及 data 基线：已说明是否影响 release baseline fixture
- [ ] 文档标注已更新：V2主线 / 历史兼容 / 历史记录
- [ ] 未将 2026-04-04 文档当作当前事实引用
```

## 3. 提审模板接入说明

`docs/testing/智能巡检系统_V2_提审模板.md` 已接入以下必填区块：

1. `Pre-merge Checklist (V2)`（作者自检）
2. `Supervisor 校验结论`（监督者复核）

提审单与 PR 必须保持同一组事实与证据路径，不允许“PR 已勾选、提审单缺证据”的双轨不一致。

## 4. 监督校验项（Wave2 执行项）

Supervisor 在合并前必须逐项给出结论（通过/阻断）：

| Gate | 校验项 | 判定标准 |
| --- | --- | --- |
| G1 | Scope 无交叉歧义 | 本 PR 目标与线程边界一致，无越界任务 |
| G2 | Write Set 无硬冲突 | 修改文件不越出线程白名单，且不与并行线程冲突 |
| G3 | Runtime Set 无未隔离冲突 | 运行资源（端口/队列/数据目录）无抢占，或已隔离 |
| G4 | Deps 图可并行 | 依赖关系无阻塞环，不强行并行串行任务 |
| G5 | 验收命令互不依赖 | 本线程验收可独立执行，可重复复现 |
| G6 | 发布口径统一 | 涉及发布结论时，统一指向 `make v2-release-gate-final` |

阻断规则：

1. 任一 Gate 失败，PR 状态置为“需返工”。
2. 只有全部 Gate 通过，才允许“可合并”。

## 5. 流程接入后执行步骤（创建PR -> 自检 -> 监督检查 -> 合并）

1. 创建 PR：作者填写变更摘要、影响面、验证命令和证据路径，并粘贴 `Pre-merge Checklist (V2)`。
2. 自检：作者逐条勾选 Checklist，未满足项必须补证据或改为未勾选并说明原因。
3. 监督检查：Supervisor 按 G1-G6 逐项判定，输出“通过/阻断 + 备注”。
4. 合并：仅当 Checklist 完整且 G1-G6 全通过时合并；否则退回作者修订后再审。
