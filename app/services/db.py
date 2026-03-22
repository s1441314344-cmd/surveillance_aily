import csv
import io
import json
import os
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional


def utcnow_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


class Database:
    DB_PATH = "./data/surveillance.db"

    @staticmethod
    def _ensure_data_dir():
        os.makedirs("./data", exist_ok=True)

    @staticmethod
    def get_connection():
        Database._ensure_data_dir()
        conn = sqlite3.connect(Database.DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def _ensure_column(cursor, table_name: str, column_name: str, column_definition: str):
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = {row[1] for row in cursor.fetchall()}
        if column_name not in columns:
            cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")

    @staticmethod
    def init_db():
        conn = Database.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS cameras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                rtsp_url TEXT,
                location TEXT,
                frequency INTEGER DEFAULT 60,
                status TEXT DEFAULT 'active',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                scene TEXT,
                prompt_content TEXT NOT NULL,
                output_format TEXT,
                description TEXT,
                status TEXT DEFAULT 'active',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS detection_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                camera_id INTEGER,
                rule_id INTEGER NOT NULL,
                source_type TEXT DEFAULT 'upload',
                image_path TEXT,
                result_image_path TEXT,
                llm_result TEXT,
                analysis_summary TEXT,
                prompt_snapshot TEXT,
                analysis_model TEXT,
                severity TEXT DEFAULT 'normal',
                has_violation INTEGER DEFAULT 0,
                detect_time TEXT DEFAULT CURRENT_TIMESTAMP,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (camera_id) REFERENCES cameras(id),
                FOREIGN KEY (rule_id) REFERENCES rules(id)
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS inspection_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                camera_id INTEGER NOT NULL,
                rule_id INTEGER NOT NULL,
                frequency_seconds INTEGER NOT NULL,
                auto_create_work_order INTEGER DEFAULT 1,
                status TEXT DEFAULT 'active',
                last_run_time TEXT,
                next_run_time TEXT,
                last_record_id INTEGER,
                last_error TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (camera_id) REFERENCES cameras(id),
                FOREIGN KEY (rule_id) REFERENCES rules(id)
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS work_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT DEFAULT 'medium',
                assignee TEXT,
                status TEXT DEFAULT 'pending',
                processing_note TEXT,
                processing_image_path TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                closed_at TEXT,
                FOREIGN KEY (record_id) REFERENCES detection_records(id)
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS submit_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id INTEGER NOT NULL,
                model_name TEXT,
                image_path_1 TEXT NOT NULL,
                image_path_2 TEXT NOT NULL,
                llm_raw_result TEXT,
                llm_structured_result TEXT,
                status TEXT DEFAULT 'success',
                error_message TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rule_id) REFERENCES rules(id)
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS prompt_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                prompt_content TEXT NOT NULL,
                description TEXT,
                usage_count INTEGER DEFAULT 0,
                success_rate REAL DEFAULT 0,
                is_system INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pt_category ON prompt_templates(category)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pt_usage ON prompt_templates(usage_count)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pt_success ON prompt_templates(success_rate)")

        Database._ensure_column(cursor, "rules", "scene", "TEXT")
        Database._ensure_column(cursor, "rules", "output_format", "TEXT")
        Database._ensure_column(cursor, "rules", "template_id", "INTEGER")
        Database._ensure_column(cursor, "inspection_tasks", "resolution", "TEXT DEFAULT 'original'")
        Database._ensure_column(cursor, "inspection_tasks", "quality", "INTEGER DEFAULT 80")
        Database._ensure_column(cursor, "inspection_tasks", "storage_path", "TEXT")
        Database._ensure_column(cursor, "inspection_tasks", "max_frames", "INTEGER DEFAULT 1000")
        Database._ensure_column(cursor, "detection_records", "source_type", "TEXT DEFAULT 'upload'")
        Database._ensure_column(cursor, "detection_records", "analysis_summary", "TEXT")
        Database._ensure_column(cursor, "detection_records", "prompt_snapshot", "TEXT")
        Database._ensure_column(cursor, "detection_records", "analysis_model", "TEXT")
        Database._ensure_column(cursor, "detection_records", "severity", "TEXT DEFAULT 'normal'")
        Database._ensure_column(cursor, "detection_records", "structured_output", "TEXT")

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_records_camera ON detection_records(camera_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_records_rule ON detection_records(rule_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_records_time ON detection_records(detect_time)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON inspection_tasks(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_work_orders_record ON work_orders(record_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_submit_tasks_rule ON submit_tasks(rule_id)")

        conn.commit()
        conn.close()

        Database._init_default_data()
        print(f"[Database] 初始化完成: {Database.DB_PATH}")

    @staticmethod
    def _upsert_setting(cursor, key: str, value):
        cursor.execute(
            """
            INSERT INTO system_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (key, json.dumps(value, ensure_ascii=False), utcnow_text()),
        )

    @staticmethod
    def _init_default_data():
        conn = Database.get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM rules")
        if cursor.fetchone()[0] == 0:
            default_rules = [
                {
                    "code": "safety_helmet",
                    "name": "安全帽检查",
                    "scene": "施工现场 PPE 巡检",
                    "description": "识别施工现场人员是否规范佩戴安全帽。",
                    "output_format": "巡检结论、问题描述、图片证据、整改建议",
                    "prompt_content": (
                        "请分析图片中的施工人员是否佩戴安全帽、佩戴是否规范。"
                        "请按以下格式输出：1. 巡检结论；2. 发现的问题；3. 图片证据；4. 整改建议。"
                    ),
                },
                {
                    "code": "fire_safety",
                    "name": "消防通道检查",
                    "scene": "厂区消防安全巡检",
                    "description": "检查消防通道是否堵塞、消防设施是否被遮挡。",
                    "output_format": "总体状态、问题列表、风险等级、整改建议",
                    "prompt_content": (
                        "请检查图片中的消防通道、灭火器、消防栓、消防标识是否正常。"
                        "按总体状态、问题列表、风险等级、整改建议输出。"
                    ),
                },
                {
                    "code": "equipment_status",
                    "name": "设备状态检查",
                    "scene": "设备运行外观巡检",
                    "description": "检查设备外观、运行状态和周边环境。",
                    "output_format": "设备状态、异常现象、影响判断、维护建议",
                    "prompt_content": (
                        "请检查设备外观完整性、运行状态、异常堆放和环境整洁度，"
                        "并按设备状态、异常现象、影响判断、维护建议输出。"
                    ),
                },
            ]

            for rule in default_rules:
                cursor.execute(
                    """
                    INSERT INTO rules (code, name, scene, prompt_content, output_format, description)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        rule["code"],
                        rule["name"],
                        rule["scene"],
                        rule["prompt_content"],
                        rule["output_format"],
                        rule["description"],
                    ),
                )

        cursor.execute("SELECT COUNT(*) FROM cameras")
        if cursor.fetchone()[0] == 0:
            default_cameras = [
                {
                    "code": "cam_001",
                    "name": "工地门口摄像头",
                    "rtsp_url": "rtsp://example.com/stream1",
                    "location": "工地入口",
                    "frequency": 60,
                },
                {
                    "code": "cam_002",
                    "name": "车间摄像头 A",
                    "rtsp_url": "rtsp://example.com/stream2",
                    "location": "生产车间 A 区",
                    "frequency": 120,
                },
            ]
            for camera in default_cameras:
                cursor.execute(
                    """
                    INSERT INTO cameras (code, name, rtsp_url, location, frequency)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        camera["code"],
                        camera["name"],
                        camera["rtsp_url"],
                        camera["location"],
                        camera["frequency"],
                    ),
                )

        Database._upsert_setting(
            cursor,
            "system",
            {
                "auto_create_work_order": True,
                "upload_limit_mb": 20,
                "llm_timeout_seconds": 120,
            },
        )
        Database._upsert_setting(cursor, "llm", {"provider": "zhipu", "model": "glm-4v-plus"})
        Database._upsert_setting(
            cursor,
            "llm_runtime",
            {
                "provider": "zhipu",
                "model_name": "glm-4v-plus",
                "base_url": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
                "api_key": "",
            },
        )

        cursor.execute("SELECT COUNT(*) FROM prompt_templates WHERE is_system = 1")
        if cursor.fetchone()[0] == 0:
            system_templates = [
                {
                    "code": "safety_helmet",
                    "name": "安全帽检测",
                    "category": "安全",
                    "description": "检测人员安全帽佩戴规范，适用于施工现场巡检",
                    "prompt_content": (
                        "请分析图片中人员是否佩戴安全帽，佩戴是否规范。"
                        "请严格按以下四字段格式输出：\n"
                        "结果：具体的检测结果数值及状态\n"
                        "描述：对检测结果的详细说明，包括分析依据、适用场景等\n"
                        "违规原因：如存在异常或违规情况，需详细列出具体原因；若无违规，填写'无'\n"
                        "总结：对检测结果的综合评价或结论性说明"
                    ),
                    "is_system": 1,
                },
                {
                    "code": "fire_safety",
                    "name": "消防安全检查",
                    "category": "消防",
                    "description": "检查消防设施是否完好、安全通道是否畅通",
                    "prompt_content": (
                        "请检查图片中的消防通道、灭火器、消防栓、消防标识是否正常。"
                        "请严格按以下四字段格式输出：\n"
                        "结果：具体的检测结果数值及状态\n"
                        "描述：对检测结果的详细说明，包括分析依据、适用场景等\n"
                        "违规原因：如存在异常或违规情况，需详细列出具体原因；若无违规，填写'无'\n"
                        "总结：对检测结果的综合评价或结论性说明"
                    ),
                    "is_system": 1,
                },
                {
                    "code": "equipment_status",
                    "name": "设备状态检查",
                    "category": "设备",
                    "description": "检查设备外观、运行状态和周边环境",
                    "prompt_content": (
                        "请检查设备外观完整性、运行状态、异常堆放和环境整洁度。"
                        "请严格按以下四字段格式输出：\n"
                        "结果：具体的检测结果数值及状态\n"
                        "描述：对检测结果的详细说明，包括分析依据、适用场景等\n"
                        "违规原因：如存在异常或违规情况，需详细列出具体原因；若无违规，填写'无'\n"
                        "总结：对检测结果的综合评价或结论性说明"
                    ),
                    "is_system": 1,
                },
            ]
            for template in system_templates:
                cursor.execute(
                    """
                    INSERT INTO prompt_templates (code, name, category, prompt_content, description, is_system)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        template["code"],
                        template["name"],
                        template["category"],
                        template["prompt_content"],
                        template["description"],
                        template["is_system"],
                    ),
                )

        cursor.execute(
            """
            UPDATE rules
            SET scene = COALESCE(NULLIF(scene, ''), name || ' 场景'),
                output_format = COALESCE(NULLIF(output_format, ''), '巡检结论、问题描述、整改建议'),
                updated_at = CURRENT_TIMESTAMP
            WHERE scene IS NULL OR scene = '' OR output_format IS NULL OR output_format = ''
            """
        )

        cursor.execute(
            """
            UPDATE detection_records
            SET source_type = COALESCE(NULLIF(source_type, ''), 'upload'),
                severity = COALESCE(NULLIF(severity, ''), 'normal')
            WHERE source_type IS NULL OR source_type = '' OR severity IS NULL OR severity = ''
            """
        )

        conn.commit()
        conn.close()


class CameraService:
    @staticmethod
    def get_all() -> List[Dict]:
        conn = Database.get_connection()
        rows = conn.execute("SELECT * FROM cameras ORDER BY id DESC").fetchall()
        conn.close()
        return [dict(row) for row in rows]

    @staticmethod
    def get_by_id(camera_id: int) -> Optional[Dict]:
        conn = Database.get_connection()
        row = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def create(code: str, name: str, rtsp_url: str = None, location: str = None, frequency: int = 60) -> Dict:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO cameras (code, name, rtsp_url, location, frequency) VALUES (?, ?, ?, ?, ?)",
            (code, name, rtsp_url, location, frequency),
        )
        camera_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return CameraService.get_by_id(camera_id)

    @staticmethod
    def update(camera_id: int, **kwargs) -> Optional[Dict]:
        allowed_fields = {"code", "name", "rtsp_url", "location", "frequency", "status"}
        updates = {key: value for key, value in kwargs.items() if key in allowed_fields}
        if not updates:
            return CameraService.get_by_id(camera_id)

        updates["updated_at"] = utcnow_text()
        set_clause = ", ".join([f"{field} = ?" for field in updates.keys()])
        values = list(updates.values()) + [camera_id]

        conn = Database.get_connection()
        conn.execute(f"UPDATE cameras SET {set_clause} WHERE id = ?", values)
        conn.commit()
        conn.close()
        return CameraService.get_by_id(camera_id)

    @staticmethod
    def delete(camera_id: int) -> bool:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cameras WHERE id = ?", (camera_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted


class RuleService:
    @staticmethod
    def get_all() -> List[Dict]:
        conn = Database.get_connection()
        rows = conn.execute("SELECT * FROM rules ORDER BY id DESC").fetchall()
        conn.close()
        return [dict(row) for row in rows]

    @staticmethod
    def get_by_id(rule_id: int) -> Optional[Dict]:
        conn = Database.get_connection()
        row = conn.execute("SELECT * FROM rules WHERE id = ?", (rule_id,)).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def create(code: str, name: str, scene: str, prompt_content: str, output_format: str = None, description: str = None) -> Dict:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO rules (code, name, scene, prompt_content, output_format, description)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (code, name, scene, prompt_content, output_format, description),
        )
        rule_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return RuleService.get_by_id(rule_id)

    @staticmethod
    def update(rule_id: int, **kwargs) -> Optional[Dict]:
        allowed_fields = {"code", "name", "scene", "prompt_content", "output_format", "description", "status"}
        updates = {key: value for key, value in kwargs.items() if key in allowed_fields}
        if not updates:
            return RuleService.get_by_id(rule_id)

        updates["updated_at"] = utcnow_text()
        set_clause = ", ".join([f"{field} = ?" for field in updates.keys()])
        values = list(updates.values()) + [rule_id]
        conn = Database.get_connection()
        conn.execute(f"UPDATE rules SET {set_clause} WHERE id = ?", values)
        conn.commit()
        conn.close()
        return RuleService.get_by_id(rule_id)

    @staticmethod
    def delete(rule_id: int) -> bool:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM rules WHERE id = ?", (rule_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted


class RecordService:
    @staticmethod
    def _serialize_record(row) -> Dict:
        record = dict(row)
        record["has_violation"] = bool(record.get("has_violation"))
        record["has_work_order"] = bool(record.get("work_order_id"))
        if record.get("structured_output"):
            try:
                record["structured_output"] = json.loads(record["structured_output"])
            except json.JSONDecodeError:
                pass
        return record

    @staticmethod
    def get_all(
        page: int = 1,
        page_size: int = 20,
        camera_id: int = None,
        rule_id: int = None,
        work_order_status: str = None,
        start_time: str = None,
        end_time: str = None,
    ) -> Dict:
        conn = Database.get_connection()
        cursor = conn.cursor()

        where_clauses = []
        params = []

        if camera_id:
            where_clauses.append("dr.camera_id = ?")
            params.append(camera_id)
        if rule_id:
            where_clauses.append("dr.rule_id = ?")
            params.append(rule_id)
        if work_order_status:
            where_clauses.append("wo.status = ?")
            params.append(work_order_status)
        if start_time:
            where_clauses.append("dr.detect_time >= ?")
            params.append(start_time)
        if end_time:
            where_clauses.append("dr.detect_time <= ?")
            params.append(f"{end_time} 23:59:59" if len(end_time) == 10 else end_time)

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        total = cursor.execute(
            f"""
            SELECT COUNT(DISTINCT dr.id)
            FROM detection_records dr
            LEFT JOIN work_orders wo ON wo.record_id = dr.id
            WHERE {where_sql}
            """,
            params,
        ).fetchone()[0]

        offset = (page - 1) * page_size
        rows = cursor.execute(
            f"""
            SELECT dr.*, c.name AS camera_name, r.name AS rule_name, r.scene AS rule_scene,
                   wo.id AS work_order_id, wo.status AS work_order_status, wo.assignee AS work_order_assignee
            FROM detection_records dr
            LEFT JOIN cameras c ON dr.camera_id = c.id
            LEFT JOIN rules r ON dr.rule_id = r.id
            LEFT JOIN work_orders wo ON wo.record_id = dr.id
            WHERE {where_sql}
            ORDER BY dr.detect_time DESC
            LIMIT ? OFFSET ?
            """,
            params + [page_size, offset],
        ).fetchall()
        conn.close()

        return {
            "records": [RecordService._serialize_record(row) for row in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        }

    @staticmethod
    def get_by_id(record_id: int) -> Optional[Dict]:
        conn = Database.get_connection()
        row = conn.execute(
            """
            SELECT dr.*, c.name AS camera_name, r.name AS rule_name, r.scene AS rule_scene,
                   wo.id AS work_order_id, wo.status AS work_order_status, wo.assignee AS work_order_assignee
            FROM detection_records dr
            LEFT JOIN cameras c ON dr.camera_id = c.id
            LEFT JOIN rules r ON dr.rule_id = r.id
            LEFT JOIN work_orders wo ON wo.record_id = dr.id
            WHERE dr.id = ?
            """,
            (record_id,),
        ).fetchone()
        conn.close()
        return RecordService._serialize_record(row) if row else None

    @staticmethod
    def create(
        *,
        camera_id: int = None,
        rule_id: int,
        source_type: str,
        image_path: str,
        result_image_path: str = None,
        llm_result: str = None,
        analysis_summary: str = None,
        prompt_snapshot: str = None,
        analysis_model: str = None,
        severity: str = "normal",
        has_violation: bool = False,
        structured_output: str = None,
    ) -> Dict:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO detection_records
            (camera_id, rule_id, source_type, image_path, result_image_path, llm_result,
             analysis_summary, prompt_snapshot, analysis_model, severity, has_violation, structured_output)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                camera_id,
                rule_id,
                source_type,
                image_path,
                result_image_path,
                llm_result,
                analysis_summary,
                prompt_snapshot,
                analysis_model,
                severity,
                int(has_violation),
                structured_output,
            ),
        )
        record_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return RecordService.get_by_id(record_id)

    @staticmethod
    def delete(record_id: int) -> bool:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM work_orders WHERE record_id = ?", (record_id,))
        cursor.execute("DELETE FROM detection_records WHERE id = ?", (record_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted

    @staticmethod
    def export_csv(camera_id: int = None, rule_id: int = None, work_order_status: str = None, start_time: str = None, end_time: str = None) -> str:
        data = RecordService.get_all(
            page=1,
            page_size=10000,
            camera_id=camera_id,
            rule_id=rule_id,
            work_order_status=work_order_status,
            start_time=start_time,
            end_time=end_time,
        )
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "ID", "检测时间", "来源", "摄像头", "规则", "场景", "是否异常", "风险等级",
                "摘要", "模型", "工单ID", "工单状态", "处理人", "原图", "结果图",
            ]
        )
        for record in data["records"]:
            writer.writerow(
                [
                    record["id"],
                    record.get("detect_time", ""),
                    record.get("source_type", ""),
                    record.get("camera_name", ""),
                    record.get("rule_name", ""),
                    record.get("rule_scene", ""),
                    "是" if record.get("has_violation") else "否",
                    record.get("severity", ""),
                    record.get("analysis_summary", ""),
                    record.get("analysis_model", ""),
                    record.get("work_order_id", ""),
                    record.get("work_order_status", ""),
                    record.get("work_order_assignee", ""),
                    record.get("image_path", ""),
                    record.get("result_image_path", ""),
                ]
            )
        return output.getvalue()

    @staticmethod
    def get_dashboard_stats() -> Dict:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cameras = cursor.execute("SELECT COUNT(*) FROM cameras").fetchone()[0]
        rules = cursor.execute("SELECT COUNT(*) FROM rules").fetchone()[0]
        records = cursor.execute("SELECT COUNT(*) FROM detection_records").fetchone()[0]
        violations = cursor.execute("SELECT COUNT(*) FROM detection_records WHERE has_violation = 1").fetchone()[0]
        pending_work_orders = cursor.execute(
            "SELECT COUNT(*) FROM work_orders WHERE status IN ('pending', 'processing')"
        ).fetchone()[0]
        tasks = cursor.execute("SELECT COUNT(*) FROM inspection_tasks WHERE status = 'active'").fetchone()[0]
        latest = cursor.execute(
            """
            SELECT dr.*, c.name AS camera_name, r.name AS rule_name, wo.id AS work_order_id, wo.status AS work_order_status
            FROM detection_records dr
            LEFT JOIN cameras c ON dr.camera_id = c.id
            LEFT JOIN rules r ON dr.rule_id = r.id
            LEFT JOIN work_orders wo ON wo.record_id = dr.id
            ORDER BY dr.detect_time DESC
            LIMIT 5
            """
        ).fetchall()
        conn.close()
        return {
            "camera_count": cameras,
            "rule_count": rules,
            "record_count": records,
            "violation_count": violations,
            "pending_work_order_count": pending_work_orders,
            "active_task_count": tasks,
            "latest_records": [RecordService._serialize_record(row) for row in latest],
        }


class InspectionTaskService:
    @staticmethod
    def get_all() -> List[Dict]:
        conn = Database.get_connection()
        rows = conn.execute(
            """
            SELECT t.*, c.name AS camera_name, r.name AS rule_name
            FROM inspection_tasks t
            LEFT JOIN cameras c ON t.camera_id = c.id
            LEFT JOIN rules r ON t.rule_id = r.id
            ORDER BY t.id DESC
            """
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]

    @staticmethod
    def get_active() -> List[Dict]:
        conn = Database.get_connection()
        rows = conn.execute(
            """
            SELECT t.*, c.name AS camera_name, r.name AS rule_name
            FROM inspection_tasks t
            LEFT JOIN cameras c ON t.camera_id = c.id
            LEFT JOIN rules r ON t.rule_id = r.id
            WHERE t.status = 'active'
            """
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]

    @staticmethod
    def get_by_id(task_id: int) -> Optional[Dict]:
        conn = Database.get_connection()
        row = conn.execute(
            """
            SELECT t.*, c.name AS camera_name, r.name AS rule_name
            FROM inspection_tasks t
            LEFT JOIN cameras c ON t.camera_id = c.id
            LEFT JOIN rules r ON t.rule_id = r.id
            WHERE t.id = ?
            """,
            (task_id,),
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def create(
        name: str,
        camera_id: int,
        rule_id: int,
        frequency_seconds: int,
        auto_create_work_order: bool = True,
        status: str = "active",
        resolution: str = "original",
        quality: int = 80,
        storage_path: str = None,
        max_frames: int = 1000,
    ) -> Dict:
        now = datetime.now()
        next_run = now + timedelta(seconds=frequency_seconds)
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO inspection_tasks
            (name, camera_id, rule_id, frequency_seconds, auto_create_work_order, status, next_run_time,
             resolution, quality, storage_path, max_frames)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                camera_id,
                rule_id,
                frequency_seconds,
                int(auto_create_work_order),
                status,
                next_run.strftime("%Y-%m-%d %H:%M:%S"),
                resolution,
                quality,
                storage_path,
                max_frames,
            ),
        )
        task_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return InspectionTaskService.get_by_id(task_id)

    @staticmethod
    def update(task_id: int, **kwargs) -> Optional[Dict]:
        allowed_fields = {
            "name",
            "camera_id",
            "rule_id",
            "frequency_seconds",
            "auto_create_work_order",
            "status",
            "last_run_time",
            "next_run_time",
            "last_record_id",
            "last_error",
            "resolution",
            "quality",
            "storage_path",
            "max_frames",
        }
        updates = {key: value for key, value in kwargs.items() if key in allowed_fields}
        if not updates:
            return InspectionTaskService.get_by_id(task_id)
        updates["updated_at"] = utcnow_text()
        set_clause = ", ".join([f"{field} = ?" for field in updates.keys()])
        values = list(updates.values()) + [task_id]
        conn = Database.get_connection()
        conn.execute(f"UPDATE inspection_tasks SET {set_clause} WHERE id = ?", values)
        conn.commit()
        conn.close()
        return InspectionTaskService.get_by_id(task_id)

    @staticmethod
    def delete(task_id: int) -> bool:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM inspection_tasks WHERE id = ?", (task_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted


class WorkOrderService:
    @staticmethod
    def get_all(status: str = None) -> List[Dict]:
        conn = Database.get_connection()
        params = []
        where_sql = ""
        if status:
            where_sql = "WHERE wo.status = ?"
            params.append(status)
        rows = conn.execute(
            f"""
            SELECT wo.*, dr.analysis_summary, dr.detect_time, dr.camera_id, dr.rule_id,
                   c.name AS camera_name, r.name AS rule_name
            FROM work_orders wo
            LEFT JOIN detection_records dr ON dr.id = wo.record_id
            LEFT JOIN cameras c ON c.id = dr.camera_id
            LEFT JOIN rules r ON r.id = dr.rule_id
            {where_sql}
            ORDER BY wo.created_at DESC
            """,
            params,
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]

    @staticmethod
    def get_by_id(work_order_id: int) -> Optional[Dict]:
        conn = Database.get_connection()
        row = conn.execute(
            """
            SELECT wo.*, dr.analysis_summary, dr.detect_time, dr.camera_id, dr.rule_id,
                   c.name AS camera_name, r.name AS rule_name
            FROM work_orders wo
            LEFT JOIN detection_records dr ON dr.id = wo.record_id
            LEFT JOIN cameras c ON c.id = dr.camera_id
            LEFT JOIN rules r ON r.id = dr.rule_id
            WHERE wo.id = ?
            """,
            (work_order_id,),
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def get_by_record_id(record_id: int) -> Optional[Dict]:
        conn = Database.get_connection()
        row = conn.execute("SELECT * FROM work_orders WHERE record_id = ?", (record_id,)).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def create(record_id: int, title: str, description: str = None, priority: str = "medium", assignee: str = None) -> Dict:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO work_orders (record_id, title, description, priority, assignee)
            VALUES (?, ?, ?, ?, ?)
            """,
            (record_id, title, description, priority, assignee),
        )
        work_order_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return WorkOrderService.get_by_id(work_order_id)

    @staticmethod
    def update(work_order_id: int, **kwargs) -> Optional[Dict]:
        allowed_fields = {
            "title",
            "description",
            "priority",
            "assignee",
            "status",
            "processing_note",
            "processing_image_path",
            "closed_at",
        }
        updates = {key: value for key, value in kwargs.items() if key in allowed_fields}
        if not updates:
            return WorkOrderService.get_by_id(work_order_id)
        updates["updated_at"] = utcnow_text()
        set_clause = ", ".join([f"{field} = ?" for field in updates.keys()])
        values = list(updates.values()) + [work_order_id]
        conn = Database.get_connection()
        conn.execute(f"UPDATE work_orders SET {set_clause} WHERE id = ?", values)
        conn.commit()
        conn.close()
        return WorkOrderService.get_by_id(work_order_id)

    @staticmethod
    def delete(work_order_id: int) -> bool:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM work_orders WHERE id = ?", (work_order_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted


class SettingService:
    @staticmethod
    def get_all() -> Dict:
        conn = Database.get_connection()
        rows = conn.execute("SELECT key, value FROM system_settings").fetchall()
        conn.close()
        data = {}
        for row in rows:
            try:
                data[row["key"]] = json.loads(row["value"]) if row["value"] else None
            except json.JSONDecodeError:
                data[row["key"]] = row["value"]
        return data

    @staticmethod
    def get(key: str, default=None):
        conn = Database.get_connection()
        row = conn.execute("SELECT value FROM system_settings WHERE key = ?", (key,)).fetchone()
        conn.close()
        if not row:
            return default
        try:
            return json.loads(row["value"]) if row["value"] else default
        except json.JSONDecodeError:
            return row["value"]

    @staticmethod
    def set(key: str, value):
        conn = Database.get_connection()
        cursor = conn.cursor()
        Database._upsert_setting(cursor, key, value)
        conn.commit()
        conn.close()
        return SettingService.get(key)


class SubmitTaskService:
    @staticmethod
    def create(
        *,
        rule_id: int,
        model_name: str,
        image_path_1: str,
        image_path_2: str,
        llm_raw_result: str,
        llm_structured_result: Dict,
        status: str = "success",
        error_message: str = None,
    ) -> Dict:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO submit_tasks
            (rule_id, model_name, image_path_1, image_path_2, llm_raw_result, llm_structured_result, status, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rule_id,
                model_name,
                image_path_1,
                image_path_2,
                llm_raw_result,
                json.dumps(llm_structured_result, ensure_ascii=False) if llm_structured_result is not None else None,
                status,
                error_message,
            ),
        )
        task_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return SubmitTaskService.get_by_id(task_id)

    @staticmethod
    def get_by_id(task_id: int) -> Optional[Dict]:
        conn = Database.get_connection()
        row = conn.execute(
            """
            SELECT st.*, r.name AS rule_name, r.scene AS rule_scene
            FROM submit_tasks st
            LEFT JOIN rules r ON st.rule_id = r.id
            WHERE st.id = ?
            """,
            (task_id,),
        ).fetchone()
        conn.close()
        if not row:
            return None
        data = dict(row)
        if data.get("llm_structured_result"):
            try:
                data["llm_structured_result"] = json.loads(data["llm_structured_result"])
            except json.JSONDecodeError:
                pass
        return data

    @staticmethod
    def get_all(limit: int = 50) -> List[Dict]:
        conn = Database.get_connection()
        rows = conn.execute(
            """
            SELECT st.*, r.name AS rule_name, r.scene AS rule_scene
            FROM submit_tasks st
            LEFT JOIN rules r ON st.rule_id = r.id
            ORDER BY st.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        conn.close()
        results = []
        for row in rows:
            item = dict(row)
            if item.get("llm_structured_result"):
                try:
                    item["llm_structured_result"] = json.loads(item["llm_structured_result"])
                except json.JSONDecodeError:
                    pass
            results.append(item)
        return results


class PromptTemplateService:
    @staticmethod
    def get_all(
        category: str = None,
        search: str = None,
        sort: str = "name",
        order: str = "asc",
        page: int = 1,
        page_size: int = 20,
    ) -> Dict:
        conn = Database.get_connection()
        cursor = conn.cursor()

        where_clauses = ["1=1"]
        params = []

        if category:
            where_clauses.append("category = ?")
            params.append(category)
        if search:
            where_clauses.append("(name LIKE ? OR description LIKE ?)")
            params.append(f"%{search}%")
            params.append(f"%{search}%")

        where_sql = " AND ".join(where_clauses)

        total = cursor.execute(
            f"SELECT COUNT(*) FROM prompt_templates WHERE {where_sql}",
            params,
        ).fetchone()[0]

        valid_sorts = {"name", "usage_count", "success_rate", "created_at"}
        if sort not in valid_sorts:
            sort = "name"
        order = "DESC" if order.lower() == "desc" else "ASC"

        offset = (page - 1) * page_size
        rows = cursor.execute(
            f"""
            SELECT * FROM prompt_templates
            WHERE {where_sql}
            ORDER BY {sort} {order}
            LIMIT ? OFFSET ?
            """,
            params + [page_size, offset],
        ).fetchall()
        conn.close()

        return {
            "templates": [dict(row) for row in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        }

    @staticmethod
    def get_by_id(template_id: int) -> Optional[Dict]:
        conn = Database.get_connection()
        row = conn.execute("SELECT * FROM prompt_templates WHERE id = ?", (template_id,)).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def get_by_code(code: str) -> Optional[Dict]:
        conn = Database.get_connection()
        row = conn.execute("SELECT * FROM prompt_templates WHERE code = ?", (code,)).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def get_categories() -> List[str]:
        conn = Database.get_connection()
        rows = conn.execute(
            "SELECT DISTINCT category FROM prompt_templates WHERE status = 'active' ORDER BY category"
        ).fetchall()
        conn.close()
        return [row["category"] for row in rows]

    @staticmethod
    def create(
        code: str,
        name: str,
        category: str,
        prompt_content: str,
        description: str = None,
        is_system: bool = False,
    ) -> Dict:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO prompt_templates (code, name, category, prompt_content, description, is_system)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (code, name, category, prompt_content, description, int(is_system)),
        )
        template_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return PromptTemplateService.get_by_id(template_id)

    @staticmethod
    def update(template_id: int, **kwargs) -> Optional[Dict]:
        allowed_fields = {"code", "name", "category", "prompt_content", "description", "status"}
        updates = {key: value for key, value in kwargs.items() if key in allowed_fields}
        if not updates:
            return PromptTemplateService.get_by_id(template_id)

        updates["updated_at"] = utcnow_text()
        set_clause = ", ".join([f"{field} = ?" for field in updates.keys()])
        values = list(updates.values()) + [template_id]

        conn = Database.get_connection()
        conn.execute(f"UPDATE prompt_templates SET {set_clause} WHERE id = ?", values)
        conn.commit()
        conn.close()
        return PromptTemplateService.get_by_id(template_id)

    @staticmethod
    def delete(template_id: int) -> bool:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM prompt_templates WHERE id = ? AND is_system = 0", (template_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted

    @staticmethod
    def increment_usage(template_id: int) -> None:
        conn = Database.get_connection()
        conn.execute(
            "UPDATE prompt_templates SET usage_count = usage_count + 1 WHERE id = ?",
            (template_id,),
        )
        conn.commit()
        conn.close()

    @staticmethod
    def update_success_rate(template_id: int, has_violation: bool) -> None:
        conn = Database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT usage_count, success_rate FROM prompt_templates WHERE id = ?", (template_id,))
        row = cursor.fetchone()
        if row:
            current_count = row["usage_count"]
            current_rate = row["success_rate"]
            new_rate = current_rate * (current_count / (current_count + 1)) + (0 if has_violation else 100) / (current_count + 1)
            cursor.execute(
                "UPDATE prompt_templates SET success_rate = ?, usage_count = usage_count + 1 WHERE id = ?",
                (new_rate, template_id),
            )
            conn.commit()
        conn.close()

    @staticmethod
    def get_recommended(limit: int = 5) -> List[Dict]:
        conn = Database.get_connection()
        rows = conn.execute(
            """
            SELECT * FROM prompt_templates
            WHERE status = 'active'
            ORDER BY usage_count DESC, success_rate DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]

    @staticmethod
    def export_templates(template_ids: List[int] = None) -> List[Dict]:
        conn = Database.get_connection()
        if template_ids:
            placeholders = ",".join(["?" for _ in template_ids])
            rows = conn.execute(
                f"SELECT code, name, category, prompt_content, description FROM prompt_templates WHERE id IN ({placeholders})",
                template_ids,
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT code, name, category, prompt_content, description FROM prompt_templates"
            ).fetchall()
        conn.close()
        return [dict(row) for row in rows]

    @staticmethod
    def import_templates(templates: List[Dict], overwrite: bool = False) -> Dict:
        imported = 0
        skipped = 0
        errors = []

        for template in templates:
            try:
                existing = PromptTemplateService.get_by_code(template.get("code"))
                if existing:
                    if overwrite:
                        PromptTemplateService.update(
                            existing["id"],
                            name=template.get("name"),
                            category=template.get("category"),
                            prompt_content=template.get("prompt_content"),
                            description=template.get("description"),
                        )
                        imported += 1
                    else:
                        skipped += 1
                else:
                    PromptTemplateService.create(
                        code=template.get("code"),
                        name=template.get("name"),
                        category=template.get("category"),
                        prompt_content=template.get("prompt_content"),
                        description=template.get("description"),
                    )
                    imported += 1
            except Exception as e:
                errors.append(f"模板 {template.get('code', 'unknown')}: {str(e)}")

        return {
            "imported": imported,
            "skipped": skipped,
            "errors": errors,
        }
