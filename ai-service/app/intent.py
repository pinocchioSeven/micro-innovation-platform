from __future__ import annotations

from .schemas import Intent


MY_IDEA_TERMS = ("我的建议", "我提交的建议", "我的提案", "我提的建议", "审核到哪", "审核进度", "通过了吗")
CREATE_TERMS = ("我建议", "我认为", "我发现", "我想要", "提交建议", "提出建议", "优化方案")
QUERY_TERMS = ("查询", "查看", "查一下", "有哪些", "多少", "状态", "进度", "通过了吗", "审核到哪")
ADOPTED_SEARCH_TERMS = ("已采纳建议", "采纳的建议", "查询建议", "检索建议", "找建议", "相关建议")
COMPANY_TERMS = ("公司", "本公司", "单位", "内部制度", "报销", "年假", "请假", "公司流程")
GENERAL_TERMS = ("是什么", "什么是", "怎么做", "如何", "解释", "介绍一下", "知识")


def classify_intent(message: str, has_idea_form: bool = False) -> Intent:
    """第一迭代的可测试规则路由；后续可替换为结构化LLM分类器。"""
    text = message.strip()
    mentions_my_idea = "我的" in text and ("建议" in text or any(status in text for status in ("待初审", "待终审", "已采纳", "已驳回")))
    asks_about_own_ideas = (mentions_my_idea or any(term in text for term in MY_IDEA_TERMS)) and any(term in text for term in QUERY_TERMS)
    if has_idea_form:
        return Intent.CREATE_OR_REFINE_IDEA
    if asks_about_own_ideas:
        return Intent.SEARCH_MY_IDEAS
    if any(term in text for term in CREATE_TERMS):
        return Intent.CREATE_OR_REFINE_IDEA
    if mentions_my_idea or any(term in text for term in MY_IDEA_TERMS):
        return Intent.SEARCH_MY_IDEAS
    if any(term in text for term in ADOPTED_SEARCH_TERMS):
        return Intent.SEARCH_ADOPTED_IDEAS
    if any(term in text for term in COMPANY_TERMS) or any(term in text for term in GENERAL_TERMS):
        return Intent.GENERAL_KNOWLEDGE
    return Intent.OUT_OF_SCOPE
