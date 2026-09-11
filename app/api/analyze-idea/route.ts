import { NextResponse } from 'next/server';

type IdeaInput = { title?: string; desc?: string; plan?: string; dept?: string };

export async function POST(request: Request) {
  try {
    const { idea } = await request.json() as { idea?: IdeaInput };
    if (!idea?.title?.trim() || !idea.desc?.trim()) return NextResponse.json({ error: '建议内容不完整' }, { status: 400 });
    const apiKey = process.env.API_KEY, model = process.env.OPENAI_MODEL;
    if (!apiKey || !model) return NextResponse.json({ error: 'AI 服务尚未完成配置' }, { status: 503 });
    const response = await fetch('https://api.apiyi.com/v1/chat/completions',
      {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, messages: [{
            role: 'system',
            content: '你是企业微创新项目分析顾问。请基于用户提供的建议，返回严格 JSON，不要 markdown。字段必须为 summary、problem、value、feasibility、risks、nextSteps；前四项为简洁中文字符串，后两项为各含3条中文字符串的数组。不得编造具体收益数字。'
          },
          { role: 'user', content: JSON.stringify(idea) }],
          temperature: 0.4,
          enable_thinking: false,
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        })
      });
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message || `上游服务请求失败（${response.status}）`);
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI 未返回有效解析');
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ''));
    return NextResponse.json({ ...parsed, source: 'ai' });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'AI 解析暂时不可用' }, { status: 500 }) }
}
