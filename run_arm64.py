#!/usr/bin/env python3
"""
启动脚本 - 强制使用 arm64 架构运行主程序
用于解决 PyCharm 中架构不匹配的问题
"""
import subprocess
import sys
import os

def main():
    # 获取当前脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    main_script = os.path.join(script_dir, "main.py")
    python_executable = os.path.join(script_dir, "venv", "bin", "python")
    
    # 使用 arch 命令强制以 arm64 架构运行
    cmd = ["arch", "-arm64", python_executable, main_script]
    
    print(f"正在使用 arm64 架构启动程序...")
    print(f"命令: {' '.join(cmd)}")
    print("-" * 50)
    
    # 执行命令
    result = subprocess.run(cmd, cwd=script_dir)
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
