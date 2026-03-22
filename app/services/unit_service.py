import lark_oapi as lark
from lark_oapi.api.bitable.v1 import *
from app.services.feishu_service import FeishuService

class UnitService:
    @staticmethod
    def get_units(app_id, app_secret, base_token, table_id):
        try:
            token = FeishuService.get_tenant_token(app_id, app_secret)
            if not token:
                return []

            fields = FeishuService.get_table_fields(base_token, table_id, token)
            field_names = [f.get('field_name') for f in fields]

            requested_fields = ["自动编号", "单位名称", "单位编码", "状态"]
            valid_fields = [f for f in requested_fields if f in field_names]

            if not valid_fields:
                return []

            client = lark.Client.builder() \
                .app_id(app_id) \
                .app_secret(app_secret) \
                .log_level(lark.LogLevel.INFO) \
                .build()

            request_body_builder = SearchAppTableRecordRequestBody.builder()
            request_body_builder.field_names(valid_fields)
            request_body_builder.automatic_fields(True)

            if "状态" in field_names:
                request_body_builder.filter(FilterInfo.builder()
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
                .request_body(request_body_builder.build()) \
                .build()

            response = client.bitable.v1.app_table_record.search(request)
            units = []

            if response.success() and response.data and response.data.items:
                for item in response.data.items:
                    try:
                        code = UnitService._get_field_value(item.fields, "自动编号")
                        name = UnitService._get_field_value(item.fields, "单位名称")
                        unit_code = UnitService._get_field_value(item.fields, "单位编码")
                        status = UnitService._get_field_value(item.fields, "状态")
                        record_id = item.record_id

                        if code:
                            unit = {
                                'code': str(code),
                                'name': name or unit_code or code,
                                'unit_code': unit_code,
                                'status': status,
                                'record_id': record_id
                            }
                            units.append(unit)
                    except Exception as e:
                        print(f"Error parsing unit config: {e}")

            return units

        except Exception as e:
            print(f"Get units failed: {e}")
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
    def get_unit_by_id(units, unit_id):
        for unit in units:
            if unit['code'] == unit_id or unit.get('record_id') == unit_id:
                return unit
        return None

    @staticmethod
    def get_unit_by_record_id(units, record_id):
        for unit in units:
            if unit.get('record_id') == record_id:
                return unit
        return None
