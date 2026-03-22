from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.events import EVENT_JOB_MISSED, EVENT_JOB_MAX_INSTANCES, EVENT_JOB_ERROR
from app.core.task_handler import TaskHandler
from app.utils.time_utils import get_timestamp
from app.services.feishu_service import FeishuService
from app.config import config

class SchedulerManager:
    def __init__(self, max_workers=50): # 增加线程池大小
        executors = {
            'default': ThreadPoolExecutor(max_workers)
        }
        self.scheduler = BlockingScheduler(executors=executors)
        # 添加监听器
        self.scheduler.add_listener(self._job_listener, EVENT_JOB_MISSED | EVENT_JOB_MAX_INSTANCES | EVENT_JOB_ERROR)

    def _job_listener(self, event):
        """监听任务异常事件并发送通知"""
        if event.exception:
            print(f"[{get_timestamp()}] Job crashed: {event.job_id}")
            msg = f"监控任务异常: {event.job_id} 发生错误"
        elif event.code == EVENT_JOB_MISSED:
            print(f"[{get_timestamp()}] Job missed: {event.job_id}")
            # missed 可能很频繁，视情况通知，这里先记录日志
            return 
        elif event.code == EVENT_JOB_MAX_INSTANCES:
            print(f"[{get_timestamp()}] Job max instances reached: {event.job_id}")
            msg = f"监控告警: {event.job_id} 任务堆积超过上限，请检查网络或调整频率"
        else:
            return

        # 发送飞书通知（需要一个默认的接收人，这里暂时只打印，或者从配置读取）
        # 由于我们没有存储管理员ID，这里假设有一个配置或者硬编码的通知对象
        # 实际项目中建议将管理员ID放入配置文件
        # token = FeishuService.get_tenant_token(config.aily_app_id, config.aily_app_secret)
        # FeishuService.send_text_message("ou_xxx", msg, token=token)
        print(f"Notification: {msg}")

    def add_camera_tasks(self, cameras):
        print(f"[{get_timestamp()}] Adding tasks for {len(cameras)} cameras...")
        for camera in cameras:
            if camera.key_frames == "开启":
                print(f"[{get_timestamp()}] Adding KeyFrame task for {camera.code}")
                self.scheduler.add_job(
                    TaskHandler.key_frame_task,
                    "date",
                    args=[camera],
                    id=f"keyframe_{camera.code}",
                    max_instances=10, # 增加并发实例限制
                    coalesce=True # 允许合并执行
                )
            else:
                print(f"[{get_timestamp()}] Adding Interval task for {camera.code} (every {camera.frequency}s)")
                self.scheduler.add_job(
                    TaskHandler.screenshot_task,
                    "interval",
                    seconds=camera.frequency,
                    args=[camera],
                    id=f"screenshot_{camera.code}",
                    max_instances=10, # 增加并发实例限制
                    coalesce=True, # 允许合并执行
                    misfire_grace_time=300
                )

    def start(self):
        print(f"[{get_timestamp()}] Scheduler starting...")
        try:
            self.scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            pass
