import os
import cv2
import base64
import tempfile
import json
from datetime import datetime
from typing import Dict, Any, Optional, List

class LocalDetectService:
    @staticmethod
    def detect_with_yolo(image_path: str, classes: List[int] = None,
                         confidence: float = 0.25) -> Dict[str, Any]:
        """
        使用YOLOv5进行目标检测

        Args:
            image_path: 图片路径
            classes: 要检测的类别列表
            confidence: 置信度阈值

        Returns:
            Dict包含检测结果
        """
        try:
            YOLO_AVAILABLE = False
            try:
                import torch
                from ultralytics import YOLO
                YOLO_AVAILABLE = True
            except ImportError:
                pass

            if not YOLO_AVAILABLE:
                import random
                return {
                    'success': True,
                    'method': 'mock',
                    'detections': [],
                    'count': 0,
                    'message': 'YOLO不可用，使用模拟模式'
                }

            model_path = 'yolov5s.pt'
            if not os.path.exists(model_path):
                model_path = os.path.join(os.path.dirname(__file__), '..', '..', 'yolov5s.pt')

            model = YOLO(model_path)
            results = model(image_path, verbose=False)

            if not results or len(results) == 0:
                return {
                    'success': True,
                    'method': 'yolo',
                    'detections': [],
                    'count': 0
                }

            result = results[0]
            boxes = result.boxes

            detections = []
            for box in boxes:
                cls_id = int(box.cls.cpu().numpy()[0])
                conf = float(box.conf.cpu().numpy()[0])

                if classes and cls_id not in classes:
                    continue
                if conf < confidence:
                    continue

                xyxy = box.xyxy.cpu().numpy()[0]
                detections.append({
                    'class_id': cls_id,
                    'class_name': result.names[cls_id],
                    'confidence': round(conf, 4),
                    'bbox': [round(x, 2) for x in xyxy]
                })

            return {
                'success': True,
                'method': 'yolo',
                'detections': detections,
                'count': len(detections)
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def detect_with_llm(
        image_path: str,
        prompt: str,
        api_key: str,
        model: str = "glm-4v-plus",
        timeout: int = 120,
        base_url: str = None,
    ) -> Dict[str, Any]:
        """
        使用智谱大模型进行图像分析

        Args:
            image_path: 图片路径
            prompt: 分析提示词
            api_key: 智谱API Key
            model: 模型名称

        Returns:
            Dict包含分析结果
        """
        from app.services.llm_service import LLMService

        result = LLMService.analyze_image(
            image_path=image_path,
            prompt=prompt,
            api_key=api_key,
            model=model,
            timeout=timeout,
            base_url=base_url,
        )

        if result.get('success'):
            return {
                'success': True,
                'method': 'llm',
                'analysis': result.get('result'),
                'raw_response': result.get('raw_response')
            }
        else:
            return {
                'success': False,
                'error': result.get('error', 'Unknown error')
            }

    @staticmethod
    def detect_with_llm_base64(
        image_base64: str,
        prompt: str,
        api_key: str,
        model: str = "glm-4v-plus",
        timeout: int = 120,
        base_url: str = None,
    ) -> Dict[str, Any]:
        """
        使用智谱大模型分析Base64编码的图片

        Args:
            image_base64: Base64编码的图片
            prompt: 分析提示词
            api_key: 智谱API Key
            model: 模型名称

        Returns:
            Dict包含分析结果
        """
        from app.services.llm_service import LLMService

        result = LLMService.analyze_image_base64(
            image_base64=image_base64,
            prompt=prompt,
            api_key=api_key,
            model=model,
            timeout=timeout,
            base_url=base_url,
        )

        if result.get('success'):
            return {
                'success': True,
                'method': 'llm',
                'analysis': result.get('result'),
                'raw_response': result.get('raw_response')
            }
        else:
            return {
                'success': False,
                'error': result.get('error', 'Unknown error')
            }

    @staticmethod
    def detect_combined(image_path: str, classes: List[int], prompt: str,
                       api_key: str, use_yolo: bool = True, use_llm: bool = True,
                       llm_model: str = "glm-4v-plus") -> Dict[str, Any]:
        """
        组合检测：先YOLO快速检测，再LLM综合分析

        Args:
            image_path: 图片路径
            classes: YOLO检测类别
            prompt: LLM分析提示词
            api_key: 智谱API Key
            use_yolo: 是否使用YOLO
            use_llm: 是否使用LLM
            llm_model: LLM模型

        Returns:
            Dict包含组合检测结果
        """
        result = {
            'success': True,
            'timestamp': datetime.now().isoformat(),
            'yolo_result': None,
            'llm_result': None,
            'combined': {}
        }

        if use_yolo:
            yolo_result = LocalDetectService.detect_with_yolo(image_path, classes)
            result['yolo_result'] = yolo_result

            if not yolo_result.get('success'):
                return {
                    'success': False,
                    'error': f"YOLO检测失败: {yolo_result.get('error')}"
                }

        if use_llm:
            context = ""
            if use_yolo and result['yolo_result']:
                yolo_data = result['yolo_result']
                if yolo_data.get('count', 0) > 0:
                    detected = [d['class_name'] for d in yolo_data.get('detections', [])]
                    context = f"YOLO已检测到: {', '.join(detected)}。"

            full_prompt = context + "\n\n" + prompt if context else prompt

            llm_result = LocalDetectService.detect_with_llm(
                image_path, full_prompt, api_key, llm_model
            )
            result['llm_result'] = llm_result

            if not llm_result.get('success'):
                return {
                    'success': False,
                    'error': f"LLM分析失败: {llm_result.get('error')}"
                }

            result['combined'] = {
                'yolo_count': result['yolo_result'].get('count', 0) if use_yolo else 0,
                'llm_analysis': llm_result.get('analysis'),
                'final_result': llm_result.get('analysis')
            }

        return result

    @staticmethod
    def detect_combined_base64(image_base64: str, classes: List[int], prompt: str,
                               api_key: str, use_yolo: bool = True, use_llm: bool = True,
                               llm_model: str = "glm-4v-plus") -> Dict[str, Any]:
        """
        组合检测（Base64输入版本）

        Args:
            image_base64: Base64编码的图片
            classes: YOLO检测类别
            prompt: LLM分析提示词
            api_key: 智谱API Key
            use_yolo: 是否使用YOLO
            use_llm: 是否使用LLM
            llm_model: LLM模型

        Returns:
            Dict包含组合检测结果
        """
        with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp:
            image_data = base64.b64decode(image_base64)
            tmp.write(image_data)
            image_path = tmp.name

        try:
            return LocalDetectService.detect_combined(
                image_path, classes, prompt, api_key,
                use_yolo, use_llm, llm_model
            )
        finally:
            if os.path.exists(image_path):
                os.remove(image_path)

    @staticmethod
    def draw_detection_results(image_path: str, detections: List[Dict],
                              output_path: str = None) -> str:
        """
        在图片上绘制检测结果

        Args:
            image_path: 原图路径
            detections: 检测结果列表
            output_path: 输出路径

        Returns:
            输出图片路径
        """
        img = cv2.imread(image_path)
        if img is None:
            return image_path

        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = f"./screenshot/detected_{timestamp}.jpg"

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        for det in detections:
            bbox = det.get('bbox', [])
            if len(bbox) >= 4:
                x1, y1, x2, y2 = map(int, bbox)
                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)

                label = f"{det.get('class_name', '')}: {det.get('confidence', 0):.2f}"
                cv2.putText(img, label, (x1, y1 - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        cv2.imwrite(output_path, img)
        return output_path

    @staticmethod
    def parse_llm_result(llm_text: str) -> Dict[str, Any]:
        """
        解析LLM返回的文本结果，提取结构化信息

        Args:
            llm_text: LLM返回的原始文本

        Returns:
            结构化的分析结果
        """
        result = {
            'has_violation': False,
            'violation_count': 0,
            'description': llm_text,
            'severity': 'normal',
            'suggestion': ''
        }

        text_lower = llm_text.lower()

        violation_words = ['异常', '违规', '问题', '不合格', '未佩戴', '未穿戴', '堵塞', '损坏', '隐患']
        safe_words = ['未发现异常', '未见异常', '无异常', '无违规', '正常']

        if any(word in text_lower for word in violation_words) and not any(
            word in text_lower for word in safe_words
        ):
            result['has_violation'] = True

        for word in ['紧急', '严重', '高危']:
            if word in text_lower:
                result['severity'] = 'high'
                break
        for word in ['一般', '中等', '普通']:
            if word in text_lower:
                result['severity'] = 'medium'
                break

        lines = [line.strip() for line in llm_text.split('\n') if line.strip()]
        for line in lines:
            if '建议' in line or '处理' in line:
                result['suggestion'] = line
                break

        if lines:
            result['summary'] = lines[0][:160]

        return result

    @staticmethod
    def parse_standard_format(llm_text: str) -> Dict[str, Any]:
        """
        解析LLM返回的标准四字段格式

        Args:
            llm_text: LLM返回的原始文本

        Returns:
            标准四字段结构: {结果, 描述, 违规原因, 总结}
        """
        result = {
            '结果': '',
            '描述': '',
            '违规原因': '无',
            '总结': ''
        }

        if not llm_text:
            return result

        llm_text = llm_text.strip()

        lines = llm_text.split('\n')
        current_field = None
        current_content = []

        field_keywords = {
            '结果': ['结果', '检测结果', '判定', '结论'],
            '描述': ['描述', '说明', '分析', '详情'],
            '违规原因': ['违规原因', '异常原因', '问题原因', '不合格原因'],
            '总结': ['总结', '评价', '结论', '建议']
        }

        for line in lines:
            line_stripped = line.strip()
            if not line_stripped:
                continue

            is_field_line = False
            for field_name, keywords in field_keywords.items():
                for keyword in keywords:
                    if line_stripped.startswith(keyword + '：') or line_stripped.startswith(keyword + ':'):
                        if current_field and current_content:
                            result[current_field] = '\n'.join(current_content).strip()
                        current_field = field_name
                        current_content = [line_stripped.split('：', 1)[-1].split(':', 1)[-1].strip()]
                        is_field_line = True
                        break
                if is_field_line:
                    break

            if not is_field_line and current_field:
                current_content.append(line_stripped)

        if current_field and current_content:
            result[current_field] = '\n'.join(current_content).strip()

        if '无' not in result['违规原因'].lower() and not result['违规原因']:
            result['违规原因'] = '无'

        text_lower = llm_text.lower()
        violation_indicators = ['异常', '违规', '问题', '不合格', '未佩戴', '未穿戴', '堵塞', '损坏', '隐患', '发现', '存在']
        safe_indicators = ['未发现异常', '未见异常', '无异常', '无违规', '正常', '通过', '合格']

        has_violation = any(indicator in text_lower for indicator in violation_indicators)
        is_safe = any(indicator in text_lower for indicator in safe_indicators)

        if has_violation and not is_safe:
            result['has_violation'] = True
        else:
            result['has_violation'] = False

        return result
