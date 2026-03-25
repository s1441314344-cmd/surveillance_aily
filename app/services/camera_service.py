import random
import time
import os
import cv2
import pyautogui
from app.config import config

class CameraService:
    @staticmethod
    def capture_from_stream(link, path):
        """链接摄像头视频流，截取视频帧数"""
        # 支持本地摄像头索引（0/1/2...）和 RTSP/文件链接
        source = link
        if isinstance(link, str):
            stripped = link.strip()
            if stripped.isdigit():
                source = int(stripped)

        if isinstance(source, int):
            # macOS 优先使用 AVFoundation，本地摄像头兼容性更好
            video = cv2.VideoCapture(source, cv2.CAP_AVFOUNDATION)
            if not video.isOpened():
                video.release()
                video = cv2.VideoCapture(source)
        else:
            video = cv2.VideoCapture(source)

        if not video.isOpened():
            print(f"Failed to open video source: {link}")
            video.release()
            return None

        # 读取帧（预热多次，避免首帧为空）
        ret, frame = False, None
        for _ in range(20):
            ret, frame = video.read()
            if ret and frame is not None:
                break
            time.sleep(0.05)

        # 生成文件名
        random_num = random.randint(0, 1000000)
        r = str(time.time()) + str(random_num)
        
        # 确保目录存在
        os.makedirs(path, exist_ok=True)
        
        filename = os.path.join(path, 'screenshot_{}.png'.format(r))
        is_written = False

        # 逆光场景自动提亮，避免抓拍全黑/过暗
        if ret and frame is not None:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            mean_luma = cv2.mean(gray)[0]
            _, max_luma, _, _ = cv2.minMaxLoc(gray)
            if mean_luma < 45 and max_luma > 180:
                frame = cv2.convertScaleAbs(frame, alpha=2.2, beta=20)
        
        if ret:
            is_written = cv2.imwrite(filename, frame)
            print(f"Captured: {filename}")
        else:
            print(f"Failed to read video frame from {link}")
            
        # 释放视频对象
        video.release()

        return filename if is_written else None

    @staticmethod
    def capture_fullscreen(path=None, region=None):
        """截取屏幕"""
        if path is None:
            path = config.save_path
            
        # 确保保存目录存在
        os.makedirs(path, exist_ok=True)
        
        # 截取
        try:
            if region is None:
                screenshot = pyautogui.screenshot()
            else:
                screenshot = pyautogui.screenshot(region=region)
        except Exception as e:
            print(f"Screenshot failed: {e}")
            return None

        # 生成文件名
        random_num = random.randint(0, 1000000)
        r = str(time.time()) + str(random_num)
        name = os.path.join(path, 'screenshot_{}.png'.format(r))

        # 保存截图
        screenshot.save(name)

        return name

    @staticmethod
    def record_screen(duration, path=None, region=None, fps=20):
        """录制屏幕视频
        
        Args:
            duration (int): 录制时长(秒)
            path (str): 保存路径
            region (tuple): 录制区域 (left, top, width, height)，默认为全屏
            fps (int): 帧率
            
        Returns:
            str: 视频文件路径
        """
        import numpy as np
        
        if path is None:
            path = config.save_path
            
        # 确保保存目录存在
        os.makedirs(path, exist_ok=True)
        
        # 获取屏幕尺寸
        screen_width, screen_height = pyautogui.size()
        
        # 确定录制区域
        if region:
            x, y, width, height = region
        else:
            x, y, width, height = 0, 0, screen_width, screen_height
            
        # 生成文件名
        random_num = random.randint(0, 1000000)
        r = str(time.time()) + str(random_num)
        filename = os.path.join(path, 'record_{}.mp4'.format(r))
        
        # 初始化视频写入器
        # 使用 mp4v 编码器
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(filename, fourcc, fps, (width, height))
        
        start_time = time.time()
        frame_count = 0
        
        try:
            while (time.time() - start_time) < duration:
                # 截取屏幕
                if region:
                    img = pyautogui.screenshot(region=region)
                else:
                    img = pyautogui.screenshot()
                
                # 转换为numpy数组
                frame = np.array(img)
                
                # RGB转BGR (OpenCV使用BGR格式)
                frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                
                # 写入视频帧
                out.write(frame)
                frame_count += 1
                
                # 控制帧率
                # 计算每帧应该消耗的时间
                expected_time = frame_count / fps
                actual_time = time.time() - start_time
                if expected_time > actual_time:
                    time.sleep(expected_time - actual_time)
                    
        except Exception as e:
            print(f"Screen recording failed: {e}")
            # 如果发生错误，释放资源并尝试删除可能损坏的文件
            out.release()
            if os.path.exists(filename):
                try:
                    os.remove(filename)
                except:
                    pass
            return None
        finally:
            out.release()
            
        print(f"Screen recording saved: {filename}")
        return filename
