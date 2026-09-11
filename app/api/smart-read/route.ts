import {NextResponse} from 'next/server';

type IdeaInput={title?:string;desc?:string;plan?:string;dept?:string};

export async function POST(request:Request){
  try{
    const {idea}=await request.json() as {idea?:IdeaInput};
    if(!idea?.title?.trim()||!idea.desc?.trim())return NextResponse.json({error:'建议内容不完整'},{status:400});
    const apiKey=process.env.API_KEY,model=process.env.OPENAI_MODEL;
    if(!apiKey||!model)return NextResponse.json({error:'AI 服务尚未完成配置'},{status:503});
    const response=await fetch('https://api.apiyi.com/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
      body:JSON.stringify({
        model,
        messages:[
          {role:'system',content:'你是企业建议平台的智能阅读助手。请用普通员工一眼能看懂的直白中文，极简总结单条建议。严格返回 JSON，不要 markdown，字段仅为 summary、problem、action。summary 不超过45字，problem 和 action 各不超过30字。不要使用咨询术语，不得编造数据。'},
          {role:'user',content:JSON.stringify(idea)}
        ],
        temperature:0.3,
        enable_thinking:false,
        max_tokens:300,
        response_format:{type:'json_object'}
      })
    });
    const data=await response.json() as {choices?:Array<{message?:{content?:string}}> ;error?:{message?:string}};
    if(!response.ok)throw new Error(data.error?.message||`上游服务请求失败（${response.status}）`);
    const content=data.choices?.[0]?.message?.content;
    if(!content)throw new Error('AI 未返回有效总结');
    return NextResponse.json({...JSON.parse(content.replace(/^```json\s*|\s*```$/g,'')),source:'ai'});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'智能阅读暂时不可用'},{status:500})}
}
