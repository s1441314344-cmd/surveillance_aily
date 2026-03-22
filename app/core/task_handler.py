import time
import os
import datetime
from app.config import config
from app.services.camera_service import CameraService
from app.services.feishu_service import FeishuService
from app.services.aily_service import AilyService
from app.services.yolo_service import YoloService
from app.utils.time_utils import get_timestamp
from app.utils.image_utils import draw_lines

class TaskHandler:
    
    @staticmethod
    def _parse_hhmm(time_str):
        norm = str(time_str).strip()
        if not norm:
            return None, None
        parts = norm.split(":") if ":" in norm else [norm]
        try:
            h = int(parts[0])
        except Exception:
            return None, None
        m = 0
        if len(parts) > 1:
            try:
                m = int(parts[1])
            except Exception:
                m = 0
        if not (0 <= h <= 24) or not (0 <= m < 60):
            return None, None
        return h, m

    @staticmethod
    def _parse_duration_hours(val):
        if isinstance(val, (int, float)):
            num = float(val)
        else:
            s = str(val).strip()
            if not s:
                return None
            try:
                num = float(s)
            except Exception:
                return None
        return num if num > 0 else None

    @classmethod
    def is_work_time(cls, start_time, duration_hours):
        if start_time is None or duration_hours is None:
            # print(f"[{get_timestamp()}] 警告：缺少开始时间或工作时长，默认为非工作时间")
            return False

        now = datetime.datetime.now()
        current_time = now.time()

        try:
            start_h, start_m = cls._parse_hhmm(start_time)
            dur = cls._parse_duration_hours(duration_hours)

            if start_h is None or start_m is None or dur is None or dur <= 0:
                return False
            if dur == 24:
                return True
            if dur > 24:
                return False

            start_dt = datetime.datetime.combine(now.date(), datetime.time(hour=start_h, minute=start_m))
            end_dt = start_dt + datetime.timedelta(hours=dur)
            start_time_today = start_dt.time()
            end_time_today = end_dt.time()

            if start_time_today <= end_time_today:
                in_range = start_time_today <= current_time <= end_time_today
            else:
                in_range = current_time >= start_time_today or current_time <= end_time_today

            return in_range
        except Exception:
            return False

    @classmethod
    def _upload_image_to_bitable(cls, file_path, inspection_point_record_id):
        """完整的上传流程：上传素材 -> 查找字段 -> 创建记录"""
        token = FeishuService.get_tenant_token(config.aily_app_id, config.aily_app_secret)
        if not token:
            return False

        # 1. 上传素材
        file_token = FeishuService.upload_media(file_path, 'bitable_image', config.base_token, token)
        if not file_token:
            return False

        # 2. 查找附件字段 (简化逻辑：先尝试获取，获取不到就用默认名)
        fields_meta = FeishuService.get_table_fields(config.base_token, config.record_table_id, token)
        actual_field_name = "照片"
        if fields_meta:
            for field in fields_meta:
                if field.get('type') == 17: # 附件
                    actual_field_name = field.get('field_name')
                    break
        
        # 3. 创建记录
        payload_fields = {
            actual_field_name: [{"file_token": file_token}]
        }
        if inspection_point_record_id:
            payload_fields["巡检点位"] = [inspection_point_record_id]

        record_id = FeishuService.create_record(config.base_token, config.record_table_id, payload_fields, token)
        return record_id is not None

    @classmethod
    def screenshot_task(cls, camera):
        """普通定时截图任务"""
        # 检查工作时间
        if not cls.is_work_time(camera.start_time, camera.end_time):
            # print(f"[{get_timestamp()}] 摄像头 {camera.code} 非工作时间")
            return

        print(f"[{get_timestamp()}] 执行摄像头 {camera.code} 截图任务")
        
        filenames = []
        capture_source = config.capture_source

        # 批量截图
        for i in range(camera.count):
            if capture_source == 'screenshot':
                file_name = CameraService.capture_fullscreen()
            else:
                file_name = CameraService.capture_from_stream(camera.link, config.save_path)
            
            if file_name:
                # 绘制检测点位
                draw_lines(file_name, camera.line, mode=camera.box_mode)
                filenames.append(file_name)
            
            if camera.count > 1:
                time.sleep(camera.frequency / camera.count)

        if not filenames:
            return

        # 处理截图
        token = FeishuService.get_tenant_token(config.aily_app_id, config.aily_app_secret)
        
        if config.use_aily:
            aily_tokens = []
            for fname in filenames:
                fid = AilyService.upload_file(token, fname)
                if fid:
                    aily_tokens.append(fid)
                    # 上传成功后删除本地文件
                    if os.path.exists(fname):
                        os.remove(fname)
            
            if aily_tokens:
                print(f"[{get_timestamp()}] Aily 触发技能...")
                AilyService.run_skill(
                    config.aily_app_key, 
                    config.aily_skill_id, 
                    aily_tokens, 
                    camera.code, 
                    token,
                    base_token=config.base_token,
                    camera_table=config.camera_table_id,
                    rule_table=config.rule_table_id,
                    record_table=config.record_table_id,
                    app_id=config.aily_app_id,
                    app_secret=config.aily_app_secret
                )
        else:
            for fname in filenames:
                success = cls._upload_image_to_bitable(fname, camera.record_id)
                print(f"[{get_timestamp()}] 上传多维表格 {'成功' if success else '失败'}: {fname}")
                if success and os.path.exists(fname):
                    os.remove(fname)

    @classmethod
    def key_frame_task(cls, camera):
        """关键帧检测任务 (长期运行)"""
        print(f"[{get_timestamp()}] 启动关键帧检测任务: {camera.code}")
        capture_source = config.capture_source
        
        while True:
            try:
                # 检查工作时间
                if not cls.is_work_time(camera.start_time, camera.end_time):
                    # print(f"[{get_timestamp()}] {camera.code} 休眠中 (非工作时间)")
                    time.sleep(60) # 非工作时间休眠久一点
                    continue

                # 抓帧
                if capture_source == 'screenshot':
                    file_name = CameraService.capture_fullscreen()
                else:
                    file_name = CameraService.capture_from_stream(camera.link, config.save_path)

                if not file_name:
                    time.sleep(3)
                    continue

                # 识别
                count = YoloService.identify(file_name, camera.classes)
                print(f"[{get_timestamp()}] {camera.code} 检测目标数: {count}")

                # 状态变化判断
                if count != camera.frames_count and count != 0:
                    print(f"[{get_timestamp()}] 状态变化: {camera.frames_count} -> {count}")
                    draw_lines(file_name, camera.line, mode=camera.box_mode)
                    token = FeishuService.get_tenant_token(config.aily_app_id, config.aily_app_secret)
                    
                    if config.use_aily:
                        fid = AilyService.upload_file(token, file_name)
                        camera.frames_count = count
                        if fid:
                            AilyService.run_skill(
                                config.aily_app_key, 
                                config.aily_skill_id, 
                                [fid], 
                                camera.code, 
                                token,
                                base_token=config.base_token,
                                camera_table=config.camera_table_id,
                                rule_table=config.rule_table_id,
                                record_table=config.record_table_id,
                                app_id=config.aily_app_id,
                                app_secret=config.aily_app_secret
                            )
                            # 上传成功后删除本地文件
                            if os.path.exists(file_name):
                                os.remove(file_name)
                    else:
                        print(f"[{get_timestamp()}] 上传关键帧到多维表格")
                        camera.frames_count = count
                        success = cls._upload_image_to_bitable(file_name, camera.record_id)
                        if success and os.path.exists(file_name):
                            os.remove(file_name)
                else:
                    # 无变化或为0，删除图片
                    if os.path.exists(file_name):
                        os.remove(file_name)

                if count == 0:
                    camera.frames_count = 0

                time.sleep(3)

            except Exception as e:
                print(f"[{get_timestamp()}] 关键帧任务异常: {e}")
                time.sleep(3)
