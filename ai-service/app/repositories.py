from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path


ALLOWED_STATUSES = ("待初审", "待终审", "已采纳", "已驳回")


@dataclass(frozen=True)
class MyIdeaQuery:
    status: str | None = None
    idea_id: str | None = None
    limit: int = 10


class IdeaRepository:
    def __init__(self, database_path: Path):
        self.database_path = database_path

    def _connect_read_only(self) -> sqlite3.Connection:
        if not self.database_path.exists():
            raise FileNotFoundError(f"数据库不存在：{self.database_path}")
        connection = sqlite3.connect(f"file:{self.database_path.as_posix()}?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        return connection

    def require_user(self, user_id: str) -> sqlite3.Row:
        with self._connect_read_only() as connection:
            row = connection.execute(
                "SELECT id,name,enabled FROM users WHERE id=? AND enabled=1",
                (user_id,),
            ).fetchone()
        if row is None:
            raise PermissionError("当前用户不存在或未启用")
        return row

    def list_my_ideas(self, user_id: str, query: MyIdeaQuery) -> list[dict]:
        self.require_user(user_id)
        clauses = ["i.author_id = ?"]
        params: list[object] = [user_id]
        if query.status:
            if query.status not in ALLOWED_STATUSES:
                raise ValueError("建议状态无效")
            clauses.append("i.status = ?")
            params.append(query.status)
        if query.idea_id:
            clauses.append("i.id = ?")
            params.append(query.idea_id)
        params.append(max(1, min(query.limit, 20)))
        sql = f"""
            SELECT
                i.id,
                i.title,
                i.status,
                i.created_at,
                (
                    SELECT l.comment
                    FROM idea_lifecycle_records l
                    WHERE l.idea_id = i.id
                      AND l.comment IS NOT NULL
                      AND l.action IN ('初审通过', '初审退回', '终审通过', '终审退回')
                    ORDER BY l.updated_at DESC, l.id DESC
                    LIMIT 1
                ) AS latest_feedback,
                (
                    SELECT l.updated_at
                    FROM idea_lifecycle_records l
                    WHERE l.idea_id = i.id
                      AND l.comment IS NOT NULL
                      AND l.action IN ('初审通过', '初审退回', '终审通过', '终审退回')
                    ORDER BY l.updated_at DESC, l.id DESC
                    LIMIT 1
                ) AS latest_feedback_at
            FROM ideas i
            WHERE {' AND '.join(clauses)}
            ORDER BY i.created_at DESC, i.id DESC
            LIMIT ?
        """
        with self._connect_read_only() as connection:
            rows = connection.execute(sql, params).fetchall()
        return [dict(row) for row in rows]
