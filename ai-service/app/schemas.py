from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class Intent(StrEnum):
    SEARCH_ADOPTED_IDEAS = "search_adopted_ideas"
    SEARCH_MY_IDEAS = "search_my_ideas"
    CREATE_OR_REFINE_IDEA = "create_or_refine_idea"
    GENERAL_KNOWLEDGE = "general_knowledge"
    OUT_OF_SCOPE = "out_of_scope"


class CreationPhase(StrEnum):
    EXTRACTING = "extracting"
    COLLECTING = "collecting"
    REFINING = "refining"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    SUBMITTING = "submitting"
    SUBMITTED = "submitted"
    CANCELLED = "cancelled"


class Message(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)


class IdeaFormState(BaseModel):
    title: str | None = Field(default=None, max_length=50)
    description: str | None = Field(default=None, max_length=500)
    plan: str | None = Field(default=None, max_length=500)
    phase: CreationPhase = CreationPhase.EXTRACTING


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    recent_messages: list[Message] = Field(default_factory=list, max_length=20)
    idea_form: IdeaFormState | None = None


class Navigation(BaseModel):
    page: str
    filter: str | None = None
    idea_id: str | None = None
    label: str


class MyIdeaItem(BaseModel):
    id: str
    title: str
    status: str
    created_at: str
    latest_feedback: str | None = None
    latest_feedback_at: str | None = None


class ChatResponse(BaseModel):
    intent: Intent
    phase: str = "completed"
    message: str
    idea_form: IdeaFormState | None = None
    my_ideas: list[MyIdeaItem] = Field(default_factory=list)
    search_results: list[dict] = Field(default_factory=list)
    navigation: Navigation | None = None
    requires_confirmation: bool = False
    submitted_idea_id: str | None = None
