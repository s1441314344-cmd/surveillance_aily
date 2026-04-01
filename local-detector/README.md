# local-detector

独立本地检测微服务（FastAPI + ONNXRuntime），用于在后端任务链路前执行本地前置门控。

## API

- `GET /healthz`
- `POST /v1/detect`（`multipart/form-data`，字段：`file`，可选 `person_threshold`）

## 本地运行

```bash
python3 -m pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8091
```

## Docker

```bash
docker build -t surveillance-local-detector .
docker run --rm -p 8091:8091 surveillance-local-detector
```
