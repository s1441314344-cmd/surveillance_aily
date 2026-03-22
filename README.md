# Surveillance Camera Aily (智能监控巡检系统)

[English Version](#surveillance-camera-aily-english) | [中文版本](#surveillance-camera-aily-中文)

---

<a name="surveillance-camera-aily-中文"></a>
## 中文版本

### 📖 项目简介
Surveillance Camera Aily 是一个智能监控巡检系统，旨在自动化处理监控摄像头的视频流数据。它通过定时截图或关键帧检测，结合 YOLOv5 目标检测模型，自动识别画面中的特定对象（如人、车等），并将处理后的数据上传至飞书多维表格或 Aily 平台，实现智能化的无人值守巡检。

### ✨ 核心特性
*   **多源抓取**：支持 RTSP 视频流截取（真实摄像头）和桌面截图（模拟测试）。
*   **智能检测**：集成 YOLOv5 模型，支持本地实时推理，自动识别画面中的关键目标（人、车、卡车等）。
*   **灵活调度**：
    *   **定时任务**：按预设频率自动截图。
    *   **关键帧任务**：持续监测画面变化，仅在检测到目标数量变动时触发上报，节省存储空间。
*   **智能上报**：
    *   **飞书集成**：自动将截图和检测结果上传至飞书多维表格。
    *   **Aily 联动**：支持将图片推送至 Aily 平台触发后续技能（如更复杂的分析）。
*   **配置灵活**：支持通过 `config.ini` 文件热更配置，无需重新编译。
*   **多平台支持**：支持 Windows、macOS 和 Linux，提供开箱即用的单文件可执行程序。

### 🛠️ 快速开始

#### 1. 环境准备
*   Python 3.12+
*   依赖库安装：
    ```bash
    pip install -r requirements.txt
    ```

#### 2. 配置文件
在运行目录下创建 `config.ini`，参考以下格式：

```ini
[aily]
app_id = cli_xxx          # 飞书应用 AppID
app_secret = xxx          # 飞书应用 Secret
use_aily = True           # 是否启用 Aily 上传 (True/False)
app = spring_xxx          # Aily App ID
skill = skill_xxx         # Aily Skill ID

[base]
token = A4mT...           # 多维表格 Token
camera_table_id = tbl...  # 摄像头配置表 ID
record_table_id = tbl...  # 巡检记录表 ID

[app]
path = ./screenshot/      # 截图保存路径
capture_source = camera   # 抓帧来源: camera (摄像头) / screenshot (屏幕截图)
```

#### 3. 运行程序
```bash
python main.py
# 或指定配置文件路径
python main.py -c /path/to/your/config.ini
```

### 📦 构建与部署
项目支持通过 PyInstaller 打包为单文件可执行程序。

**使用 GitHub Actions 自动构建**：
1. 提交代码并打上 Tag（如 `v1.0.0`）。
2. GitHub Actions 会自动触发构建，并在 Release 页面生成 Windows、macOS 和 Linux 版本的可执行文件。

**手动构建**：
```bash
# macOS/Linux
./build_scripts/build_all.sh
```

---

<a name="surveillance-camera-aily-english"></a>
## English Version

### 📖 Introduction
Surveillance Camera Aily is an intelligent surveillance inspection system designed to automate the processing of video stream data from surveillance cameras. By combining scheduled screenshots or keyframe detection with the YOLOv5 object detection model, it automatically identifies specific objects (such as people, cars, etc.) in the frame and uploads the processed data to Lark (Feishu) Base or the Aily platform, enabling intelligent unattended inspection.

### ✨ Key Features
*   **Multi-Source Capture**: Supports RTSP video stream capture (real cameras) and desktop screenshots (simulation testing).
*   **Intelligent Detection**: Integrated YOLOv5 model for local real-time inference, automatically identifying key targets in the frame.
*   **Flexible Scheduling**:
    *   **Scheduled Tasks**: Automatically capture screenshots at preset frequencies.
    *   **Keyframe Tasks**: Continuously monitor frame changes and trigger reporting only when the number of detected targets changes, saving storage space.
*   **Smart Reporting**:
    *   **Lark Integration**: Automatically upload screenshots and detection results to Lark Base.
    *   **Aily Linkage**: Support pushing images to the Aily platform to trigger subsequent skills.
*   **Flexible Configuration**: Support hot-reloading configuration via `config.ini` without recompilation.
*   **Cross-Platform**: Supports Windows, macOS, and Linux, providing out-of-the-box single-file executables.

### 🛠️ Quick Start

#### 1. Prerequisites
*   Python 3.12+
*   Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

#### 2. Configuration
Create `config.ini` in the running directory:

```ini
[aily]
app_id = cli_xxx          # Lark App ID
app_secret = xxx          # Lark App Secret
use_aily = True           # Enable Aily upload (True/False)
app = spring_xxx          # Aily App ID
skill = skill_xxx         # Aily Skill ID

[base]
token = A4mT...           # Lark Base Token
camera_table_id = tbl...  # Camera Config Table ID
record_table_id = tbl...  # Record Table ID

[app]
path = ./screenshot/      # Screenshot save path
capture_source = camera   # Source: camera / screenshot
```

#### 3. Run
```bash
python main.py
# Or specify config path
python main.py -c /path/to/your/config.ini
```

### 📦 Build & Deploy
The project supports packaging as a single-file executable via PyInstaller.

**Auto-Build with GitHub Actions**:
1. Commit code and push a Tag (e.g., `v1.0.0`).
2. GitHub Actions will automatically trigger the build and generate Windows, macOS, and Linux executables on the Release page.

**Manual Build**:
```bash
# macOS/Linux
./build_scripts/build_all.sh
```
