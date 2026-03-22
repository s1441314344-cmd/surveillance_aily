import os
import requests
import json
from requests_toolbelt import MultipartEncoder

class AilyService:
    @staticmethod
    def upload_file(token, filename):
        url = "https://open.feishu.cn/open-apis/aily/v1/files"
        payload = {}
        headers = {
            'Authorization': f'Bearer {token}'
        }

        if not os.path.exists(filename):
            print(f"File not found: {filename}")
            return None

        try:
            with open(filename, 'rb') as file_obj:
                files = [
                    ('file', (os.path.basename(filename), file_obj, 'image/jpeg'))
                ]
                response = requests.request("POST", url, headers=headers, data=payload, files=files, timeout=30)

            if response.status_code == 200:
                result = response.json()
                if result.get('code') == 0:
                    file_id = result['data']['files'][0]['id']
                    print(f"Aily Upload Success: {file_id}")
                    return file_id
                else:
                    print(f"Aily Upload Error: {result}")
            else:
                print(f"Aily Upload HTTP Error: {response.status_code} {response.text}")
        except Exception as e:
            print(f"Aily Upload Exception: {e}")
            
        return None

    @staticmethod
    def run_skill(app, skill, file_tokens, check_point, token, 
                 base_token=None, camera_table=None, rule_table=None, record_table=None, 
                 app_id=None, app_secret=None):
        if not isinstance(file_tokens, list):
            file_tokens = [file_tokens]
            
        url = f"https://open.feishu.cn/open-apis/aily/v1/apps/{app}/skills/{skill}/start"

        input_data = {
            "check_point": check_point,
        }
        
        if base_token:
            input_data["base_token"] = base_token
        if camera_table:
            input_data["camera_table"] = camera_table
        if rule_table:
            input_data["rule_table"] = rule_table
        if record_table:
            input_data["record_table"] = record_table
        if app_id:
            input_data["app_id"] = app_id
        if app_secret:
            input_data["app_secret"] = app_secret

        payload = json.dumps({
            "global_variable": {
                "files": file_tokens
            },
            "input": json.dumps(input_data),
        })
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}',
        }

        try:
            response = requests.request("POST", url, headers=headers, data=payload, timeout=10)
            print(f"[Aily] 技能触发响应: {response.status_code}")
            if response.status_code == 200:
                result = response.json()
                print(f"[Aily] 技能触发结果: {result}")
                return {'success': True, 'result': result}
            else:
                print(f"[Aily] 技能触发失败: {response.text}")
                return {'success': False, 'error': response.text}
        except requests.exceptions.Timeout:
            print("[Aily] 技能触发超时，但请求已发送")
            return {'success': True, 'timeout': True}
        except Exception as e:
            print(f"[Aily] 技能触发异常: {e}")
            return {'success': False, 'error': str(e)}
