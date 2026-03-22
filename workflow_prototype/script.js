/**
 * MES 工作流编排系统 - 飞书风格
 * 支持：垂直主流程、水平并行分支、节点拖拽（鼠标+触控板）
 */

// ==================== 数据模型 ====================

const workflow = {
    nodes: []
};

let currentEditingNode = null;
let currentInsertIndex = -1;

// 拖拽状态 - 使用鼠标事件支持触控板
let draggedNode = null;
let draggedElement = null;
let dragGhost = null;
let isDragging = false;
let dragStartPos = { x: 0, y: 0 };
let dragOffset = { x: 0, y: 0 };
let dropTargetLine = null;

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
    initDefaultWorkflow();
    render();
    initGlobalDragHandlers();
});

// 初始化默认工作流
function initDefaultWorkflow() {
    workflow.nodes = [
        {
            id: 'start',
            type: 'start',
            name: '开始'
        },
        {
            id: 'task-1',
            type: 'task',
            name: '加水',
            data: {
                position: '中控技术员',
                params: [
                    { name: '加水温度', value: '100', unit: '°C' },
                    { name: '加水量', value: '500', unit: 'L' }
                ]
            }
        },
        {
            id: 'task-2',
            type: 'task',
            name: '搅拌',
            data: {
                position: '中控技术员',
                params: [
                    { name: '搅拌速度', value: '200', unit: 'rpm' }
                ]
            }
        },
        {
            id: 'end',
            type: 'end',
            name: '结束'
        }
    ];
}

// ==================== 渲染核心 ====================

function render() {
    const container = document.getElementById('nodesLayer');
    container.innerHTML = '';

    // 渲染节点列表（支持并行分支）
    renderNodeList(workflow.nodes, container);

    // 延迟渲染连线，确保DOM已更新
    setTimeout(renderConnections, 0);
}

// 渲染节点列表
function renderNodeList(nodes, container, isBranch = false) {
    nodes.forEach((node, index) => {
        if (node.type === 'parallel') {
            // 渲染并行分支容器
            renderParallelContainer(node, container);
        } else {
            // 渲染普通节点
            const nodeEl = createNodeElement(node);
            container.appendChild(nodeEl);

            // 如果不是最后一个节点或分支内的最后一个节点，渲染连接线
            if (index < nodes.length - 1) {
                const connectionEl = createConnectionElement(node.id);
                container.appendChild(connectionEl);
            }
        }
    });
}

// 渲染并行分支容器
function renderParallelContainer(parallelNode, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'parallel-container';
    wrapper.dataset.parallelId = parallelNode.id;

    // Fork 网关
    const forkEl = createNodeElement({
        id: parallelNode.forkId,
        type: 'gateway-fork',
        name: '并行开始'
    });
    wrapper.appendChild(forkEl);

    // 入口线
    const entryLine = document.createElement('div');
    entryLine.className = 'branch-entry';
    wrapper.appendChild(entryLine);

    // 分支容器
    const branchesWrapper = document.createElement('div');
    branchesWrapper.className = 'parallel-branches-wrapper';

    const branchesContainer = document.createElement('div');
    branchesContainer.className = 'parallel-branches';

    // 渲染每个分支
    parallelNode.branches.forEach((branch, branchIndex) => {
        const branchEl = document.createElement('div');
        branchEl.className = 'parallel-branch';
        branchEl.dataset.branchIndex = branchIndex;

        // 分支标签
        const labelEl = document.createElement('div');
        labelEl.className = 'branch-label';
        labelEl.textContent = `分支 ${branchIndex + 1}`;
        branchEl.appendChild(labelEl);

        // 渲染分支内的节点
        renderNodeList(branch.nodes, branchEl, true);

        branchesContainer.appendChild(branchEl);
    });

    branchesWrapper.appendChild(branchesContainer);
    wrapper.appendChild(branchesWrapper);

    // 出口线
    const exitLine = document.createElement('div');
    exitLine.className = 'branch-exit';
    wrapper.appendChild(exitLine);

    // Join 网关
    const joinEl = createNodeElement({
        id: parallelNode.joinId,
        type: 'gateway-join',
        name: '并行结束'
    });
    wrapper.appendChild(joinEl);

    container.appendChild(wrapper);

    // 并行容器后的连接线
    const connectionEl = createConnectionElement(parallelNode.joinId);
    container.appendChild(connectionEl);
}

// 创建节点元素
function createNodeElement(node) {
    const wrapper = document.createElement('div');
    wrapper.className = 'workflow-node';
    wrapper.dataset.nodeId = node.id;

    let content = '';

    switch (node.type) {
        case 'start':
            content = `<div class="node-start" data-draggable="true"></div>`;
            break;
        case 'end':
            content = `<div class="node-end" data-draggable="true"></div>`;
            break;
        case 'task':
            content = createTaskNodeHTML(node);
            break;
        case 'gateway-fork':
            content = `
                <div class="node-gateway" data-draggable="true">
                    <div class="gateway-shape">
                        <div class="gateway-icon">+</div>
                    </div>
                    <div class="gateway-label">并行开始</div>
                </div>
            `;
            break;
        case 'gateway-join':
            content = `
                <div class="node-gateway" data-draggable="true">
                    <div class="gateway-shape">
                        <div class="gateway-icon">−</div>
                    </div>
                    <div class="gateway-label">并行结束</div>
                </div>
            `;
            break;
    }

    wrapper.innerHTML = content;

    // 添加鼠标拖拽事件
    const draggableEl = wrapper.querySelector('[data-draggable="true"], .node-task');
    if (draggableEl) {
        draggableEl.addEventListener('mousedown', (e) => handleMouseDown(e, node, draggableEl));
        draggableEl.addEventListener('touchstart', (e) => handleTouchStart(e, node, draggableEl), { passive: false });
    }

    return wrapper;
}

// 创建任务节点HTML
function createTaskNodeHTML(node) {
    const params = node.data?.params || [];
    const paramsHtml = params.length > 0
        ? params.map((p, i) => `
            <tr>
                <td>${i + 1}</td>
                <td class="param-name">${p.name}</td>
                <td class="param-unit">${p.unit}</td>
                <td class="param-value">${p.value}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" style="color: #8F959E; text-align: center; padding: 12px;">暂无参数</td></tr>';

    return `
        <div class="node-task" data-task-id="${node.id}" data-draggable="true">
            <div class="task-header">
                <div class="task-icon">💧</div>
                <div class="task-title">${node.name}</div>
                <button class="task-menu" onclick="event.stopPropagation(); showNodeMenu('${node.id}')">⋯</button>
            </div>
            <div class="task-body">
                <div class="task-position">${node.data?.position || '未设置'}</div>
                <div class="task-params-title">参数配置</div>
                <table class="task-params-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">序号</th>
                            <th>参数</th>
                            <th style="width: 50px;">单位</th>
                            <th style="width: 60px;">值</th>
                        </tr>
                    </thead>
                    <tbody>${paramsHtml}</tbody>
                </table>
            </div>
            <div class="task-actions">
                <button class="btn-action" onclick="event.stopPropagation(); openEditModal('${node.id}')">编辑</button>
                <button class="btn-action delete" onclick="event.stopPropagation(); deleteNode('${node.id}')">删除</button>
            </div>
        </div>
    `;
}

// 创建连接线元素
function createConnectionElement(sourceNodeId) {
    const line = document.createElement('div');
    line.className = 'connection-line';
    line.dataset.sourceId = sourceNodeId;
    line.innerHTML = `<button class="add-node-btn" onclick="event.stopPropagation(); openAddModal('${sourceNodeId}')">+</button>`;

    return line;
}

// ==================== 鼠标/触控板拖拽功能 ====================

function initGlobalDragHandlers() {
    // 全局鼠标移动和释放事件
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
}

function handleMouseDown(e, node, element) {
    // 如果点击的是按钮，不启动拖拽
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

    e.preventDefault();
    e.stopPropagation();

    isDragging = true;
    draggedNode = node;
    draggedElement = element;

    // 记录起始位置
    dragStartPos = { x: e.clientX, y: e.clientY };

    // 计算偏移
    const rect = element.getBoundingClientRect();
    dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };

    // 添加拖拽样式
    element.classList.add('dragging');
    document.body.classList.add('dragging');

    // 创建拖拽幽灵元素
    createDragGhost(element, e.clientX, e.clientY);
}

function handleTouchStart(e, node, element) {
    // 如果触摸的是按钮，不启动拖拽
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];

    isDragging = true;
    draggedNode = node;
    draggedElement = element;

    // 记录起始位置
    dragStartPos = { x: touch.clientX, y: touch.clientY };

    // 计算偏移
    const rect = element.getBoundingClientRect();
    dragOffset = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
    };

    // 添加拖拽样式
    element.classList.add('dragging');
    document.body.classList.add('dragging');

    // 创建拖拽幽灵元素
    createDragGhost(element, touch.clientX, touch.clientY);
}

function createDragGhost(element, clientX, clientY) {
    // 创建幽灵元素
    dragGhost = element.cloneNode(true);
    dragGhost.classList.add('drag-ghost');
    dragGhost.style.position = 'fixed';
    dragGhost.style.zIndex = '9999';
    dragGhost.style.pointerEvents = 'none';
    dragGhost.style.opacity = '0.8';
    dragGhost.style.transform = 'scale(1.05)';
    dragGhost.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
    dragGhost.style.left = (clientX - dragOffset.x) + 'px';
    dragGhost.style.top = (clientY - dragOffset.y) + 'px';

    document.body.appendChild(dragGhost);
}

function handleMouseMove(e) {
    if (!isDragging || !dragGhost) return;

    e.preventDefault();

    // 更新幽灵元素位置
    dragGhost.style.left = (e.clientX - dragOffset.x) + 'px';
    dragGhost.style.top = (e.clientY - dragOffset.y) + 'px';

    // 检测悬停的连线
    detectHoverLine(e.clientX, e.clientY);
}

function handleTouchMove(e) {
    if (!isDragging || !dragGhost) return;

    e.preventDefault();

    const touch = e.touches[0];

    // 更新幽灵元素位置
    dragGhost.style.left = (touch.clientX - dragOffset.x) + 'px';
    dragGhost.style.top = (touch.clientY - dragOffset.y) + 'px';

    // 检测悬停的连线
    detectHoverLine(touch.clientX, touch.clientY);
}

function detectHoverLine(x, y) {
    // 清除之前的高亮
    document.querySelectorAll('.connection-line').forEach(line => {
        line.classList.remove('drag-over');
    });

    // 查找悬停的连线
    const lines = document.querySelectorAll('.connection-line');
    for (const line of lines) {
        const rect = line.getBoundingClientRect();
        // 扩大检测区域，方便放置
        if (x >= rect.left - 20 && x <= rect.right + 20 &&
            y >= rect.top - 20 && y <= rect.bottom + 20) {
            line.classList.add('drag-over');
            dropTargetLine = line;
            return;
        }
    }

    dropTargetLine = null;
}

function handleMouseUp(e) {
    if (!isDragging) return;

    finishDrag();
}

function handleTouchEnd(e) {
    if (!isDragging) return;

    finishDrag();
}

function finishDrag() {
    isDragging = false;

    // 移除拖拽样式
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
    }
    document.body.classList.remove('dragging');

    // 移除幽灵元素
    if (dragGhost) {
        dragGhost.remove();
        dragGhost = null;
    }

    // 处理放置
    if (dropTargetLine && draggedNode) {
        const targetNodeId = dropTargetLine.dataset.sourceId;
        executeMove(draggedNode.id, targetNodeId);
    }

    // 清除高亮
    document.querySelectorAll('.connection-line').forEach(line => {
        line.classList.remove('drag-over');
    });

    draggedNode = null;
    draggedElement = null;
    dropTargetLine = null;
}

function executeMove(sourceNodeId, targetNodeId) {
    console.log('Moving', sourceNodeId, 'to after', targetNodeId);

    // 不能拖拽到相同节点
    if (sourceNodeId === targetNodeId) return;

    // 找到源节点索引
    const sourceIndex = findNodeIndex(sourceNodeId);
    if (sourceIndex === -1) return;

    // 找到目标位置（目标节点的索引）
    const targetIndex = findNodeIndex(targetNodeId);
    if (targetIndex === -1) return;

    console.log('Moving from index', sourceIndex, 'to after index', targetIndex);

    // 移动节点到目标节点之后
    moveNode(sourceIndex, targetIndex);
}

// 查找节点索引
function findNodeIndex(nodeId) {
    for (let i = 0; i < workflow.nodes.length; i++) {
        const node = workflow.nodes[i];
        if (node.id === nodeId) return i;

        // 检查并行分支内的节点
        if (node.type === 'parallel') {
            for (let branch of node.branches) {
                const branchIndex = branch.nodes.findIndex(n => n.id === nodeId);
                if (branchIndex !== -1) return { parallelIndex: i, branchIndex };
            }
        }
    }
    return -1;
}

// 移动节点
function moveNode(fromIndex, toIndex) {
    console.log('moveNode called:', fromIndex, '->', toIndex);

    // 简化处理：只支持主流程内的移动
    if (typeof fromIndex === 'object' || typeof toIndex === 'object') {
        console.log('Cannot move: complex index');
        return;
    }

    // 确保索引有效
    if (fromIndex < 0 || fromIndex >= workflow.nodes.length) {
        console.log('Invalid fromIndex');
        return;
    }
    if (toIndex < 0 || toIndex >= workflow.nodes.length) {
        console.log('Invalid toIndex');
        return;
    }

    // 不能移动开始和结束节点
    const movedNode = workflow.nodes[fromIndex];
    if (movedNode.type === 'start' || movedNode.type === 'end') {
        alert('开始和结束节点不能移动');
        return;
    }

    // 移除节点
    workflow.nodes.splice(fromIndex, 1);

    // 重新计算目标索引（因为已经移除了一个元素）
    let newToIndex = toIndex;
    if (fromIndex < toIndex) {
        newToIndex = toIndex - 1;
    }

    // 确保目标索引在有效范围内
    newToIndex = Math.max(1, Math.min(newToIndex, workflow.nodes.length - 1));

    console.log('Inserting at:', newToIndex);

    // 插入到新位置
    workflow.nodes.splice(newToIndex + 1, 0, movedNode);

    console.log('New order:', workflow.nodes.map(n => n.id));

    render();
}

// ==================== SVG 连线渲染 ====================

function renderConnections() {
    const svg = document.getElementById('svgLayer');
    const defs = svg.querySelector('defs');
    svg.innerHTML = '';
    if (defs) svg.appendChild(defs);

    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();

    // 收集所有需要连线的节点对
    const connections = collectConnections();

    connections.forEach(conn => {
        const sourceEl = document.querySelector(`[data-node-id="${conn.source}"] .node-start, [data-node-id="${conn.source}"] .node-task, [data-node-id="${conn.source}"] .node-gateway`);
        const targetEl = document.querySelector(`[data-node-id="${conn.target}"] .node-end, [data-node-id="${conn.target}"] .node-task, [data-node-id="${conn.target}"] .node-gateway`);

        if (!sourceEl || !targetEl) return;

        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        // 计算相对于canvas的坐标
        const startX = sourceRect.left + sourceRect.width / 2 - canvasRect.left;
        const startY = sourceRect.bottom - canvasRect.top;
        const endX = targetRect.left + targetRect.width / 2 - canvasRect.left;
        const endY = targetRect.top - canvasRect.top;

        // 创建贝塞尔曲线路径
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        const controlY1 = startY + (endY - startY) * 0.5;
        const controlY2 = endY - (endY - startY) * 0.5;

        const d = `M ${startX} ${startY} C ${startX} ${controlY1}, ${endX} ${controlY2}, ${endX} ${endY}`;

        path.setAttribute('d', d);
        path.setAttribute('stroke', '#DEE0E3');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#arrow)');

        svg.appendChild(path);
    });
}

// 收集所有连接
function collectConnections() {
    const connections = [];

    for (let i = 0; i < workflow.nodes.length - 1; i++) {
        const current = workflow.nodes[i];
        const next = workflow.nodes[i + 1];

        if (current.type === 'parallel') {
            // 并行分支的连接
            connections.push({ source: current.forkId, target: next.id });

            // 分支内部连接
            current.branches.forEach(branch => {
                if (branch.nodes.length > 0) {
                    // Fork 到第一个节点
                    connections.push({ source: current.forkId, target: branch.nodes[0].id });

                    // 分支内节点连接
                    for (let j = 0; j < branch.nodes.length - 1; j++) {
                        connections.push({ source: branch.nodes[j].id, target: branch.nodes[j + 1].id });
                    }

                    // 最后一个节点到 Join
                    connections.push({ source: branch.nodes[branch.nodes.length - 1].id, target: current.joinId });
                }
            });
        } else {
            connections.push({ source: current.id, target: next.id });
        }
    }

    return connections;
}

// ==================== 节点操作 ====================

// 打开添加节点弹窗
function openAddModal(nodeId) {
    // 找到节点在主流程中的位置
    const index = workflow.nodes.findIndex(n => n.id === nodeId);
    currentInsertIndex = index;
    document.getElementById('addNodeModal').classList.add('active');
}

// 关闭添加节点弹窗
function closeAddModal() {
    document.getElementById('addNodeModal').classList.remove('active');
    currentInsertIndex = -1;
}

// 添加节点
function addNodeOfType(type) {
    if (currentInsertIndex < 0) return;

    const insertIndex = currentInsertIndex + 1;

    if (type === 'task') {
        const newNode = {
            id: `task-${Date.now()}`,
            type: 'task',
            name: '新任务',
            data: {
                position: '中控技术员',
                params: []
            }
        };
        workflow.nodes.splice(insertIndex, 0, newNode);
    } else if (type === 'parallel') {
        // 添加并行分支结构
        const timestamp = Date.now();
        const parallelNode = {
            id: `parallel-${timestamp}`,
            type: 'parallel',
            forkId: `fork-${timestamp}`,
            joinId: `join-${timestamp}`,
            branches: [
                {
                    id: `branch-${timestamp}-1`,
                    nodes: [
                        {
                            id: `task-${timestamp}-1`,
                            type: 'task',
                            name: '分支任务1',
                            data: { position: '操作工', params: [] }
                        }
                    ]
                },
                {
                    id: `branch-${timestamp}-2`,
                    nodes: [
                        {
                            id: `task-${timestamp}-2`,
                            type: 'task',
                            name: '分支任务2',
                            data: { position: '操作工', params: [] }
                        }
                    ]
                }
            ]
        };

        workflow.nodes.splice(insertIndex, 0, parallelNode);
    }

    closeAddModal();
    render();
}

// 打开编辑弹窗
function openEditModal(nodeId) {
    // 查找节点（包括并行分支内的节点）
    let node = null;

    for (const n of workflow.nodes) {
        if (n.id === nodeId) {
            node = n;
            break;
        }
        if (n.type === 'parallel') {
            for (const branch of n.branches) {
                const found = branch.nodes.find(bn => bn.id === nodeId);
                if (found) {
                    node = found;
                    break;
                }
            }
        }
        if (node) break;
    }

    if (!node || node.type !== 'task') return;

    currentEditingNode = nodeId;

    document.getElementById('editNodeName').value = node.name;
    document.getElementById('editNodePosition').value = node.data?.position || '中控技术员';

    const paramsList = document.getElementById('editParamsList');
    paramsList.innerHTML = '';

    if (node.data?.params && node.data.params.length > 0) {
        node.data.params.forEach(param => {
            addEditParamRow(param.name, param.value, param.unit);
        });
    }

    document.getElementById('editNodeModal').classList.add('active');
}

// 关闭编辑弹窗
function closeEditModal() {
    document.getElementById('editNodeModal').classList.remove('active');
    currentEditingNode = null;
}

// 添加参数编辑行
function addEditParamRow(name = '', value = '', unit = '') {
    const container = document.getElementById('editParamsList');
    const row = document.createElement('div');
    row.className = 'param-edit-row';
    row.innerHTML = `
        <input type="text" placeholder="参数名" class="param-name" value="${name}">
        <input type="text" placeholder="值" class="param-value" value="${value}">
        <input type="text" placeholder="单位" class="param-unit" value="${unit}">
        <button class="btn-remove-param" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(row);
}

// 添加参数
function addEditParam() {
    addEditParamRow();
}

// 保存节点编辑
function saveNodeEdit() {
    // 查找节点
    let node = null;
    for (const n of workflow.nodes) {
        if (n.id === currentEditingNode) {
            node = n;
            break;
        }
        if (n.type === 'parallel') {
            for (const branch of n.branches) {
                const found = branch.nodes.find(bn => bn.id === currentEditingNode);
                if (found) {
                    node = found;
                    break;
                }
            }
        }
        if (node) break;
    }

    if (!node) return;

    node.name = document.getElementById('editNodeName').value;
    if (!node.data) node.data = {};
    node.data.position = document.getElementById('editNodePosition').value;

    const params = [];
    document.querySelectorAll('.param-edit-row').forEach(row => {
        const name = row.querySelector('.param-name').value;
        const value = row.querySelector('.param-value').value;
        const unit = row.querySelector('.param-unit').value;
        if (name) params.push({ name, value, unit });
    });
    node.data.params = params;

    closeEditModal();
    render();
}

// 删除节点
function deleteNode(nodeId) {
    if (!confirm('确定要删除这个节点吗？')) return;

    // 查找并删除节点
    const index = workflow.nodes.findIndex(n => n.id === nodeId);
    if (index !== -1) {
        const node = workflow.nodes[index];
        if (node.type === 'start' || node.type === 'end') {
            alert('开始和结束节点不能删除');
            return;
        }
        workflow.nodes.splice(index, 1);
        render();
        return;
    }

    // 查找并行分支内的节点
    for (const n of workflow.nodes) {
        if (n.type === 'parallel') {
            for (const branch of n.branches) {
                const branchIndex = branch.nodes.findIndex(bn => bn.id === nodeId);
                if (branchIndex !== -1) {
                    branch.nodes.splice(branchIndex, 1);
                    render();
                    return;
                }
            }
        }
    }
}

// 显示节点菜单
function showNodeMenu(nodeId) {
    // 可以扩展为右键菜单
    console.log('菜单:', nodeId);
}

// ==================== 工具栏功能 ====================

function resetWorkflow() {
    if (!confirm('确定要重置工作流吗？所有修改将丢失。')) return;
    initDefaultWorkflow();
    render();
}

function saveWorkflow() {
    const data = JSON.stringify(workflow, null, 2);
    console.log('工作流数据:', data);
    alert('工作流已保存！');
}

// 窗口大小改变时重新渲染连线
window.addEventListener('resize', () => {
    setTimeout(renderConnections, 100);
});
