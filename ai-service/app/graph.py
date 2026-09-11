from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .intent import classify_intent
from .creation import IdeaExtractor, IdeaSubmitter, handle_creation
from .config import Settings
from .my_ideas import answer_my_ideas
from .repositories import IdeaRepository
from .schemas import ChatRequest, ChatResponse, Intent


class AssistantGraphState(TypedDict, total=False):
    request: ChatRequest
    user_id: str
    intent: Intent
    response: ChatResponse


def build_assistant_graph(repository: IdeaRepository, settings: Settings):
    extractor = IdeaExtractor(settings)
    submitter = IdeaSubmitter(repository, settings.database_api_url)
    def classify(state: AssistantGraphState) -> dict:
        request = state["request"]
        return {"intent": classify_intent(request.message, request.idea_form is not None)}

    def route(state: AssistantGraphState) -> str:
        return state["intent"].value

    def my_ideas_node(state: AssistantGraphState) -> dict:
        return {"response": answer_my_ideas(repository, state["user_id"], state["request"].message)}

    def creation_node(state: AssistantGraphState) -> dict:
        return {"response": handle_creation(state["request"], state["user_id"], extractor, submitter)}

    def placeholder_node(intent: Intent, message: str):
        def node(state: AssistantGraphState) -> dict:
            return {"response": ChatResponse(intent=intent, phase="planned", message=message, idea_form=state["request"].idea_form)}
        return node

    graph = StateGraph(AssistantGraphState)
    graph.add_node("classify", classify)
    graph.add_node(Intent.SEARCH_MY_IDEAS.value, my_ideas_node)
    graph.add_node(Intent.SEARCH_ADOPTED_IDEAS.value, placeholder_node(Intent.SEARCH_ADOPTED_IDEAS, "已识别为查询已采纳建议；RAG检索将在后续迭代接入。"))
    graph.add_node(Intent.CREATE_OR_REFINE_IDEA.value, creation_node)
    graph.add_node(Intent.GENERAL_KNOWLEDGE.value, placeholder_node(Intent.GENERAL_KNOWLEDGE, "已识别为知识查询；公司知识库与通用知识路由将在后续迭代接入。"))
    graph.add_node(Intent.OUT_OF_SCOPE.value, placeholder_node(Intent.OUT_OF_SCOPE, "暂时无法识别为平台已开放的AI助理能力，请尝试查询建议、查询我的建议或提出新建议。"))
    graph.add_edge(START, "classify")
    graph.add_conditional_edges("classify", route, {intent.value: intent.value for intent in Intent})
    for intent in Intent:
        graph.add_edge(intent.value, END)
    return graph.compile()
