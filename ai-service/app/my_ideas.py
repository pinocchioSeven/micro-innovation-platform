from __future__ import annotations

import re
from collections import Counter

from .repositories import ALLOWED_STATUSES, IdeaRepository, MyIdeaQuery
from .schemas import ChatResponse, Intent, MyIdeaItem, Navigation


IDEA_ID_PATTERN = re.compile(r"MI-\d{4}-\d{3,}", re.IGNORECASE)


def parse_my_idea_query(message: str) -> MyIdeaQuery:
    status = next((candidate for candidate in ALLOWED_STATUSES if candidate in message), None)
    match = IDEA_ID_PATTERN.search(message)
    return MyIdeaQuery(status=status, idea_id=match.group(0).upper() if match else None)


def answer_my_ideas(repository: IdeaRepository, user_id: str, message: str) -> ChatResponse:
    query = parse_my_idea_query(message)
    rows = repository.list_my_ideas(user_id, query)
    items = [MyIdeaItem.model_validate(row) for row in rows]
    if not items:
        scope = f"“{query.status}”" if query.status else "符合条件的"
        return ChatResponse(
            intent=Intent.SEARCH_MY_IDEAS,
            message=f"你目前没有{scope}建议。查看路径：我的建议" + (f" → {query.status}" if query.status else ""),
            navigation=Navigation(
                page="我的建议",
                filter=query.status,
                label="前往我的建议" + (f"-{query.status}" if query.status else ""),
            ),
        )

    if query.idea_id:
        item = items[0]
        feedback = f"，最新反馈为“{item.latest_feedback}”" if item.latest_feedback else ""
        message_text = f"建议“{item.title}”（{item.id}）当前状态为{item.status}{feedback}。查看路径：我的建议 → {item.status}。"
        navigation = Navigation(page="我的建议", filter=item.status, idea_id=item.id, label="查看建议详情")
    elif query.status:
        message_text = f"你目前有{len(items)}条{query.status}建议。查看路径：我的建议 → {query.status}。"
        navigation = Navigation(page="我的建议", filter=query.status, label=f"前往我的建议-{query.status}")
    else:
        counts = Counter(item.status for item in items)
        summary = "、".join(f"{count}条{status}" for status, count in counts.items())
        message_text = f"本次查询到你最近的{len(items)}条建议，其中{summary}。查看路径：我的建议。"
        navigation = Navigation(page="我的建议", label="前往我的建议")

    return ChatResponse(
        intent=Intent.SEARCH_MY_IDEAS,
        message=message_text,
        my_ideas=items,
        navigation=navigation,
    )
