#!/bin/bash
# PyCharm 运行脚本 - 强制使用 arm64 架构
# 将此脚本配置为 PyCharm 的外部工具或运行配置

cd "$(dirname "$0")"
arch -arm64 venv/bin/python main.py
