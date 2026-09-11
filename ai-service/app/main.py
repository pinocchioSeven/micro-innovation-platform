from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .graph import build_assistant_graph
from .repositories import IdeaRepository
from .schemas import ChatRequest, ChatResponse


settings = get_settings()
repository = IdeaRepository(settings.database_path)
assistant_graph = build_assistant_graph(repository, settings)

app = FastAPI(title="微创新平台 AI 助理", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-User-Id"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "database": settings.database_path.exists()}


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest, x_user_id: str = Header(min_length=1)) -> ChatResponse:
    try:
        result = assistant_graph.invoke({"request": request, "user_id": x_user_id})
        return result["response"]
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
