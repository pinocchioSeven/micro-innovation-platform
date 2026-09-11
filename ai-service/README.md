# 微创新平台 AI 服务

第一迭代提供统一对话协议、五类意图路由，以及只读的“查询我的建议”能力。

## 本地运行

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

接口：

- `GET /health`
- `POST /api/chat`

当前 `X-User-Id` 由调用方传入，仅用于本地联调。接入现有页面时必须由可信的 Next.js 服务端代理根据登录态注入，浏览器不能自由指定其他用户。

