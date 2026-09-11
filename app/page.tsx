'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from 'react';
import { searchConcepts, type Account, type Idea, type PointRecord, type Status } from './idea-data';
import { getAccounts, getIdeaViews, getPointViews, getThreadComments } from './repositories/platform-repository';
import { addCommentToDatabase, addReplyToDatabase, createIdeaInDatabase, fetchDatabase, resubmitIdeaInDatabase, toggleIdeaActionInDatabase, transitionIdeaInDatabase } from './repositories/database-api';
import { chatWithAssistant, type AssistantIdeaForm, type AssistantResponse } from './repositories/ai-assistant-api';
import type { MockDatabase } from './data/schema';
type SearchResult = { idea: Idea; score: number; reason: string };
type IdeaAnalysis = { summary: string; problem: string; value: string; feasibility: string; risks: string[]; nextSteps: string[]; source?: 'ai' | 'local' };
type OverallAnalysis = { summary: string; themes: string[]; patterns: string[]; opportunities: string[]; source?: 'ai' | 'local' };
type CommentReply = { id: string; author: string; content: string; time: string; createdAt: number; replyTo?: string };
type ThreadComment = { id: string; author: string; content: string; time: string; createdAt: number; replies: CommentReply[] };
type SmartReadResult = { summary: string; problem: string; action: string; source?: 'ai' | 'local' };
const nav = [['总览', '⌂'], ['提交建议', '＋'], ['我的建议', '▣'], ['建议广场', '◇'], ['AI 灵感探索', '✦'], ['AI 助手', '◈'], ['审核管理', '✓'], ['系统管理', '⚙'], ['超级维护', '◎']];
let pointProfiles: Array<{ name: string; dept: string }> = [];
/*
输入：
- items：所有建议数据；
- rawQuery：用户输入的自然语言。
输出：
- 相关性最高的前10条
*/
function smartSearch(items: Idea[], rawQuery: string): SearchResult[] {
  const query = rawQuery.trim().toLowerCase(); if (!query) return [];
  // 把建议状态作为硬过滤条件
  const explicitStatus = (['待初审', '待终审', '已采纳', '已驳回'] as Status[]).find(status => query.includes(status));
  const direct = query.replace(/[，。！？、,.!?;；：:\s]/g, ' ').split(' ').filter(word => word.length > 1 && !['有没有', '我想看看', '帮我找找', '相关建议', '的建议', '建议', '关于', '哪些', '一下', '是否'].includes(word));
  // 业务概念扩展
  const expanded = Object.entries(searchConcepts).filter(([concept]) => query.includes(concept)).flatMap(([concept, words]) => [concept, ...words]);
  // 提取中文片段
  const fragments = Array.from({ length: Math.max(0, query.length - 1) }, (_, i) => query.slice(i, i + 2)).filter(x => !/[\s，。！？、]/.test(x) && !['建议', '有没有', '我想', '看看', '相关', '关于', '哪些'].includes(x));
  const terms = [...new Set([...direct, ...expanded, ...fragments])];
  return items.map(idea => {
    if (explicitStatus && idea.status !== explicitStatus) return null;
    let score = 0; const hits: string[] = [];
    // 字段匹配和加权
    for (const term of terms) { if (idea.title.toLowerCase().includes(term)) { score += 6; hits.push(term) } else if (idea.desc.toLowerCase().includes(term)) { score += 3; hits.push(term) } else if (idea.plan.toLowerCase().includes(term)) { score += 2; hits.push(term) } else if (`${idea.dept}${idea.author}${idea.status}`.toLowerCase().includes(term)) { score += 4; hits.push(term) } }
    if (idea.title.toLowerCase().includes(query)) score += 12;
    if (!score) return null;
    // 生成匹配原因
    const uniqueHits = [...new Set(hits)].slice(0, 3);
    return { idea, score, reason: uniqueHits.length ? `匹配 ${uniqueHits.map(x => `“${x}”`).join('、')}` : '与描述内容相关' };
  }).filter((x): x is SearchResult => Boolean(x)).sort((a, b) => b.score - a.score || b.idea.likes - a.idea.likes).slice(0, 10);
}
export default function Home() {
  const [account, setAccount] = useState<Account | null>(null), [availableAccounts, setAvailableAccounts] = useState<Account[]>([]), [page, setPage] = useState('总览'), [items, setItems] = useState<Idea[]>([]), [pointRecords, setPointRecords] = useState<PointRecord[]>([]), [filter, setFilter] = useState('全部'), [selected, setSelected] = useState<Idea | null>(null), [toast, setToast] = useState(''), [notice, setNotice] = useState(false), [query, setQuery] = useState(''), [userMenu, setUserMenu] = useState(false), [smartQuery, setSmartQuery] = useState(''), [searchResults, setSearchResults] = useState<SearchResult[]>([]), [searchOpen, setSearchOpen] = useState(false), [hasSearched, setHasSearched] = useState(false), [insightQuery, setInsightQuery] = useState(''), [insightIdea, setInsightIdea] = useState<Idea | null>(null), [insightMode, setInsightMode] = useState<'browse' | 'results' | 'single' | 'overall'>('browse');
  const refreshData = (database: MockDatabase, accountName = account?.name) => { const points = getPointViews(database); pointProfiles = [...new Map(points.map(record => [record.name, { name: record.name, dept: record.dept }])).values()]; setItems(getIdeaViews(database, accountName)); setPointRecords(points) };
  const filtered = useMemo(() => items.filter(x => { const matchesScope = page !== '我的建议' || x.author === account?.name; const matchesStatus = filter === '全部' || x.status === filter; const matchesText = x.title.includes(query) || x.desc.includes(query); const matchesPeople = ['建议广场', '审核管理'].includes(page) && (x.author.includes(query) || x.dept.includes(query)); return matchesScope && matchesStatus && (matchesText || matchesPeople) }), [items, filter, query, page, account?.name]);
  useEffect(() => setQuery(''), [page]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }) }, [page]);
  useEffect(() => { void fetchDatabase().then(database => { setAvailableAccounts(getAccounts(database)); refreshData(database) }).catch(error => setToast(error instanceof Error ? error.message : '本地数据库加载失败')) }, []);
  if (!account) return <Login accounts={availableAccounts} onLogin={next => { setAccount(next); void fetchDatabase().then(database => refreshData(database, next.name)) }} />;
  const role = account.role;
  const pageWelcome: Record<string, string> = { 总览: `欢迎回来，${account.name}`, 'AI 灵感探索': '和智能助手一起发现好点子', 'AI 助手': '对话查询与办理微创新事项', 提交建议: '欢迎提交建议', 我的建议: '查看你的创新足迹', 建议广场: '发现优秀创新建议', 审核管理: '处理待审核建议', 系统管理: '管理平台配置', 超级维护: '进行平台维护' };
  const flash = (s: string) => { setToast(s); setTimeout(() => setToast(''), 2200) };
  const pointsOf = (name: string) => pointRecords.filter(record => record.name === name).reduce((sum, record) => sum + record.points, 0);
  const visible = nav.filter(([n]) => role === '灵感捕手' ? !['审核管理', '系统管理', '超级维护'].includes(n) : role === '建议初审' ? !['系统管理', '超级维护'].includes(n) : true);
  const reviewBadge = role === '灵感捕手' ? 0 : role === '建议初审' ? items.filter(item => item.status === '待初审').length : items.filter(item => item.status === '待终审').length;
  const action = async (id: string, status: Status, comment: string) => { try { refreshData(await transitionIdeaInDatabase(id, account.name, status, comment), account.name); setSelected(null); flash(status === '已驳回' ? '已驳回给提交人调整' : status === '待终审' ? '已提交终审' : '建议已采纳并公示') } catch (error) { flash(error instanceof Error ? error.message : '数据库操作失败') } };
  const resubmit = async (id: string, changes: Pick<Idea, 'title' | 'desc' | 'plan'>) => { try { refreshData(await resubmitIdeaInDatabase(id, account.name, changes), account.name); setSelected(null); setFilter('全部'); flash('建议已重新提交，进入待初审') } catch (error) { flash(error instanceof Error ? error.message : '数据库操作失败') } };
  const toggle = async (id: string, key: 'liked' | 'collected') => { try { refreshData(await toggleIdeaActionInDatabase(id, account.name, key === 'liked' ? 'liked' : 'collection'), account.name) } catch (error) { flash(error instanceof Error ? error.message : '数据库操作失败') } };
  const runSmartSearch = (e: React.FormEvent) => { e.preventDefault(); if (!smartQuery.trim()) return; setSearchResults(smartSearch(items.filter(idea => idea.status === '已采纳'), smartQuery)); setHasSearched(true); setSearchOpen(true) };
  const openInsight = (mode: 'browse' | 'results' | 'single' | 'overall' = 'browse', idea?: Idea) => { setInsightQuery(mode === 'browse' ? '' : smartQuery); setInsightIdea(idea || null); setInsightMode(mode); setSmartQuery(''); setHasSearched(false); setSearchOpen(false); setPage('AI 灵感探索') };
  const resetInsight = () => { setSearchResults([]); openInsight('browse') };
  const monthKey = new Date().toISOString().slice(0, 7); const monthlyPoints = pointRecords.filter(record => record.name === account.name && record.createdAt.startsWith(monthKey)).reduce((sum, record) => sum + record.points, 0); const monthlyProgress = Math.min(100, monthlyPoints / 3);
  return <main className="shell"><aside className="side"><div className="brand"><b>微</b><div><strong>微创新</strong><small>INNOVATION HUB</small></div></div><nav>{visible.map(([n, i]) => <button key={n} onClick={() => n === 'AI 灵感探索' ? resetInsight() : setPage(n)} className={page === n ? 'active' : ''}><span>{i}</span>{n}{n === '审核管理' && reviewBadge > 0 && <em>{reviewBadge}</em>}</button>)}</nav><div className="power"><span>本月创新力</span><strong>{monthlyPoints}</strong><i><b style={{ width: `${monthlyProgress}%` }} /></i><small>本月积分实时累计</small></div><div className="user-wrap">{userMenu && <div className="user-pop"><button onClick={() => { setAccount(null); setUserMenu(false); setPage('总览') }}>↪ 退出登录</button></div>}<button className="user" onClick={() => setUserMenu(!userMenu)}><i>{account.name[0]}</i><div><b>{account.name}</b><small>{role} · {pointsOf(account.name)}积分</small></div><span>⌃</span></button></div></aside>
    <section className="content"><header><div className="header-left"><div className="top-context"><small>MICRO INNOVATION PLATFORM</small><b>{page}</b><span>{pageWelcome[page] || `欢迎使用${page}`}</span></div>{!['总览', '提交建议', 'AI 灵感探索', 'AI 助手'].includes(page) && <div className="search">⌕ <input value={query} onChange={e => setQuery(e.target.value)} placeholder={page === '我的建议' ? '搜索建议标题或问题描述' : '搜索建议、提交人或部门'} /><kbd>⌘ K</kbd></div>}</div>{page === '总览' && <div className="smart-search-wrap"><form className="smart-search" onSubmit={runSmartSearch}><span>⌕</span><input value={smartQuery} onFocus={() => hasSearched && setSearchOpen(true)} onChange={e => { setSmartQuery(e.target.value); if (!e.target.value) { setHasSearched(false); setSearchOpen(false); setSearchResults([]) } }} placeholder="搜索已采纳的好建议" aria-label="搜索已采纳的好建议" /><button disabled={!smartQuery.trim()}>搜索</button></form>{searchOpen && <div className="smart-results"><div className="smart-results-head"><div><b>智能检索结果</b><small>{searchResults.length ? `找到 ${searchResults.length} 条已采纳建议` : '没有找到相关建议'}</small></div><button onClick={() => setSearchOpen(false)} aria-label="关闭搜索结果">×</button></div>{searchResults.length ? <><div className="smart-result-list">{searchResults.slice(0, 5).map(({ idea, reason }) => <button key={idea.id} onClick={() => openInsight('single', idea)}><span className={'status ' + idea.status}>{idea.status}</span><small>{idea.id} · {idea.dept}</small><b>{idea.title}</b><p>{idea.desc}</p><em>✦ {reason} · 去 AI 灵感探索</em></button>)}</div><div className="smart-result-actions"><button className="overall" onClick={() => openInsight('overall')}>✦ AI 整体洞察</button><button onClick={() => openInsight('results')}>查看全部 {searchResults.length} 条 →</button></div></> : <div className="smart-empty"><b>暂未找到匹配内容</b><span>试试“会议室浪费”“设备借用”或“数字化建议”</span></div>}</div>}</div>}<Notifications items={items} role={role} go={(targetPage, idea) => { setFilter('全部'); setPage(targetPage); setSelected(idea) }} flash={flash} /></header>
      {page === '总览' && <Dashboard items={items} pointRecords={pointRecords} go={(nextPage, nextFilter = '全部') => { setFilter(nextFilter); setPage(nextPage) }} open={setSelected} account={account} />} {page === 'AI 灵感探索' && <AIInsights items={items} initialQuery={insightQuery} initialResults={searchResults} initialIdea={insightIdea} initialMode={insightMode} openDetail={setSelected} />} {page === 'AI 助手' && <AIAssistant account={account} items={items} openDetail={setSelected} />} {page === '提交建议' && <Submit dept={account.dept} onSubmit={s => { void createIdeaInDatabase(account.name, s).then(database => { refreshData(database, account.name); setPage('我的建议'); flash('建议提交成功，获得 2 积分') }).catch(error => flash(error instanceof Error ? error.message : '数据库操作失败')) }} />}{['我的建议', '建议广场', '审核管理', '超级维护'].includes(page) && <List page={page} items={filtered} filter={filter} setFilter={setFilter} open={setSelected} toggle={toggle} role={role} />} {page === '系统管理' && <Admin flash={flash} />}</section>
    {selected && <Drawer key={selected.id} item={items.find(x => x.id === selected.id) || selected} page={page} account={account} close={() => setSelected(null)} action={action} resubmit={resubmit} toggle={toggle} onDataChange={database => refreshData(database, account.name)} />} {toast && <div className="toast">✓ {toast}</div>}</main>
}

function localAnalysis(idea: Idea): IdeaAnalysis { return { summary: `该建议聚焦${idea.dept}的日常痛点，通过“${idea.plan.replace(/[。；]/g, '，').slice(0, 42)}”推动流程改善。`, problem: idea.desc, value: `预计可减少重复沟通与人工操作，提升${idea.dept}的执行效率和过程可追溯性。`, feasibility: idea.plan.length > 25 ? '方案路径较清晰，可先选择小范围场景进行验证，再根据数据逐步推广。' : '方向可行，但需要补充责任人、实施周期和量化验收指标。', risks: ['需确认现有流程与系统接口是否支持', '推广前需明确数据权限与责任边界', '缺少基线数据时，改善效果可能难以量化'], nextSteps: ['访谈 3—5 名实际使用者，确认高频痛点', '选取一个班组或部门开展 2 周小范围试点', '记录耗时、使用率和异常数，形成前后对比'], source: 'local' } }

function localOverall(results: SearchResult[]): OverallAnalysis { const departments = [...new Set(results.map(x => x.idea.dept))]; return { summary: `本次共找到 ${results.length} 条已采纳建议，主要围绕流程提效、信息透明和自动提醒展开，覆盖${departments.slice(0, 3).join('、')}${departments.length > 3 ? '等部门' : ''}。`, themes: ['流程数字化与信息同步', '减少重复操作与等待', '用提醒和看板形成闭环'], patterns: ['从一线高频小问题切入', '先小范围试点，再逐步推广', '通过责任人和数据记录提升可追溯性'], opportunities: ['提炼跨部门可复用的标准方案', '建立实施前后的量化指标', '将相似建议合并为专题改善项目'], source: 'local' } }

type AssistantChatMessage = { id: string; role: 'assistant' | 'user'; text: string; response?: AssistantResponse };
function AIAssistant({ account, items, openDetail }: { account: Account; items: Idea[]; openDetail: (idea: Idea) => void }) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([{ id: 'welcome', role: 'assistant', text: `你好，${account.name}。我可以帮你查询本人建议的审核状态。目前也已经预留了已采纳建议检索、建议提交和公司知识问答入口。` }]);
  const [input, setInput] = useState(''), [sending, setSending] = useState(false), [error, setError] = useState('');
  const [ideaForm, setIdeaForm] = useState<AssistantIdeaForm | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending]);
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); const text = input.trim(); if (!text || sending) return;
    const userMessage: AssistantChatMessage = { id: `user-${Date.now()}`, role: 'user', text };
    setMessages(currentMessages => [...currentMessages, userMessage]); setInput(''); setError(''); setSending(true);
    try {
      const response = await chatWithAssistant(account.id, text, ideaForm, messages.slice(-12).map(message => ({ role: message.role, content: message.text })));
      setIdeaForm(response.idea_form?.phase === 'cancelled' || response.idea_form?.phase === 'submitted' ? null : response.idea_form || null);
      setMessages(currentMessages => [...currentMessages, { id: `assistant-${Date.now()}`, role: 'assistant', text: response.message, response }]);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'AI 助理暂时无法响应') }
    finally { setSending(false) }
  };
  const examples = ideaForm?.phase === 'awaiting_confirmation'
    ? ['确认提交', '取消提交', '标题改为会议室预约超时自动释放']
    : ['查询我的建议', '查询我的待初审建议', '我认为会议室预约后经常无人使用，建议超时自动释放'];
  return <div className="page assistant-page"><section className="assistant-shell"><aside className="assistant-guide"><div className="assistant-orb">✦</div><h2>我现在能做什么</h2><p>当前已开放“查询我的建议”，数据仅限当前登录账号。</p><div className="assistant-capabilities"><span className="ready">已开放</span><b>查询我的建议</b><small>状态、编号、审核反馈与页面路径</small><span>建设中</span><b>更多智能能力</b><small>已采纳建议RAG、建议提交、公司知识</small></div><h3>试着这样问</h3>{examples.map(example => <button key={example} onClick={() => setInput(example)}>{example}<i>↗</i></button>)}</aside><main className="assistant-chat"><header><div><i>{account.name[0]}</i><span><b>与你的专属助理对话</b><small>{account.name} · {account.dept}</small></span></div><em>不会查询其他用户的未采纳建议</em></header><div className="assistant-messages">{messages.map(message => <article className={`assistant-message ${message.role}`} key={message.id}><i>{message.role === 'assistant' ? '✦' : account.name[0]}</i><div><p>{message.text}</p>{message.response?.my_ideas?.length ? <section className="assistant-idea-list">{message.response.my_ideas.map(result => { const localIdea = items.find(item => item.id === result.id); return <button key={result.id} disabled={!localIdea} onClick={() => localIdea && openDetail(localIdea)}><span><b>{result.title}</b><small>{result.id} · {new Date(result.created_at).toLocaleDateString('zh-CN')}</small></span><em className={`status ${result.status}`}>{result.status}</em></button> })}</section> : null}</div></article>)}{sending && <article className="assistant-message assistant"><i>✦</i><div className="assistant-thinking"><span /><span /><span />正在查询</div></article>}<div ref={messageEndRef} /></div>{error && <p className="assistant-error">{error}，请确认Python AI服务仍在运行后重试。</p>}<form className="assistant-compose" onSubmit={send}><textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} maxLength={2000} placeholder="输入你的问题，例如：查询我的待初审建议" /><footer><small>Enter 发送 · Shift + Enter 换行</small><button disabled={!input.trim() || sending}>{sending ? '查询中…' : '发送　↑'}</button></footer></form></main></section></div>
}
function AIInsights({ items, initialQuery, initialResults, initialIdea, initialMode, openDetail }: { items: Idea[]; initialQuery: string; initialResults: SearchResult[]; initialIdea: Idea | null; initialMode: 'browse' | 'results' | 'single' | 'overall'; openDetail: (idea: Idea) => void }) {
  const [q, setQ] = useState(initialQuery), [results, setResults] = useState<SearchResult[]>(initialResults), [current, setCurrent] = useState<Idea | null>(initialIdea), [analysis, setAnalysis] = useState<IdeaAnalysis | null>(null), [overall, setOverall] = useState<OverallAnalysis | null>(null), [view, setView] = useState<'single' | 'overall'>(initialMode === 'overall' ? 'overall' : 'single'), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const analyze = async (idea: Idea) => { setCurrent(idea); setLoading(true); setAnalysis(null); setError(''); try { const response = await fetch('/api/analyze-idea', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea }) }); const data = await response.json() as IdeaAnalysis & { error?: string }; if (!response.ok || !data.summary) throw new Error(data.error || 'AI 解析失败'); setAnalysis(data) } catch { setAnalysis(localAnalysis(idea)); setError('AI 服务暂不可用，当前展示本地智能解析结果。') } finally { setLoading(false) } };
  const summarize = async (list: SearchResult[]) => { if (!list.length) return; setView('overall'); setCurrent(null); setLoading(true); setOverall(null); setError(''); try { const response = await fetch('/api/summarize-ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ideas: list.map(x => x.idea) }) }); const data = await response.json() as OverallAnalysis & { error?: string }; if (!response.ok || !data.summary) throw new Error(data.error || '整体洞察失败'); setOverall(data) } catch { setOverall(localOverall(list)); setError('AI 服务暂不可用，当前展示本地智能总结。') } finally { setLoading(false) } };
  useEffect(() => { if (initialMode === 'overall' && initialResults.length) summarize(initialResults); else if (initialMode === 'single' && initialIdea) analyze(initialIdea) }, []);
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!q.trim()) return; const next = smartSearch(items.filter(idea => idea.status === '已采纳'), q); setResults(next); setView('single'); setCurrent(null); setAnalysis(null); setOverall(null); setError('') };
  return <div className="page insight-page"><div className="insight-hero"><div><small>AI INSPIRATION EXPLORER</small><h1>和 AI 一起，发现值得借鉴的好点子</h1><p>在已采纳建议中智能检索，让 AI 帮你看懂亮点、价值和落地思路。</p></div><form onSubmit={submit}><span>⌕</span><input value={q} onChange={e => { const value = e.target.value; setQ(value); if (!value.trim() && !initialResults.length) { setResults([]); setCurrent(null); setAnalysis(null); setOverall(null); setError('') } }} placeholder="例如：设备数字化、会议室节能" /><button disabled={!q.trim()}>AI 智能探索</button></form></div><div className="insight-layout"><aside className="insight-results"><header><b>灵感结果</b><span>{results.length} 条已采纳建议</span></header>{results.length ? <><button className={'overall-result ' + (view === 'overall' ? 'active' : '')} onClick={() => summarize(results)}><strong>✦ 查看全部结果的整体洞察</strong><p>让 AI 总结共同主题、方法与创新机会</p></button>{results.map(({ idea, reason }) => <button key={idea.id} className={view === 'single' && current?.id === idea.id ? 'active' : ''} onClick={() => { setView('single'); analyze(idea) }}><span className={'status ' + idea.status}>{idea.status}</span><small>{idea.id} · {idea.dept}</small><strong>{idea.title}</strong><p>{idea.desc}</p><em>{reason}</em></button>)}</> : <div className="insight-empty"><b>输入一个工作中的小烦恼</b><span>AI 会从已采纳建议里，帮你找到可借鉴的灵感。</span></div>}</aside><section className="insight-analysis">{loading ? <div className="analysis-loading"><i>✦</i><b>{view === 'overall' ? 'AI 正在梳理全部灵感' : 'AI 正在读懂这个好点子'}</b><span>正在提炼共同主题、价值与落地路径…</span></div> : view === 'overall' && overall ? <><div className="analysis-head"><div><small>AI OVERALL INSIGHT · {results.length} 条建议</small><h2>本次检索的整体洞察</h2></div></div><div className="analysis-summary"><span>✦ AI 总结</span><p>{overall.summary}</p><small>{overall.source === 'local' ? '本地智能总结' : 'AI 智能总结'}</small></div>{error && <p className="analysis-note">{error}</p>}<div className="analysis-grid overall-grid"><article><span>01 · 高频主题</span><ul>{overall.themes.map(x => <li key={x}>{x}</li>)}</ul></article><article><span>02 · 共性做法</span><ul>{overall.patterns.map(x => <li key={x}>{x}</li>)}</ul></article><article><span>03 · 创新机会</span><ul>{overall.opportunities.map(x => <li key={x}>{x}</li>)}</ul></article><article><span>04 · 结果范围</span><p>本次洞察基于左侧全部 {results.length} 条已采纳建议生成，可点击任一建议继续查看单条解读。</p></article></div><button className="reanalyze" onClick={() => summarize(results)}>✦ 重新生成整体洞察</button></> : current ? <><div className="analysis-head"><div><span className={'status ' + current.status}>{current.status}</span><small>{current.id} · {current.author} · {current.dept}</small><h2>{current.title}</h2></div><button onClick={() => openDetail(current)}>看看完整建议 →</button></div>{analysis && <><div className="analysis-summary"><span>✦ AI 灵感速读</span><p>{analysis.summary}</p><small>{analysis.source === 'local' ? '本地智能解析' : 'AI 智能解析'}</small></div>{error && <p className="analysis-note">{error}</p>}<div className="analysis-grid"><article><span>01 · 它解决了什么</span><p>{analysis.problem}</p></article><article><span>02 · 好在哪里</span><p>{analysis.value}</p></article><article><span>03 · 能不能借鉴</span><p>{analysis.feasibility}</p></article><article><span>04 · 需要留意</span><ul>{analysis.risks.map(x => <li key={x}>{x}</li>)}</ul></article></div><div className="next-steps"><span>把灵感变成行动</span>{analysis.nextSteps.map((x, i) => <div key={x}><b>{i + 1}</b><p>{x}</p></div>)}</div><button className="reanalyze" onClick={() => analyze(current)}>✦ 重新生成单条解析</button></>}</> : <div className="analysis-loading analysis-welcome"><i>✦</i><b>{results.length ? '选择一条建议，或查看整体洞察' : '这里等待你的第一个灵感'}</b><span>{results.length ? '左侧展示全部检索结果。' : '输入关键词后，AI 智能助手会在这里呈现建议解读。'}</span></div>}</section></div></div>
}
function Notifications({items,role,go,flash}:{items:Idea[];role:Account['role'];go:(page:string,idea:Idea)=>void;flash:(message:string)=>void}){
  const[open,setOpen]=useState(false),[readIds,setReadIds]=useState<string[]>([]);
  const notices=[
    {id:'adopted',title:'你的建议已通过终审',detail:'查看已采纳建议及审核结果',ideaId:'MI-2026-031',page:'建议广场'},
    {id:'comments',title:'有 2 位同事评论了你的建议',detail:'查看评论内容并参与讨论',ideaId:'MI-2026-038',page:'我的建议'},
    {id:'review',title:'设备借用流程等待你审核',detail:'查看建议内容并完成处理',ideaId:'MI-2026-042',page:'审核管理'}
  ].filter(message=>role!=='灵感捕手'||message.id!=='review');
  const unreadCount=notices.filter(message=>!readIds.includes(message.id)).length;
  const openMessage=(message:typeof notices[number])=>{const idea=items.find(item=>item.id===message.ideaId);setReadIds(ids=>ids.includes(message.id)?ids:[...ids,message.id]);setOpen(false);if(idea)go(message.page,idea)};
  return <><div className="actions"><button className="bell message-button" onClick={()=>setOpen(!open)}>♢ <span>消息提示</span>{unreadCount>0&&<i>{unreadCount}</i>}</button><span className="role-badge">{role}</span></div>{open&&<div className="notices"><header><b>消息通知</b><small>{unreadCount} 条未读</small></header><div className="notice-list">{notices.map(message=><button className={'notice-item '+(readIds.includes(message.id)?'read':'')} key={message.id} onClick={()=>openMessage(message)}><i>●</i><span><b>{message.title}</b><small>{message.detail}</small></span><em>›</em></button>)}</div><button className="all-read" disabled={!unreadCount} onClick={()=>{setReadIds(notices.map(message=>message.id));setOpen(false);flash('已全部标记为已读')}}>全部已读</button></div>}</>
}
function Login({ accounts, onLogin }: { accounts: Account[]; onLogin: (a: Account) => void }) { const [name, setName] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''); const submit = (e: React.FormEvent) => { e.preventDefault(); const found = accounts.find(a => a.name === name.trim()); if (!found || password !== '123456') { setError('姓名或密码错误，请使用下方测试账号'); return } onLogin(found) }; return <main className="login-page"><section className="login-intro"><div className="login-brand"><b>微</b><span>微创新<small>INNOVATION HUB</small></span></div><div><small>MAKE SMALL IDEAS MATTER</small><h1>让每一个微小改进<br />都被看见。</h1><p>汇聚一线灵感，推动持续改善，让好想法真正落地。</p></div><footer>微创新建议平台 · 企业内部测试环境</footer></section><section className="login-panel"><form onSubmit={submit}><span className="login-kicker">WELCOME BACK</span><h2>登录微创新平台</h2><p>请输入测试账号进入对应角色工作台</p><label>姓名<input value={name} onChange={e => { setName(e.target.value); setError('') }} placeholder="请输入姓名" autoFocus /></label><label>密码<input type="password" value={password} onChange={e => { setPassword(e.target.value); setError('') }} placeholder="请输入密码" /></label>{error && <div className="login-error">! {error}</div>}<button className="primary">登录平台 →</button><div className="test-accounts"><b>测试账号</b>{accounts.map(a => <button type="button" key={a.name} onClick={() => { setName(a.name); setPassword('123456'); setError('') }}><span>{a.name}</span><small>{a.role}</small></button>)}<p>所有账号统一密码：<strong>123456</strong></p></div></form></section></main> }
function Dashboard({ items, pointRecords, go, open, account }: { items: Idea[]; pointRecords: PointRecord[]; go: (page: string, filter?: string) => void; open: (x: Idea) => void; account: Account }) {
  const [now, setNow] = useState(() => new Date()), [pointsOpen, setPointsOpen] = useState(false); useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer) }, []); const hour = now.getHours();
  const greeting = hour < 5 ? '凌晨好' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  const currentDate = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now);
  const mine = items.filter(x => x.author === account.name);
  const mineAdopted = mine.filter(x => x.status === '已采纳');
  const pendingMine = mine.filter(x => x.status !== '已采纳');
  const reviewCount = account.role === '灵感捕手' ? 0 : account.role === '建议初审' ? items.filter(x => x.status === '待初审').length : items.filter(x => ['待初审', '待终审'].includes(x.status)).length; const latestAdopted = [...items].filter(x => x.status === '已采纳').sort((a, b) => (b.adoptedAt || '').localeCompare(a.adoptedAt || '')).slice(0, 10); const scoreOf = (name: string) => pointRecords.filter(r => r.name === name).reduce((sum, r) => sum + r.points, 0); const leaders = pointProfiles.map(profile => ({ ...profile, points: scoreOf(profile.name) })).sort((a, b) => b.points - a.points).slice(0, 10); const departments = [...pointRecords.reduce((map, record) => map.set(record.dept, (map.get(record.dept) || 0) + record.points), new Map<string, number>())].map(([dept, points]) => ({ dept, points })).sort((a, b) => b.points - a.points).slice(0, 10); const myPointRecords = [...pointRecords].filter(record => record.name === account.name).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); return <><div className="page"><div className="welcome"><div><span>{currentDate}</span><h1>{greeting}，{account.name} <i>✦</i></h1><p>每一个小想法，都可能成为改变的起点。</p></div><button onClick={() => go('提交建议')}>说说你的新想法　→</button></div><div className="stats"><Stat n={String(mine.length)} l="我的建议" d="当前账号提交总数" c="mint" onClick={() => go('我的建议')} /><Stat n={String(mineAdopted.length)} l="已采纳" d="通过不同审核阶段获得积分" c="peach" onClick={() => go('我的建议', '已采纳')} /><Stat n={String(reviewCount)} l="待我审核" d={account.role === '灵感捕手' ? '当前角色无需审核' : '等待当前角色处理'} c="lilac" onClick={account.role === '灵感捕手' ? undefined : () => go('审核管理')} /><Stat n={String(scoreOf(account.name))} l="创新积分" d="提交 +2 · 初审 +5 · 终审 +10" c="blue" onClick={() => setPointsOpen(true)} /></div><div className="grid dashboard-rank-grid"><section className="panel queue"><Head e="MY PENDING IDEAS" t="待处理建议" on={() => go('我的建议')} /><div className="pending-list">{pendingMine.length ? pendingMine.map(x => <IdeaRow key={x.id} x={x} open={open} />) : <p className="empty-state">当前没有待处理的个人建议</p>}</div></section><section className="panel rank"><Head e="INSPIRATION · TOP 10" t="创新先锋" /><div className="rank-list">{leaders.map((leader, index) => <article className={leader.name === account.name ? 'me' : ''} key={leader.name}><strong>{index + 1}</strong><i>{leader.name[0]}</i><p><b>{leader.name}</b><small>{leader.dept}</small></p><span>{leader.points}<small> 积分</small></span></article>)}</div></section><section className="panel dept-rank"><Head e="DEPARTMENT · TOP 10" t="部门创新力" /><div>{departments.map((department, index) => <article className={department.dept === account.dept ? 'me' : ''} key={department.dept}><strong>{index + 1}</strong><i>{department.dept[0]}</i><p><b>{department.dept}</b><small>部门累计积分</small></p><span>{department.points}<small> 积分</small></span></article>)}</div></section></div><section className="panel adopted"><Head e="LATEST ADOPTED" t="最新采纳" on={() => go('建议广场')} /><div className="adopted-list">{latestAdopted.map(x => <article className="latest-card" onClick={() => open(x)} key={x.id}><div className="adopted-card-line"><h3>{x.title}</h3><time>{x.adoptedAt ? new Date(x.adoptedAt).toLocaleDateString('zh-CN') : '-'}</time></div><p className="adopted-card-desc"><b>建议内容</b><span>{x.desc}</span></p><p className="adopted-card-plan"><b>改进措施</b><span>{x.plan || '暂未填写'}</span></p><footer><span className="adopted-author"><i>{x.author[0]}</i><em>{x.author}</em><small>{x.dept}</small></span><b>♡ {x.likes}　◌ {x.comments}</b></footer></article>)}</div></section></div>{pointsOpen && <PointDetails records={myPointRecords} items={items} close={() => setPointsOpen(false)} />}</>
}
function Head({ e, t, on }: { e: string; t: string; on?: () => void }) { return <div className="head"><div><small>{e}</small><h2>{t}</h2></div>{on && <button onClick={on}>查看全部 →</button>}</div> }
function Stat({ n, l, d, c, onClick }: { n: string; l: string; d: string; c: string; onClick?: () => void }) { const content = <><i>✦</i><div><strong>{n}</strong><b>{l}</b><small>{d}</small></div></>; return onClick ? <button type="button" className={'stat stat-link ' + c} onClick={onClick}>{content}</button> : <div className={'stat ' + c}>{content}</div> }
function PointDetails({ records, items, close }: { records: PointRecord[]; items: Idea[]; close: () => void }) { return <div className="overlay points-overlay" onClick={close}><section className="points-modal" onClick={e => e.stopPropagation()}><button className="close" onClick={close} aria-label="关闭积分明细">×</button><small>POINT DETAILS</small><h2>积分明细</h2><p>每一笔积分的来源与当前建议状态。</p><div className="points-table-wrap"><table><thead><tr><th>建议</th><th>状态</th><th>获取积分</th><th>时间</th></tr></thead><tbody>{records.map(record => { const idea = items.find(item => item.id === record.ideaId); return <tr key={record.id}><td><b>{idea?.title || record.reason}</b>{idea && <small>{idea.id}</small>}</td><td>{idea ? <span className={'status ' + idea.status}>{idea.status}</span> : <span className="status settled">历史结转</span>}</td><td><strong>+{record.points}</strong></td><td>{new Date(record.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</td></tr> })}</tbody></table></div></section></div> }
function IdeaRow({ x, open }: { x: Idea; open: (x: Idea) => void }) { return <article className="idea" onClick={() => open(x)}><i>{x.dept[0]}</i><div><div className="idea-meta"><span className={'status ' + x.status}>{x.status}</span><small>{x.id} · {x.date}</small></div><h3>{x.title}</h3><p>{x.desc}</p><footer><span>{x.author} · {x.dept}</span><b>查看详情 →</b></footer></div></article> }
function Submit({ onSubmit, dept }: { onSubmit: (x: any) => void; dept: string }) {
  const [f, setF] = useState({ title: '', desc: '', plan: '', dept }), [polishing, setPolishing] = useState(false), [suggestion, setSuggestion] = useState(''), [aiError, setAiError] = useState('');
  const runPolish = async () => { if (!f.title.trim() || polishing) return; setPolishing(true); setSuggestion(''); setAiError(''); try { const response = await fetch('/api/polish-title', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: f.title }) }); const data = await response.json() as { title?: string; error?: string }; if (!response.ok || !data.title) throw new Error(data.error || 'AI 润色失败'); setSuggestion(data.title) } catch (error) { setAiError(error instanceof Error ? error.message : 'AI 润色暂时不可用') } finally { setPolishing(false) } };
  return <div className="page narrow"><Title e="NEW IDEA" h="提交一条微创新" p="清楚描述问题和改进思路，让好想法更快落地。" />
    <form className="panel form" onSubmit={e => { e.preventDefault(); onSubmit(f) }}>
      <Field t="建议标题 *" count={`${f.title.length}/50`}><div className="title-input"><input required maxLength={50} value={f.title} onChange={e => { setF({ ...f, title: e.target.value }); setSuggestion(''); setAiError('') }} placeholder="例如：优化会议室预约流程" /><button type="button" className="ai-polish" disabled={!f.title.trim() || polishing} onClick={runPolish}><i>✦</i>{polishing ? '润色中…' : 'AI 润色'}</button></div>
        {aiError && <p className="ai-error">! {aiError}</p>}
        {suggestion && <div className="ai-suggestion"><div><span><i>✦</i> AI 润色建议</span><small>表达更清晰、行动导向更明确</small></div><p>{suggestion}</p><footer><button type="button" onClick={() => setSuggestion('')}>取消</button><button type="button" onClick={runPolish}>换一个</button><button type="button" className="use-suggestion" onClick={() => { setF({ ...f, title: suggestion }); setSuggestion('') }}>采用此标题</button></footer></div>}
      </Field><Field t="问题描述 *" count={`${f.desc.length}/500`}><textarea required maxLength={500} value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder="请描述当前问题、发生场景及影响…" /></Field><Field t="改进方案" count={`${f.plan.length}/500`}><textarea maxLength={500} value={f.plan} onChange={e => setF({ ...f, plan: e.target.value })} placeholder="你的具体方案和预期效果…" /></Field>
      <Field t="所属部门 *"><input value={dept} readOnly aria-readonly="true" title="所属部门与当前账号绑定，不可修改" /><small className="field-hint">部门由当前账号自动带入，不可修改</small></Field>
      <div className="upload">＋<b>点击或拖拽上传附件</b><small>图片、PDF、Office 文件，单个不超过 10MB</small></div>
      <div className="form-buttons"><button type="button">保存草稿</button>
        <button className="primary">提交建议 →</button></div></form></div>
}
function Field({ t, count, children }: { t: string; count?: string; children: React.ReactNode }) { return <label>{t}<small>{count}</small>{children}</label> }
function Title({ e, h, p }: { e: string; h: string; p: string }) { return <div className="title"><small>{e}</small><h1>{h}</h1><p>{p}</p></div> }
function List({ page, items, filter, setFilter, open, toggle, role }: { page: string; items: Idea[]; filter: string; setFilter: (s: string) => void; open: (x: Idea) => void; toggle: (id: string, k: 'liked' | 'collected') => void; role: Account['role'] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('');
  const [sortMode, setSortMode] = useState<'时间最新' | '点赞最多' | '收藏最多' | '评论最多'>('时间最新');
  const lastWheelAt = useRef(0);
  const isPaged = ['我的建议', '建议广场', '审核管理'].includes(page);
  const reviewResult = ['已采纳', '已驳回'].includes(filter);
  const reviewList = filter === '全部'
    ? items.filter(x => ['待初审', '待终审'].includes(x.status) || (['已采纳', '已驳回'].includes(x.status) && x.reviewedByRole === role))
    : reviewResult
      ? items.filter(x => x.reviewedByRole === role).sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''))
      : items;
  const plazaList = [...items.filter(x => x.status === '已采纳')].sort((a, b) => {
    if (sortMode === '时间最新') {
      const timeDifference = Date.parse(b.adoptedAt || '') - Date.parse(a.adoptedAt || '');
      return Number.isNaN(timeDifference) || timeDifference === 0 ? b.id.localeCompare(a.id) : timeDifference;
    }
    const metric = sortMode === '点赞最多' ? 'likes' : sortMode === '收藏最多' ? 'saved' : 'comments';
    return b[metric] - a[metric];
  });
  const list = page === '建议广场'
    ? plazaList
    : page === '审核管理'
      ? reviewList
      : items;
  const totalPages = isPaged ? Math.max(1, Math.ceil(list.length / 9)) : 1;
  const activePage = Math.min(currentPage, totalPages);
  const pageWindowSize = 6;
  const pageWindowStart = Math.min(Math.max(activePage - 2, 1), Math.max(totalPages - pageWindowSize + 1, 1));
  const visiblePageNumbers = Array.from({ length: Math.min(pageWindowSize, totalPages) }, (_, index) => pageWindowStart + index);
  const visibleList = isPaged ? list.slice((activePage - 1) * 9, activePage * 9) : list;
  const changePage = (next: number) => { setCurrentPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }) };
  const wheelPage = (event: React.WheelEvent) => {
    event.preventDefault();
    const now = Date.now();
    if (now - lastWheelAt.current < 180) return;
    const direction = event.deltaX || event.deltaY;
    if (!direction) return;
    lastWheelAt.current = now;
    changePage(Math.min(totalPages, Math.max(1, activePage + (direction > 0 ? 1 : -1))));
  };
  const submitJump = (event: React.FormEvent) => {
    event.preventDefault();
    const target = Number.parseInt(jumpPage, 10);
    if (!Number.isFinite(target)) return;
    changePage(Math.min(totalPages, Math.max(1, target)));
    setJumpPage('');
  };
  useEffect(() => { setCurrentPage(1) }, [page, filter, role, sortMode]);
  return <div className={`page${isPaged ? ' compact-list-page' : ''}`}>
    {page === '建议广场' ? <div className="plaza-heading"><Title e="IDEAS & IMPROVEMENTS" h={page} p="发现值得被看见的好想法，与同事一起参与改进。" /><div className="idea-sort"><span>排序</span>{([{ mode: '时间最新', icon: '◷' }, { mode: '点赞最多', icon: '♡' }, { mode: '收藏最多', icon: '☆' }, { mode: '评论最多', icon: '◌' }] as const).map(option => <button className={sortMode === option.mode ? 'active' : ''} onClick={() => setSortMode(option.mode)} key={option.mode}><i>{option.icon}</i>{option.mode}</button>)}</div></div> : <Title e="IDEAS & IMPROVEMENTS" h={page} p={page === '审核管理' ? '请及时查看建议内容并完成流程处理。' : '管理建议全生命周期与可见状态。'} />}
    {page !== '建议广场' && <div className="tabs">{['全部', '待初审', '待终审', '已采纳', '已驳回'].map(t => <button className={filter === t ? 'active' : ''} onClick={() => { setFilter(t); setCurrentPage(1) }} key={t}>{t}</button>)}</div>}
    {page === '建议广场' && <div className="tabs plaza-divider" aria-hidden="true" />}
    <div className="cards">{visibleList.map(x => <article className="card" key={x.id} onClick={() => open(x)}><div><span className={'status ' + x.status}>{x.status}</span><small>{x.id}</small></div><h3>{x.title}</h3><p>{x.desc}</p><aside><i>{x.author[0]}</i>{x.author} · {x.dept}<time>{page === '审核管理' && reviewResult && x.reviewedAt ? new Date(x.reviewedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : x.date}</time></aside><footer className={x.status === '已采纳' ? 'has-interactions' : 'detail-only'}>{x.status === '已采纳' && <div className="card-actions"><button onClick={e => { e.stopPropagation(); toggle(x.id, 'liked') }}>♡ {x.likes}</button><button>◌ {x.comments}</button><button onClick={e => { e.stopPropagation(); toggle(x.id, 'collected') }}>☆ {x.saved}</button></div>}<b>查看详情 →</b></footer></article>)}</div>
    {isPaged && <nav className="pagination" aria-label={`${page}分页`}><button className="page-step" disabled={activePage === 1} onClick={() => changePage(activePage - 1)}>‹ 上一页</button><div className="page-number-window" onWheel={wheelPage} title="鼠标滚轮可前后翻页">{visiblePageNumbers.map(number => <button className={`page-number${activePage === number ? ' active' : ''}`} key={number} onClick={() => changePage(number)}>{number}</button>)}</div><button className="page-step" disabled={activePage === totalPages} onClick={() => changePage(activePage + 1)}>下一页 ›</button><form className="page-jump" onSubmit={submitJump}><input type="number" min="1" max={totalPages} value={jumpPage} onChange={event => setJumpPage(event.target.value)} placeholder="页码" aria-label="输入跳转页码" /><button type="submit" disabled={!jumpPage}>跳转</button></form></nav>}
  </div>
}
function Drawer({ item, page, account, close, action, resubmit, toggle, onDataChange }: { item: Idea; page: string; account: Account; close: () => void; action: (id: string, s: Status, m: string) => void; resubmit: (id: string, changes: Pick<Idea, 'title' | 'desc' | 'plan'>) => void; toggle: (id: string, k: 'liked' | 'collected') => void; onDataChange: (database: MockDatabase) => void }) {
  const [edit, setEdit] = useState({ title: item.title, desc: item.desc, plan: item.plan });
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [commentText, setCommentText] = useState(''), [commentNote, setCommentNote] = useState(''), [replyingTo, setReplyingTo] = useState<string | null>(null), [replyTarget, setReplyTarget] = useState(''), [replyText, setReplyText] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [smartRead, setSmartRead] = useState<SmartReadResult | null>(null), [smartReading, setSmartReading] = useState(false), [smartReadNote, setSmartReadNote] = useState('');
  useEffect(() => { void fetchDatabase().then(database => setComments(getThreadComments(item.id, database))) }, [item.id]);
  const submitComment = (e: React.FormEvent) => { e.preventDefault(); if (!commentText.trim()) return; setCommentNote('正在保存…'); void addCommentToDatabase(item.id, account.name, commentText.trim()).then(database => { setComments(getThreadComments(item.id, database)); onDataChange(database); setCommentText(''); setCommentNote('评论已保存到数据库') }).catch(error => setCommentNote(error instanceof Error ? error.message : '评论保存失败')) };
  const beginReply = (commentId: string, author: string) => { setReplyingTo(commentId); setReplyTarget(author); setReplyText('') };
  const submitReply = (e: React.FormEvent, commentId: string) => { e.preventDefault(); if (!replyText.trim()) return; void addReplyToDatabase(item.id, commentId, account.name, replyTarget, replyText.trim()).then(database => { setComments(getThreadComments(item.id, database)); onDataChange(database); setReplyText(''); setReplyingTo(null); setReplyTarget('') }) };
  const runSmartRead = async () => {
    if (smartReading) return;
    setSmartReading(true); setSmartRead(null); setSmartReadNote('');
    try {
      const response = await fetch('/api/smart-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea: item }) });
      const data = await response.json() as SmartReadResult & { error?: string };
      if (!response.ok || !data.summary) throw new Error(data.error || '智能阅读失败');
      setSmartRead(data);
    } catch {
      setSmartRead({ summary: item.title, problem: item.desc.slice(0, 30) + (item.desc.length > 30 ? '…' : ''), action: item.plan.slice(0, 30) + (item.plan.length > 30 ? '…' : ''), source: 'local' });
      setSmartReadNote('AI 服务暂不可用，当前展示本地精简摘要。');
    } finally { setSmartReading(false) }
  };
  const sortedComments = [...comments].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const discussionCount = comments.reduce((sum, comment) => sum + 1 + comment.replies.length, 0);
  const canInitialReview = page === '审核管理' && account.role === '建议初审' && item.status === '待初审';
  const canFinalReview = page === '审核管理' && account.role === '建议终审' && item.status === '待终审';
  const canResubmit = page === '我的建议' && item.author === account.name && item.status === '已驳回';
  return <div className="overlay" onClick={close}>
    <aside className="drawer idea-drawer" onClick={e => e.stopPropagation()}>
      <button className="close" onClick={close} aria-label="关闭详情">×</button>
      <div className="drawer-meta"><span className={'status ' + item.status}>{item.status}</span><small>{item.id} · {item.date}</small></div>
      {canResubmit ? <form className="returned-edit" onSubmit={e => { e.preventDefault(); resubmit(item.id, edit) }}>
        <label>建议标题<input required maxLength={50} value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} /></label>
        <label>问题描述<textarea required maxLength={500} value={edit.desc} onChange={e => setEdit({ ...edit, desc: e.target.value })} /></label>
        <label>改进方案<textarea maxLength={500} value={edit.plan} onChange={e => setEdit({ ...edit, plan: e.target.value })} /></label>
        <button className="primary">重新提交审核 →</button>
      </form> : <>
        <h2>{item.title}</h2>
        <div className="author author-card"><i>{item.author[0]}</i><b>{item.author}<small>{item.dept}</small></b></div>
        <div className="idea-detail-grid"><section><small>PROBLEM</small><h4>问题描述</h4><p>{item.desc}</p></section><section><small>SOLUTION</small><h4>改进方案</h4><p>{item.plan}</p></section></div>
        <section className="smart-read-card">
          <header><div><small>SMART READING</small><h3>智能阅读</h3></div><button onClick={runSmartRead} disabled={smartReading}>{smartReading ? '正在总结…' : smartRead ? '重新总结' : '一键总结'}</button></header>
          {smartRead ? <div className="smart-read-result"><p>{smartRead.summary}</p><span><b>问题：</b>{smartRead.problem}</span><span><b>做法：</b>{smartRead.action}</span>{smartReadNote && <em>{smartReadNote}</em>}</div> : <p className="smart-read-hint">用几句话快速看懂这条建议，不展开深度分析。</p>}
        </section>
        {item.status === '已采纳' && <>
        <div className="social"><button className={item.liked ? 'active' : ''} onClick={() => toggle(item.id, 'liked')}>♡ <b>{item.likes}</b> 点赞</button><button className={item.collected ? 'active' : ''} onClick={() => toggle(item.id, 'collected')}>☆ <b>{item.saved}</b> 收藏</button><button onClick={() => document.getElementById(`comments-${item.id}`)?.scrollIntoView({ behavior: 'smooth' })}>◌ <b>{discussionCount}</b> 评论</button></div>
        <section className="comments-panel" id={`comments-${item.id}`}>
          <header><div><small>DISCUSSION</small><h3>评论与讨论</h3></div><span>{discussionCount} 条</span></header>
          <form className="comment-compose" onSubmit={submitComment}><i>{account.name[0]}</i><div><textarea maxLength={300} value={commentText} onChange={e => { setCommentText(e.target.value); setCommentNote('') }} placeholder="写下你的看法、补充或建议…" /><footer><small>{commentText.length}/300</small><button className="primary" disabled={!commentText.trim()}>发表评论</button></footer>{commentNote && <small className="comment-save-note">{commentNote}</small>}</div></form>
          <div className="comment-list">{sortedComments.map(comment => <article className="comment-item" key={comment.id}><i>{comment.author[0]}</i><div>
            <header><b>{comment.author}</b><time>{comment.time}</time></header><p>{comment.content}</p>
            <button className="reply-trigger" onClick={() => beginReply(comment.id, comment.author)}>↩ 回复</button>
            {[...comment.replies].sort((a, b) => a.createdAt - b.createdAt).map(reply => <div className="comment-reply" key={reply.id}><i>{reply.author[0]}</i><div><header><b>{reply.author}</b><time>{reply.time}</time></header><p>{reply.replyTo && <span className="reply-to">@{reply.replyTo} </span>}{reply.content}</p><button className="reply-trigger" onClick={() => beginReply(comment.id, reply.author)}>↩ 回复</button></div></div>)}
            {replyingTo === comment.id && <form className="reply-compose" onSubmit={e => submitReply(e, comment.id)}><input autoFocus maxLength={200} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={`回复 ${replyTarget}…`} /><button disabled={!replyText.trim()}>发送</button></form>}
          </div></article>)}</div>
        </section>
        </>}
      </>}
      {(canInitialReview || canFinalReview) && <div className="review"><label>审核意见<textarea maxLength={200} value={reviewComment} onChange={event => setReviewComment(event.target.value)} placeholder="请填写审核意见（最多200字）" /></label><div><button disabled={!reviewComment.trim()} onClick={() => action(item.id, '已驳回', reviewComment.trim())}>驳回调整</button>{canInitialReview && <button disabled={!reviewComment.trim()} onClick={() => action(item.id, '待终审', reviewComment.trim())}>提交终审</button>}<button className="primary" disabled={!reviewComment.trim()} onClick={() => action(item.id, '已采纳', reviewComment.trim())}>采纳并公示</button></div></div>}
      {page === '审核管理' && !canInitialReview && !canFinalReview && ['待终审'].includes(item.status) && account.role === '建议初审' && <div className="review-readonly">该建议已提交终审，当前角色仅可查看，等待建议终审处理。</div>}
    </aside>
  </div>
}
function Admin({ flash }: { flash: (s: string) => void }) { return <div className="page"><Title e="SYSTEM SETTINGS" h="系统管理" p="配置角色菜单权限与企业部门结构。" /><div className="admin">{['灵感捕手', '审核员', '建议终审'].map((r, i) => <section className="panel" key={r}><i>{['灵', '初', '终'][i]}</i><h3>{r}</h3><p>{['普通员工，提交与参与建议互动', '负责建议初审及直接采纳', '负责终审和平台管理'][i]}</p>{nav.slice(1).map(([n]) => <label key={n}><input type="checkbox" defaultChecked={i === 2 || i === 1 && !['系统管理', '超级维护'].includes(n) || i === 0 && !['审核管理', '系统管理', '超级维护'].includes(n)} />{n}</label>)}<button onClick={() => flash(`${r}权限配置已保存`)}>保存配置</button></section>)}</div></div> }
