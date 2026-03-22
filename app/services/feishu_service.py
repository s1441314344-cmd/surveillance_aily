import os
import ast
import json
import requests
import lark_oapi as lark
from lark_oapi.api.bitable.v1 import *
from requests_toolbelt import MultipartEncoder
from app.models.camera import Camera

class FeishuService:
    @staticmethod
    def get_tenant_token(app_id, app_secret):
        url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
        payload = json.dumps({
            "app_id": app_id,
            "app_secret": app_secret
        })
        headers = {
            'Content-Type': 'application/json'
        }
        try:
            response = requests.request("POST", url, headers=headers, data=payload, timeout=10)
            if response.status_code == 200:
                return response.json().get('tenant_access_token')
            print(f"Get Tenant Token Failed: {response.text}")
        except Exception as e:
            print(f"Get Tenant Token Exception: {e}")
        return None

    @staticmethod
    def upload_media(file_path, parent_type, parent_node, token):
        try:
            file_size = os.path.getsize(file_path)
            if file_size > 20 * 1024 * 1024:
                print(f"[错误] 文件大小超过20MB限制: {file_size/1024/1024:.2f}MB")
                return None
                
            url = "https://open.feishu.cn/open-apis/drive/v1/medias/upload_all"
            # 必须用 'file' 作为 key，并且保持文件打开状态直到请求结束
            with open(file_path, 'rb') as f:
                form = {
                    'file_name': os.path.basename(file_path),
                    'parent_type': parent_type,
                    'parent_node': parent_node,
                    'size': str(file_size),
                    'file': (os.path.basename(file_path), f, 'image/png'),
                    'extra': json.dumps({"drive_route_token": parent_node}) # 注意：部分接口需要 extra
                }
                multi_form = MultipartEncoder(form)
                headers = {'Authorization': f'Bearer {token}', 'Content-Type': multi_form.content_type}
                response = requests.request("POST", url, headers=headers, data=multi_form, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('code') == 0:
                    return result['data']['file_token']
                else:
                    print(f"[错误] 上传文件失败: {result.get('msg', '未知错误')}")
            else:
                print(f"[错误] 上传文件HTTP失败: {response.status_code}, {response.text}")
        except Exception as e:
            print(f"[异常] 上传文件时发生错误: {str(e)}")
        return None

    @staticmethod
    def create_record(app_token, table_id, fields, token):
        try:
            url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records"
            payload = json.dumps({"fields": fields})
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}',
            }
            response = requests.request("POST", url, headers=headers, data=payload, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('code') == 0 and result.get('data'):
                    return result['data']['record']['record_id']
                else:
                    print(f"[错误] 创建记录失败: {result.get('msg', '未知错误')}")
            else:
                print(f"[错误] 创建记录HTTP失败: {response.status_code}, {response.text}")
        except Exception as e:
            print(f"[异常] 创建记录时发生错误: {str(e)}")
        return None

    @staticmethod
    def send_text_message(receive_id, content, receive_id_type="open_id", token=None):
        """发送文本消息通知"""
        if token is None:
            # 如果没有传入token，则需要调用者自行获取，这里简化处理，假设调用者会传入有效token
            print("[警告] send_text_message 需要传入 token")
            return
            
        url = f"https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type={receive_id_type}"
        
        payload = json.dumps({
            "receive_id": receive_id,
            "msg_type": "text",
            "content": json.dumps({"text": content})
        })
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        try:
            response = requests.post(url, headers=headers, data=payload, timeout=10)
            if response.status_code != 200:
                print(f"[警告] 发送消息失败: {response.text}")
        except Exception as e:
            print(f"[异常] 发送消息异常: {e}")
    @staticmethod
    def get_table_fields(app_token, table_id, token):
        url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/fields"
        headers = {"Authorization": f"Bearer {token}"}
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200 and response.json().get('code') == 0:
                return response.json().get('data', {}).get('items', [])
        except Exception as e:
            print(f"获取表格字段时发生异常: {str(e)}")
        return []

    @classmethod
    def batch_get_cameras(cls, app_id, app_secret, base_id, table_id, page_token=None):
        client = lark.Client.builder() \
            .app_id(app_id) \
            .app_secret(app_secret) \
            .log_level(lark.LogLevel.INFO) \
            .build()

        # Get actual fields in the table
        token = cls.get_tenant_token(app_id, app_secret)
        actual_fields = cls.get_table_fields(base_id, table_id, token)
        actual_field_names = [field.get('name') for field in actual_fields]
        
        # Filter field_names to only include existing fields
        requested_fields = ["自动编号", "link", "频率", "截取", "关键帧", "检测集", "开始时间", "工作时长", "检测点位", "框选模式"]
        valid_fields = [field for field in requested_fields if field in actual_field_names]
        
        # Build request body
        request_body_builder = SearchAppTableRecordRequestBody.builder()
        request_body_builder.field_names(valid_fields)
        request_body_builder.automatic_fields(True)
        
        # Only add filter if "状态" field exists
        if "状态" in actual_field_names:
            request_body_builder.filter(FilterInfo.builder()
                .conjunction("and")
                .conditions([Condition.builder().field_name("状态").operator("is").value(["有效"]).build()])
                .build())
        
        request = SearchAppTableRecordRequest.builder() \
            .app_token(base_id) \
            .table_id(table_id) \
            .user_id_type("open_id") \
            .page_token("" if page_token is None else page_token) \
            .page_size(500) \
            .request_body(request_body_builder.build()) \
            .build()

        response = client.bitable.v1.app_table_record.search(request)
        cameras = []

        if not response.success():
            lark.logger.error(f"Search failed: {response.code}, {response.msg}")
            return cameras

        if response.data is not None and response.data.items is not None:
            for item in response.data.items:
                try:
                    # Get field values with defaults
                    code = item.fields.get("自动编号")
                    link = item.fields.get("link")
                    frequency = item.fields.get("频率", 1)  # Default to 1 if not present
                    count = item.fields.get("截取", 1)  # Default to 1 if not present
                    key_frames = item.fields.get("关键帧", False)  # Default to False if not present
                    classes = cls._convert_classes(item.fields.get("检测集"))
                    line = ast.literal_eval(item.fields.get("检测点位")) if item.fields.get("检测点位") else []
                    box_mode = item.fields.get("框选模式", "normal")  # Default to normal if not present
                    
                    # Only create camera if we have at least code and link
                    if code and link:
                        camera = Camera(
                            code=code,
                            link=link,
                            frequency=frequency,
                            count=count,
                            key_frames=key_frames,
                            classes=classes,
                            line=line,
                            box_mode=box_mode
                        )
                        camera.record_id = item.record_id
                        camera.start_time = cls._extract_start_time(item.fields.get("开始时间"))
                        camera.end_time = cls._extract_duration(item.fields.get("工作时长"))
                        cameras.append(camera)
                    else:
                        print(f"Skipping camera without code or link: {item.fields}")
                except Exception as e:
                    print(f"Error parsing camera config: {e}")

        return cameras

    @staticmethod
    def _convert_classes(classes):
        if classes is None: return []
        class_mapping = {"人": 0, "车": 2, "卡车": 7}
        result = []
        for c in classes:
            if c in class_mapping:
                result.append(class_mapping[c])
        return result

    @staticmethod
    def _extract_start_time(value):
        if isinstance(value, list) and value:
            first = value[0]
            if isinstance(first, dict):
                return first.get('text') or first.get('value') or str(first)
        return value

    @staticmethod
    def get_tables(app_id, app_secret, app_token):
        """获取应用下的所有数据表"""
        client = lark.Client.builder() \
            .app_id(app_id) \
            .app_secret(app_secret) \
            .log_level(lark.LogLevel.INFO) \
            .build()

        request = ListAppTableRequest.builder() \
            .app_token(app_token) \
            .page_size(100) \
            .build()

        response = client.bitable.v1.app_table.list(request)
        
        if not response.success():
            lark.logger.error(f"List tables failed: {response.code}, {response.msg}")
            return []
            
        if response.data and response.data.items:
            return [{"table_id": item.table_id, "name": item.name} for item in response.data.items]
        return []

    @staticmethod
    def _extract_duration(value):
        if isinstance(value, list) and value:
            first = value[0]
            if isinstance(first, dict):
                num = first.get('number')
                if num is not None:
                    return num
                txt = first.get('text')
                return txt if txt is not None else str(first)
        return value
