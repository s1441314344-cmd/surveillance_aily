import argparse
import configparser
import os
import sys


class Config:
    _instance = None
    _config = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Config, cls).__new__(cls)
            cls._instance._load_config()
        return cls._instance

    def _load_config(self):
        self._config = configparser.ConfigParser()

        parser = argparse.ArgumentParser(add_help=False)
        parser.add_argument("-c", "--config", help="Path to config.ini")
        args, _ = parser.parse_known_args()

        loaded_path = None
        candidate_paths = []

        if args.config:
            candidate_paths.append(args.config)

        candidate_paths.append(os.path.join(os.getcwd(), "config.ini"))
        candidate_paths.append(os.path.join(os.path.dirname(sys.executable), "config.ini"))

        for path in candidate_paths:
            if path and os.path.exists(path):
                self._config.read(path, encoding="utf-8")
                loaded_path = path
                break

        if loaded_path:
            print(f"Loaded config from: {loaded_path}")
            self._load_dynamic_tables()
        else:
            print("[Warning] No config.ini found. Falling back to environment variables and defaults.")

    def _safe_get(self, section, option, fallback=None):
        return self._config.get(section, option, fallback=fallback)

    def _safe_getboolean(self, section, option, fallback=False):
        return self._config.getboolean(section, option, fallback=fallback)

    def _load_dynamic_tables(self):
        try:
            from app.services.feishu_service import FeishuService

            app_id = self.aily_app_id
            app_secret = self.aily_app_secret
            base_token = self.base_token

            if not (app_id and app_secret and base_token):
                return

            tables = FeishuService.get_tables(app_id, app_secret, base_token)
            self._camera_table_id = None
            self._record_table_id = None
            self._rule_table_id = None
            self._unit_table_id = None

            for table in tables:
                if table["name"] == "巡检点位":
                    self._camera_table_id = table["table_id"]
                elif table["name"] == "巡检记录":
                    self._record_table_id = table["table_id"]
                elif table["name"] == "巡检规则":
                    self._rule_table_id = table["table_id"]
                elif table["name"] == "巡检单位":
                    self._unit_table_id = table["table_id"]
        except Exception as exc:
            print(f"[Warning] 动态加载飞书表配置失败: {exc}")

    @property
    def aily_app_id(self):
        return self._safe_get("aily", "app_id")

    @property
    def aily_app_secret(self):
        return self._safe_get("aily", "app_secret")

    @property
    def base_token(self):
        return self._safe_get("base", "token")

    @property
    def camera_table_id(self):
        if hasattr(self, "_camera_table_id") and self._camera_table_id:
            return self._camera_table_id
        return self._safe_get("base", "camera_table_id")

    @property
    def record_table_id(self):
        if hasattr(self, "_record_table_id") and self._record_table_id:
            return self._record_table_id
        return self._safe_get("base", "record_table_id")

    @property
    def rule_table_id(self):
        if hasattr(self, "_rule_table_id") and self._rule_table_id:
            return self._rule_table_id
        return self._safe_get("base", "rule_table_id")

    @property
    def unit_table_id(self):
        if hasattr(self, "_unit_table_id") and self._unit_table_id:
            return self._unit_table_id
        return self._safe_get("base", "unit_table_id")

    @property
    def aily_app_key(self):
        return self._safe_get("aily", "app")

    @property
    def aily_skill_id(self):
        return self._safe_get("aily", "skill")

    @property
    def save_path(self):
        return self._safe_get("app", "path", fallback="./screenshot/")

    @property
    def use_aily(self):
        return self._safe_getboolean("aily", "use_aily", fallback=False)

    @property
    def capture_source(self):
        value = self._safe_get("app", "capture_source", fallback="camera").strip().lower()
        return value if value in ("camera", "screenshot") else "camera"

    @property
    def use_local_llm(self):
        return self._safe_getboolean("llm", "use_local_llm", fallback=False)

    @property
    def zhipu_api_key(self):
        return self._safe_get("llm", "zhipu_api_key")

    @property
    def zhipu_model(self):
        return self._safe_get("llm", "zhipu_model", fallback="glm-4v-plus")

    @property
    def use_ollama(self):
        return self._safe_getboolean("llm", "use_ollama", fallback=False)

    @property
    def ollama_url(self):
        return self._safe_get("llm", "ollama_url", fallback="http://localhost:11434")

    @property
    def ollama_model(self):
        return self._safe_get("llm", "ollama_model", fallback="llava")

    @property
    def llm_timeout_seconds(self):
        value = os.getenv("LLM_TIMEOUT_SECONDS") or self._safe_get("llm", "timeout_seconds", fallback="120")
        try:
            return max(10, int(value))
        except ValueError:
            return 120

    @property
    def default_auto_create_work_order(self):
        env_value = os.getenv("AUTO_CREATE_WORK_ORDER")
        if env_value is not None:
            return env_value.lower() in {"1", "true", "yes", "on"}
        return self._safe_getboolean("app", "auto_create_work_order", fallback=True)

    @property
    def upload_limit_mb(self):
        value = os.getenv("UPLOAD_LIMIT_MB") or self._safe_get("app", "upload_limit_mb", fallback="20")
        try:
            return max(1, int(value))
        except ValueError:
            return 20


config = Config()
