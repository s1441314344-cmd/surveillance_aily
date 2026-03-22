import json
import os
from typing import Optional, Dict, Any, List

class PromptTemplate:
    def __init__(self, code: str, name: str, content: str, 
                 scene: str = None, labels: List[str] = None,
                 record_id: str = None):
        self.code = code
        self.name = name
        self.content = content
        self.scene = scene
        self.labels = labels or []
        self.record_id = record_id

    def to_dict(self):
        return {
            'code': self.code,
            'name': self.name,
            'content': self.content,
            'scene': self.scene,
            'labels': self.labels,
            'record_id': self.record_id
        }

    @staticmethod
    def from_dict(data: Dict) -> 'PromptTemplate':
        return PromptTemplate(
            code=data.get('code', ''),
            name=data.get('name', ''),
            content=data.get('content', ''),
            scene=data.get('scene'),
            labels=data.get('labels', []),
            record_id=data.get('record_id')
        )


class PromptService:
    PROMPTS_FILE = './data/prompts.json'

    @staticmethod
    def _ensure_data_dir():
        os.makedirs('./data', exist_ok=True)

    @staticmethod
    def load_prompts() -> List[PromptTemplate]:
        """从本地文件加载提示词模板"""
        if not os.path.exists(PromptService.PROMPTS_FILE):
            return PromptService._get_default_prompts()

        try:
            with open(PromptService.PROMPTS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return [PromptTemplate.from_dict(p) for p in data]
        except Exception as e:
            print(f"[PromptService] 加载提示词失败: {e}")
            return PromptService._get_default_prompts()

    @staticmethod
    def save_prompts(prompts: List[PromptTemplate]) -> bool:
        """保存提示词模板到本地文件"""
        try:
            PromptService._ensure_data_dir()
            with open(PromptService.PROMPTS_FILE, 'w', encoding='utf-8') as f:
                data = [p.to_dict() for p in prompts]
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"[PromptService] 保存提示词失败: {e}")
            return False

    @staticmethod
    def get_prompt_by_code(code: str) -> Optional[PromptTemplate]:
        """根据code获取提示词模板"""
        prompts = PromptService.load_prompts()
        for p in prompts:
            if p.code == code:
                return p
        return None

    @staticmethod
    def get_prompt_by_scene(scene: str) -> Optional[PromptTemplate]:
        """根据场景获取提示词模板"""
        prompts = PromptService.load_prompts()
        for p in prompts:
            if p.scene == scene:
                return p
        return None

    @staticmethod
    def create_prompt(code: str, name: str, content: str,
                     scene: str = None, labels: List[str] = None) -> bool:
        """创建新的提示词模板"""
        prompts = PromptService.load_prompts()

        if any(p.code == code for p in prompts):
            return False

        prompt = PromptTemplate(
            code=code,
            name=name,
            content=content,
            scene=scene,
            labels=labels
        )
        prompts.append(prompt)
        return PromptService.save_prompts(prompts)

    @staticmethod
    def update_prompt(code: str, name: str = None, content: str = None,
                     scene: str = None, labels: List[str] = None) -> bool:
        """更新提示词模板"""
        prompts = PromptService.load_prompts()

        for p in prompts:
            if p.code == code:
                if name is not None:
                    p.name = name
                if content is not None:
                    p.content = content
                if scene is not None:
                    p.scene = scene
                if labels is not None:
                    p.labels = labels
                return PromptService.save_prompts(prompts)

        return False

    @staticmethod
    def delete_prompt(code: str) -> bool:
        """删除提示词模板"""
        prompts = PromptService.load_prompts()
        original_count = len(prompts)
        prompts = [p for p in prompts if p.code != code]

        if len(prompts) < original_count:
            return PromptService.save_prompts(prompts)
        return False

    @staticmethod
    def sync_from_feishu(rules: List) -> int:
        """
        从飞书规则同步提示词到本地

        Args:
            rules: 从RuleService获取的规则列表

        Returns:
            同步的规则数量
        """
        prompts = PromptService.load_prompts()
        existing_codes = {p.code for p in prompts}
        synced_count = 0

        for rule in rules:
            if rule.code not in existing_codes:
                prompt = PromptTemplate(
                    code=rule.code,
                    name=rule.name,
                    content=rule.params or PromptService._get_default_prompt_content(rule.name),
                    scene=rule.detect_type,
                    labels=[],
                    record_id=rule.record_id
                )
                prompts.append(prompt)
                synced_count += 1

        if synced_count > 0:
            PromptService.save_prompts(prompts)

        return synced_count

    @staticmethod
    def _get_default_prompt_content(scene_name: str = None) -> str:
        """获取默认提示词内容"""
        if scene_name:
            return f"""请分析这张图片中是否存在{scene_name}相关的问题。

请仔细观察图片内容，并按以下格式回复：
1. 是否检测到异常：是/否
2. 检测到的具体内容：[详细描述]
3. 置信度：高/中/低
4. 建议：[处理建议]"""
        else:
            return """请分析这张图片。

请仔细观察图片内容，并按以下格式回复：
1. 图片描述：[简要描述图片内容]
2. 检测到的目标：[列出检测到的目标]
3. 异常情况：[是否有异常]
4. 建议：[处理建议]"""

    @staticmethod
    def _get_default_prompts() -> List[PromptTemplate]:
        """获取默认提示词模板"""
        return [
            PromptTemplate(
                code="safety_helmet",
                name="安全帽检测",
                content="""请分析这张图片，重点检查是否存在以下违规行为：
1. 人员未佩戴安全帽
2. 安全帽佩戴不规范

请仔细观察图片中所有人员，并按以下格式回复：
- 检测结果：是/否 存在违规
- 违规人数：X人
- 具体情况：[详细描述]
- 建议：[处理建议]""",
                scene="安全帽检测",
                labels=["安全", "违规", "防护用品"]
            ),
            PromptTemplate(
                code="fire_safety",
                name="消防安全检查",
                content="""请分析这张图片，检查消防设施和消防安全情况：
1. 消防器材是否完好
2. 疏散通道是否畅通
3. 是否有易燃物违规堆放
4. 消防标识是否清晰

请按以下格式回复：
- 总体评价：正常/异常
- 问题列表：[列出发现的问题]
- 紧急程度：紧急/一般
- 建议：[处理建议]""",
                scene="消防检查",
                labels=["消防", "安全", "设施"]
            ),
            PromptTemplate(
                code="equipment_status",
                name="设备状态检查",
                content="""请分析这张图片，检查设备运行状态：
1. 设备外观是否正常
2. 设备运行指示灯状态
3. 是否有异常声响或振动迹象
4. 周边环境是否整洁

请按以下格式回复：
- 设备状态：正常/异常/待检修
- 具体问题：[描述问题]
- 维护建议：[建议]""",
                scene="设备检查",
                labels=["设备", "运维", "状态"]
            )
        ]

    @staticmethod
    def build_analysis_prompt(rule_name: str, point_name: str = None,
                             extra_context: str = None) -> str:
        """
        构建完整的分析提示词

        Args:
            rule_name: 规则名称
            point_name: 点位名称
            extra_context: 额外上下文

        Returns:
            完整的提示词
        """
        base_prompt = PromptService._get_default_prompt_content(rule_name)

        if point_name:
            base_prompt = f"【检测点位】{point_name}\n\n{base_prompt}"

        if extra_context:
            base_prompt = f"{base_prompt}\n\n【额外信息】\n{extra_context}"

        return base_prompt