import ast
import lark_oapi as lark
from lark_oapi.api.bitable.v1 import *
from app.models.point import Point
from app.services.feishu_service import FeishuService

class PointService:
    @staticmethod
    def get_points(app_id, app_secret, base_token, table_id):
        try:
            token = FeishuService.get_tenant_token(app_id, app_secret)
            if not token:
                return []

            fields = FeishuService.get_table_fields(base_token, table_id, token)
            field_names = [f.get('field_name') for f in fields]

            requested_fields = ["自动编号", "巡检点位", "link", "巡检规则", "关键帧", "频率", "检测点位", "状态", "位置"]
            valid_fields = [f for f in requested_fields if f in field_names]

            if not valid_fields:
                return []

            client = lark.Client.builder() \
                .app_id(app_id) \
                .app_secret(app_secret) \
                .log_level(lark.LogLevel.INFO) \
                .build()

            request_body = SearchAppTableRecordRequestBody.builder()
            request_body.field_names(valid_fields)
            request_body.automatic_fields(True)

            if "状态" in field_names:
                request_body.filter(FilterInfo.builder()
                    .conjunction("and")
                    .conditions([Condition.builder()
                        .field_name("状态")
                        .operator("is")
                        .value(["有效"])
                        .build()])
                    .build())

            request = SearchAppTableRecordRequest.builder() \
                .app_token(base_token) \
                .table_id(table_id) \
                .user_id_type("open_id") \
                .page_size(500) \
                .request_body(request_body.build()) \
                .build()

            response = client.bitable.v1.app_table_record.search(request)
            points = []

            if response.success() and response.data and response.data.items:
                for item in response.data.items:
                    try:
                        code = PointService._get_field_value(item.fields, "自动编号")
                        name = PointService._get_field_value(item.fields, "巡检点位")
                        link = item.fields.get("link")
                        rule_link = item.fields.get("巡检规则", {})
                        rule_record_ids = rule_link.get("link_record_ids", []) if isinstance(rule_link, dict) else []
                        location = PointService._get_field_value(item.fields, "位置")
                        key_frames = item.fields.get("关键帧", "关闭")
                        frequency = item.fields.get("频率", 30)
                        detection_points = item.fields.get("检测点位", [])
                        record_id = item.record_id

                        if code and name:
                            point = Point(
                                code=str(code),
                                name=name,
                                link=link,
                                rule_id=rule_record_ids[0] if rule_record_ids else None,
                                location=location,
                                record_id=record_id
                            )
                            point.key_frames = key_frames
                            point.frequency = frequency
                            point.detection_points = detection_points
                            points.append(point)
                    except Exception as e:
                        print(f"Error parsing point config: {e}")

            return points

        except Exception as e:
            print(f"Get points failed: {e}")
            return []

    @staticmethod
    def _get_field_value(fields, field_name):
        value = fields.get(field_name)
        if value is None:
            return None
        if isinstance(value, list) and len(value) > 0:
            first = value[0]
            if isinstance(first, dict):
                return first.get('text') or first.get('value') or str(first)
            return str(first)
        if isinstance(value, str):
            return value
        return value

    @staticmethod
    def get_point_by_id(points, point_id):
        for point in points:
            if point.code == point_id:
                return point
        return None

    @staticmethod
    def get_point_by_record_id(points, record_id):
        for point in points:
            if point.record_id == record_id:
                return point
        return None