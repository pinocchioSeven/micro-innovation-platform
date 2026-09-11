from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.my_ideas import answer_my_ideas, parse_my_idea_query
from app.repositories import IdeaRepository
from app.schemas import Intent


DATABASE_PATH = Path(__file__).resolve().parents[2] / "data" / "micro-innovation-seed.db"


def test_parse_status_and_id():
    query = parse_my_idea_query("查询我的待初审建议 MI-2026-001")
    assert query.status == "待初审"
    assert query.idea_id == "MI-2026-001"


def test_repository_never_returns_another_users_ideas():
    repository = IdeaRepository(DATABASE_PATH)
    with repository._connect_read_only() as connection:
        user = connection.execute(
            "SELECT author_id, COUNT(*) AS amount FROM ideas GROUP BY author_id ORDER BY amount DESC LIMIT 1"
        ).fetchone()
    rows = repository.list_my_ideas(user["author_id"], parse_my_idea_query("查询我的建议"))
    with repository._connect_read_only() as connection:
        owned = connection.execute(
            "SELECT COUNT(*) FROM ideas WHERE author_id=? AND id IN ({})".format(",".join("?" for _ in rows)),
            [user["author_id"], *[row["id"] for row in rows]],
        ).fetchone()[0]
    assert owned == len(rows)


def test_answer_contains_navigation_path():
    repository = IdeaRepository(DATABASE_PATH)
    with repository._connect_read_only() as connection:
        user_id = connection.execute("SELECT author_id FROM ideas LIMIT 1").fetchone()[0]
    response = answer_my_ideas(repository, user_id, "查询我的建议")
    assert response.intent == Intent.SEARCH_MY_IDEAS
    assert response.navigation is not None
    assert response.navigation.page == "我的建议"
    assert "查看路径：我的建议" in response.message


def test_chat_api_routes_to_my_ideas():
    repository = IdeaRepository(DATABASE_PATH)
    with repository._connect_read_only() as connection:
        user_id = connection.execute("SELECT author_id FROM ideas LIMIT 1").fetchone()[0]
    response = TestClient(app).post(
        "/api/chat",
        headers={"X-User-Id": user_id},
        json={"message": "查询我的待初审建议"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["intent"] == Intent.SEARCH_MY_IDEAS
    assert payload["navigation"]["page"] == "我的建议"
    assert payload["navigation"]["filter"] == "待初审"
