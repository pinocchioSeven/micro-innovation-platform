from app.creation import IdeaExtractor, handle_creation, missing_fields
from app.schemas import ChatRequest, CreationPhase, IdeaFormState, Intent


class FakeExtractor:
    def __init__(self, result: IdeaFormState):
        self.result = result

    def extract(self, message: str, current: IdeaFormState | None) -> IdeaFormState:
        return self.result.model_copy(deep=True)


class FakeSubmitter:
    def __init__(self):
        self.calls = 0

    def submit(self, user_id: str, form: IdeaFormState) -> str:
        self.calls += 1
        return "MI-2026-999"


def complete_form(phase: CreationPhase = CreationPhase.EXTRACTING) -> IdeaFormState:
    return IdeaFormState(
        title="优化会议室预约释放机制",
        description="会议室预约后无人使用，影响其他同事正常预约。",
        plan="开始十五分钟后无人签到时自动释放会议室。",
        phase=phase,
    )


def test_complete_idea_requires_explicit_confirmation():
    submitter = FakeSubmitter()
    response = handle_creation(
        ChatRequest(message="我想提交一个会议室优化建议"),
        "USER-001",
        FakeExtractor(complete_form()),
        submitter,
    )
    assert response.intent == Intent.CREATE_OR_REFINE_IDEA
    assert response.phase == CreationPhase.AWAITING_CONFIRMATION
    assert response.requires_confirmation is True
    assert submitter.calls == 0


def test_confirmation_only_submits_previewed_complete_version():
    submitter = FakeSubmitter()
    response = handle_creation(
        ChatRequest(message="确认提交", idea_form=complete_form(CreationPhase.AWAITING_CONFIRMATION)),
        "USER-001",
        FakeExtractor(complete_form()),
        submitter,
    )
    assert response.phase == CreationPhase.SUBMITTED
    assert response.submitted_idea_id == "MI-2026-999"
    assert submitter.calls == 1


def test_incomplete_form_cannot_be_confirmed():
    submitter = FakeSubmitter()
    form = IdeaFormState(title="会议室优化", description="预约后无人使用", phase=CreationPhase.AWAITING_CONFIRMATION)
    response = handle_creation(
        ChatRequest(message="确认提交", idea_form=form),
        "USER-001",
        FakeExtractor(form),
        submitter,
    )
    assert response.phase == CreationPhase.COLLECTING
    assert "优化方案" in response.message
    assert submitter.calls == 0


def test_cancel_discards_temporary_form_without_submit():
    submitter = FakeSubmitter()
    response = handle_creation(
        ChatRequest(message="先不提交", idea_form=complete_form(CreationPhase.AWAITING_CONFIRMATION)),
        "USER-001",
        FakeExtractor(complete_form()),
        submitter,
    )
    assert response.phase == CreationPhase.CANCELLED
    assert response.idea_form is None
    assert submitter.calls == 0


def test_missing_fields_lists_only_empty_fields():
    assert missing_fields(IdeaFormState(title="标题", description="内容")) == ["优化方案"]


def test_fallback_splits_problem_and_plan():
    form = IdeaExtractor._fallback_extract("我认为会议室预约后经常无人使用，建议超过十五分钟无人签到就自动释放", None)
    assert form.title == "优化会议室预约与释放机制"
    assert form.description == "会议室预约后经常无人使用"
    assert form.plan == "超过十五分钟无人签到就自动释放"


def test_fallback_can_modify_a_single_field():
    form = complete_form(CreationPhase.AWAITING_CONFIRMATION)
    updated = IdeaExtractor._fallback_extract("标题改为会议室预约超时释放", form)
    assert updated.title == "会议室预约超时释放"
    assert updated.description == form.description
    assert updated.plan == form.plan


def test_submit_request_prefix_is_not_extracted_as_business_content():
    form = IdeaExtractor._fallback_extract("帮我提交建议，我觉得目前的午休时间和会议室预约机制冲突", None)
    assert form.description == "目前的午休时间和会议室预约机制冲突"
    assert form.plan is None
    assert missing_fields(form) == ["优化方案"]


def test_title_can_be_reworked_to_include_requested_keyword():
    form = complete_form(CreationPhase.AWAITING_CONFIRMATION)
    updated = IdeaExtractor._fallback_extract("我想让标题包含午休关键词", form)
    assert updated.title == "优化午休时间与会议室预约协调机制"
    assert updated.description == form.description
    assert updated.plan == form.plan
