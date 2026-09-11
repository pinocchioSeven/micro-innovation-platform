from __future__ import annotations

import json
import re
from dataclasses import dataclass

import httpx

from .config import Settings
from .repositories import IdeaRepository
from .schemas import ChatRequest, ChatResponse, CreationPhase, IdeaFormState, Intent, Navigation


CONFIRM_PHRASES = ("确认提交", "可以提交", "提交吧", "确认以上内容并提交", "没问题，提交")
CANCEL_PHRASES = ("取消提交", "先不提交", "不提交了", "取消这个建议", "放弃提交")


@dataclass(frozen=True)
class IdeaSubmitter:
    repository: IdeaRepository
    database_api_url: str

    def submit(self, user_id: str, form: IdeaFormState) -> str:
        user = self.repository.require_user(user_id)
        response = httpx.post(
            f"{self.database_api_url}/ideas",
            json={"accountName": user["name"], "title": form.title, "desc": form.description, "plan": form.plan},
            timeout=15,
        )
        data = response.json()
        if response.status_code >= 400:
            raise RuntimeError(data.get("error", "建议提交失败"))
        ideas = [idea for idea in data.get("ideas", []) if idea.get("authorId") == user_id and idea.get("title") == form.title]
        if not ideas:
            raise RuntimeError("建议已提交，但未能读取建议编号")
        return max(ideas, key=lambda idea: (idea.get("createdAt", ""), idea.get("id", "")))["id"]


class IdeaExtractor:
    def __init__(self, settings: Settings):
        self.settings = settings

    def extract(self, message: str, current: IdeaFormState | None) -> IdeaFormState:
        extracted = self._extract_with_llm(message, current) if self.settings.llm_api_key and self.settings.llm_model else None
        if extracted is None:
            extracted = self._fallback_extract(message, current)
        return extracted

    def _extract_with_llm(self, message: str, current: IdeaFormState | None) -> IdeaFormState | None:
        prompt = {
            "current": current.model_dump(exclude={"phase"}) if current else None,
            "user_message": message,
            "rules": [
                "只返回title、description、plan三个字段的JSON，不要markdown",
                "结合当前内容更新用户明确补充或修改的字段，未涉及字段保持原值",
                "title不超过50字，description和plan分别不超过500字",
                "不得添加用户没有表达的具体数字、收益或制度",
                "信息不足的字段返回null",
            ],
        }
        try:
            response = httpx.post(
                self.settings.llm_base_url,
                headers={"Authorization": f"Bearer {self.settings.llm_api_key}", "Content-Type": "application/json"},
                json={
                    "model": self.settings.llm_model,
                    "messages": [
                        {"role": "system", "content": "你是企业微创新建议表单抽取器，只维护标题、建议内容和优化方案三个字段。"},
                        {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
                    ],
                    "temperature": 0.1,
                    "enable_thinking": False,
                    "max_tokens": 800,
                    "response_format": {"type": "json_object"},
                },
                timeout=25,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            parsed = json.loads(re.sub(r"^```json\s*|\s*```$", "", content.strip()))
            return IdeaFormState(
                title=(parsed.get("title") or None),
                description=(parsed.get("description") or None),
                plan=(parsed.get("plan") or None),
                phase=CreationPhase.REFINING if current else CreationPhase.EXTRACTING,
            )
        except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            return None

    @staticmethod
    def _fallback_extract(message: str, current: IdeaFormState | None) -> IdeaFormState:
        form = current.model_copy(deep=True) if current else IdeaFormState()
        text = message.strip()
        explicit_patterns = {
            "title": r"(?:标题|建议标题)(?:改为|修改为|写成|是|：|:)\s*(.+)",
            "description": r"(?:建议内容|问题描述)(?:改为|修改为|写成|是|：|:)\s*(.+)",
            "plan": r"(?:优化方案|改进方案)(?:改为|修改为|写成|是|：|:)\s*(.+)",
        }
        explicitly_updated = False
        for field, pattern in explicit_patterns.items():
            match = re.search(pattern, text)
            if match:
                limit = 50 if field == "title" else 500
                setattr(form, field, match.group(1).strip("。 ")[:limit])
                explicitly_updated = True
        keyword_match = re.search(r"标题.*?(?:包含|加入|带上)[“\"]?(.+?)[”\"]?(?:关键词|字样|这个词)(?:[，。,.]|$)", text)
        if keyword_match:
            keyword = keyword_match.group(1).strip("“”\" ，。")
            if keyword and keyword not in (form.title or ""):
                current_title = form.title or "微创新建议"
                if keyword == "午休" and "会议室" in current_title:
                    form.title = "优化午休时间与会议室预约协调机制"
                elif current_title.startswith("优化"):
                    form.title = f"优化{keyword}相关的{current_title[2:]}"[:50]
                else:
                    form.title = f"{keyword}相关：{current_title}"[:50]
            explicitly_updated = True
        if explicitly_updated:
            return form

        cleaned = re.sub(r"^(?:请)?帮我(?:提交|提出)(?:一条|一个)?建议[，,：:\s]*", "", text)
        cleaned = re.sub(r"^(我认为|我觉得|我发现|我想要|我建议)", "", cleaned).strip("，。 ：:")
        parts = re.split(r"[，,；;。]?\s*(?:建议|希望|优化方案是|改进方案是)\s*", cleaned, maxsplit=1)
        problem = parts[0].strip("，。 ：:")
        proposed_plan = parts[1].strip("，。 ：:") if len(parts) > 1 else ""
        if current:
            missing = missing_fields(form)
            if missing:
                field_by_label = {"标题": "title", "建议内容": "description", "优化方案": "plan"}
                field = field_by_label[missing[0]]
                setattr(form, field, text[:50] if field == "title" else text[:500])
            return form
        if not form.description:
            form.description = (problem or cleaned)[:500]
        if not form.plan and proposed_plan:
            form.plan = proposed_plan[:500]
        if not form.title:
            if "会议室" in problem:
                form.title = "优化会议室预约与释放机制"
            else:
                form.title = f"优化{problem[:20]}" if problem else "待完善的微创新建议"
        return form


def missing_fields(form: IdeaFormState) -> list[str]:
    labels = (("title", "标题"), ("description", "建议内容"), ("plan", "优化方案"))
    return [label for field, label in labels if not (getattr(form, field) or "").strip()]


def preview_message(form: IdeaFormState) -> str:
    return f"我已整理为以下建议：\n\n标题：{form.title}\n\n建议内容：{form.description}\n\n优化方案：{form.plan}\n\n请继续修改，或明确回复“确认提交”。"


def handle_creation(
    request: ChatRequest,
    user_id: str,
    extractor: IdeaExtractor,
    submitter: IdeaSubmitter,
) -> ChatResponse:
    text = request.message.strip()
    current = request.idea_form
    if current and any(phrase in text for phrase in CANCEL_PHRASES):
        return ChatResponse(intent=Intent.CREATE_OR_REFINE_IDEA, phase=CreationPhase.CANCELLED, message="已取消本次建议提交，临时内容不会保存。")

    if current and any(phrase in text for phrase in CONFIRM_PHRASES):
        missing = missing_fields(current)
        if current.phase != CreationPhase.AWAITING_CONFIRMATION or missing:
            return ChatResponse(
                intent=Intent.CREATE_OR_REFINE_IDEA,
                phase=CreationPhase.COLLECTING,
                message=f"当前建议还不能提交，请先补充：{'、'.join(missing) if missing else '并确认最新版完整内容'}。",
                idea_form=current,
            )
        submitted_id = submitter.submit(user_id, current)
        submitted = current.model_copy(update={"phase": CreationPhase.SUBMITTED})
        return ChatResponse(
            intent=Intent.CREATE_OR_REFINE_IDEA,
            phase=CreationPhase.SUBMITTED,
            message=f"建议已成功提交，编号为 {submitted_id}，当前进入待初审。提交后暂不支持通过AI助手撤回或修改。",
            idea_form=submitted,
            submitted_idea_id=submitted_id,
            navigation=Navigation(page="我的建议", filter="待初审", idea_id=submitted_id, label="查看已提交建议"),
        )

    form = extractor.extract(text, current)
    missing = missing_fields(form)
    if missing:
        form.phase = CreationPhase.COLLECTING
        return ChatResponse(
            intent=Intent.CREATE_OR_REFINE_IDEA,
            phase=CreationPhase.COLLECTING,
            message=f"我已经记录了部分内容。为了形成完整建议，请补充：{'、'.join(missing)}。",
            idea_form=form,
        )
    form.phase = CreationPhase.AWAITING_CONFIRMATION
    return ChatResponse(
        intent=Intent.CREATE_OR_REFINE_IDEA,
        phase=CreationPhase.AWAITING_CONFIRMATION,
        message=preview_message(form),
        idea_form=form,
        requires_confirmation=True,
    )
