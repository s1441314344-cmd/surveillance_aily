#!/usr/bin/env python3
"""
PyCharm 启动器 - 解决架构不匹配问题
在 PyCharm 中直接运行此文件即可启动主程序
"""
import subprocess
import sys
import os

def main():
    # 获取项目目录
    project_dir = os.path.dirname(os.path.abspath(__file__))
    main_script = os.path.join(project_dir, "main.py")
    python_executable = os.path.join(project_dir, "venv", "bin", "python")
    
    # 检查文件是否存在
    if not os.path.exists(python_executable):
        print(f"错误: 找不到 Python 解释器: {python_executable}")
        sys.exit(1)
    
    if not os.path.exists(main_script):
        print(f"错误: 找不到主程序: {main_script}")
        sys.exit(1)
    
    print("=" * 60)
    print("正在启动监控系统...")
    print(f"Python: {python_executable}")
    print(f"主程序: {main_script}")
    print("=" * 60)
    print()
    
    # 使用 arch 命令强制以 arm64 架构运行
    cmd = ["arch", "-arm64", python_executable, main_script]
    
    try:
        # 执行命令，实时输出
        process = subprocess.Popen(
            cmd,
            cwd=project_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        # 实时输出日志
        for line in process.stdout:
            print(line, end='')
        
        # 等待进程结束
        process.wait()
        sys.exit(process.returncode)
        
    except KeyboardInterrupt:
        print("\n\n正在停止程序...")
        process.terminate()
        process.wait()
        sys.exit(0)
    except Exception as e:
        print(f"\n错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
