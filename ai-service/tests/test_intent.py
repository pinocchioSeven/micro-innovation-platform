from app.intent import classify_intent
from app.schemas import Intent


def test_my_ideas_has_priority_over_general_query_words():
    assert classify_intent("如何查询我的待初审建议") == Intent.SEARCH_MY_IDEAS


def test_create_intent():
    assert classify_intent("我认为会议室预约流程需要改进") == Intent.CREATE_OR_REFINE_IDEA


def test_submit_request_is_not_mistaken_for_my_ideas_query():
    assert classify_intent("帮我提交建议，我觉得目前的午休时间和会议室预约机制冲突") == Intent.CREATE_OR_REFINE_IDEA


def test_query_about_submitted_idea_stays_in_my_ideas_branch():
    assert classify_intent("查询我提交的建议现在是什么状态") == Intent.SEARCH_MY_IDEAS


def test_existing_form_keeps_creation_context():
    assert classify_intent("标题再短一点", has_idea_form=True) == Intent.CREATE_OR_REFINE_IDEA


def test_adopted_search_intent():
    assert classify_intent("帮我查询办公相关建议") == Intent.SEARCH_ADOPTED_IDEAS


def test_general_knowledge_intent():
    assert classify_intent("什么是RAG") == Intent.GENERAL_KNOWLEDGE
