import ast
import lark_oapi as lark
from lark_oapi.api.bitable.v1 import *
from app.models.rule import Rule
from app.services.feishu_service import FeishuService

class RuleService:
    @staticmethod
    def get_rules(app_id, app_secret, base_token, table_id):
        try:
            token = FeishuService.get_tenant_token(app_id, app_secret)
            if not token:
                return []

            fields = FeishuService.get_table_fields(base_token, table_id, token)
            field_names = [f.get('field_name') for f in fields]

            requested_fields = ["自动编号", "规则编码", "场景", "Prompts", "标注", "状态"]
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
            rules = []

            if response.success() and response.data and response.data.items:
                for item in response.data.items:
                    try:
                        auto_id = RuleService._get_field_value(item.fields, "自动编号")
                        code = RuleService._get_field_value(item.fields, "规则编码") or auto_id
                        name = RuleService._get_field_value(item.fields, "场景")
                        prompts = RuleService._get_field_value(item.fields, "Prompts")
                        labeled = RuleService._get_field_value(item.fields, "标注")
                        status = RuleService._get_field_value(item.fields, "状态")
                        record_id = item.record_id

                        if code and name:
                            rule = Rule(
                                code=str(code),
                                name=name,
                                detect_type=labeled,
                                params=prompts,
                                record_id=record_id
                            )
                            rule.status = status
                            rules.append(rule)
                    except Exception as e:
                        print(f"Error parsing rule config: {e}")

            return rules

        except Exception as e:
            print(f"Get rules failed: {e}")
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
        return value

    @staticmethod
    def parse_detect_params(params_str):
        if not params_str:
            return {"classes": [], "threshold": 0.25}
        return {"classes": [], "threshold": 0.25, "prompts": params_str}

    @staticmethod
    def get_rule_by_id(rules, rule_id):
        for rule in rules:
            if rule.code == rule_id:
                return rule
        return None

    @staticmethod
    def get_rule_by_record_id(rules, record_id):
        for rule in rules:
            if rule.record_id == record_id:
                return rule
        return None