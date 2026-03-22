import json
from datetime import datetime
import requests
import lark_oapi as lark
from lark_oapi.api.bitable.v1 import *
from app.services.feishu_service import FeishuService

class RecordService:
    @staticmethod
    def get_record_id_by_field(app_token, table_id, search_field, search_value, token):
        try:
            url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/search"
            payload = json.dumps({
                "field_names": [search_field],
                "page_size": 100
            })
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}',
            }

            response = requests.post(url, headers=headers, data=payload, timeout=10)
            result = response.json()

            if result.get('code') == 0:
                items = result.get('data', {}).get('items', [])
                for item in items:
                    field_value = item.get('fields', {}).get(search_field)
                    if field_value:
                        if isinstance(field_value, str) and field_value == search_value:
                            return item.get('record_id')
                        elif isinstance(field_value, (int, float)) and str(field_value) == search_value:
                            return item.get('record_id')
            return None
        except Exception as e:
            print(f"查询记录ID失败: {e}")
            return None

    @staticmethod
    def create_detection_record(app_id, app_secret, base_token, table_id, point_code, point_name,
                                 rule_code, rule_name, detection_result, image_token, aily_result=None):
        try:
            token = FeishuService.get_tenant_token(app_id, app_secret)
            if not token:
                return None

            point_record_id = RecordService.get_record_id_by_field(
                base_token, "tblv8uMMIgItWdPl", "自动编号", point_code, token
            )
            rule_record_id = RecordService.get_record_id_by_field(
                base_token, "tblhwn2aaeDjEhpW", "规则编码", rule_code, token
            )

            fields = {}

            if point_record_id:
                fields["巡检点位"] = [point_record_id]
            if rule_record_id:
                fields["巡检规则"] = [rule_record_id]

            fields["AI 识别结论"] = str(detection_result)
            fields["AI 判定结果"] = "待复核"

            if image_token:
                fields["照片"] = [{"file_token": image_token, "type": "image"}]

            if aily_result:
                fields["Prompts"] = str(aily_result)

            record_id = FeishuService.create_record(base_token, table_id, fields, token)
            return record_id

        except Exception as e:
            print(f"Create detection record failed: {e}")
            import traceback
            traceback.print_exc()
            return None

    @staticmethod
    def update_detection_record(app_id, app_secret, base_token, table_id, record_id, fields):
        try:
            token = FeishuService.get_tenant_token(app_id, app_secret)
            if not token:
                return False

            client = lark.Client.builder() \
                .app_id(app_id) \
                .app_secret(app_secret) \
                .log_level(lark.LogLevel.INFO) \
                .build()

            request = UpdateAppTableRecordRequest.builder() \
                .app_token(base_token) \
                .table_id(table_id) \
                .record_id(record_id) \
                .user_id_type("open_id") \
                .request_body(UpdateAppTableRecordRequestBody.builder()
                    .fields(fields)
                    .build()) \
                .build()

            response = client.bitable.v1.app_table_record.update(request)
            return response.success()

        except Exception as e:
            print(f"Update detection record failed: {e}")
            return False

    @staticmethod
    def get_records(app_id, app_secret, base_token, table_id, page_size=20):
        try:
            token = FeishuService.get_tenant_token(app_id, app_secret)
            if not token:
                return []

            client = lark.Client.builder() \
                .app_id(app_id) \
                .app_secret(app_secret) \
                .log_level(lark.LogLevel.INFO) \
                .build()

            request = ListAppTableRecordRequest.builder() \
                .app_token(base_token) \
                .table_id(table_id) \
                .user_id_type("open_id") \
                .page_size(page_size) \
                .build()

            response = client.bitable.v1.app_table_record.list(request)
            records = []

            if response.success() and response.data and response.data.items:
                for item in response.data.items:
                    records.append({
                        'record_id': item.record_id,
                        'fields': item.fields
                    })

            return records

        except Exception as e:
            print(f"Get records failed: {e}")
            return []