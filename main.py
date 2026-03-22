import sys
import os
import platform
import subprocess

# 检查架构 - 如果是 x86_64 但系统是 arm64，则使用 arch 命令重新启动
def check_architecture():
    """检查 Python 运行架构，如果不匹配则自动重启"""
    current_arch = platform.machine()
    
    # 检查是否已经在 arch 命令下运行（通过环境变量标记）
    if os.environ.get('RUNNING_UNDER_ARCH') == '1':
        return
    
    # 如果当前是 x86_64 但系统支持 arm64，则重新启动
    if current_arch == 'x86_64' and os.path.exists('/usr/bin/arch'):
        print(f"检测到架构不匹配: 当前 Python 是 {current_arch} 架构")
        print("正在使用 arm64 架构重新启动...")
        print("-" * 60)
        
        # 使用 arch 命令重新启动
        cmd = ['arch', '-arm64', sys.executable] + sys.argv
        env = os.environ.copy()
        env['RUNNING_UNDER_ARCH'] = '1'
        
        try:
            result = subprocess.run(cmd, env=env)
            sys.exit(result.returncode)
        except Exception as e:
            print(f"重新启动失败: {e}")
            print("请手动运行: arch -arm64 python main.py")
            sys.exit(1)
    
    # 检查是否是系统 Python（可能有兼容性问题）
    if 'Frameworks/Python.framework' in sys.executable:
        # 检查是否有虚拟环境
        venv_python = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'venv', 'bin', 'python')
        if os.path.exists(venv_python) and sys.executable != venv_python:
            print(f"检测到使用系统 Python: {sys.executable}")
            print(f"切换到虚拟环境 Python: {venv_python}")
            print("-" * 60)
            
            cmd = ['arch', '-arm64', venv_python] + sys.argv
            env = os.environ.copy()
            env['RUNNING_UNDER_ARCH'] = '1'
            
            try:
                result = subprocess.run(cmd, env=env)
                sys.exit(result.returncode)
            except Exception as e:
                print(f"切换失败: {e}")
                sys.exit(1)

check_architecture()

# 确保当前目录在 path 中
sys.path.append(os.getcwd())

from app.config import config
from app.services.feishu_service import FeishuService
from app.core.scheduler import SchedulerManager

def main():
    print("Initializing application...")
    
    # 1. 获取摄像头配置
    print("Fetching camera configurations...")
    cameras = FeishuService.batch_get_cameras(
        config.aily_app_id, 
        config.aily_app_secret, 
        config.base_token, 
        config.camera_table_id
    )
    
    if not cameras:
        print("No cameras found or failed to fetch configuration.")
        return

    # 2. 初始化调度器
    scheduler_manager = SchedulerManager()
    
    # 3. 添加任务
    scheduler_manager.add_camera_tasks(cameras)
    
    # 4. 启动
    scheduler_manager.start()

if __name__ == '__main__':
    main()
