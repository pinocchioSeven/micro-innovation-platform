import {NextResponse} from 'next/server';

type IdeaInput={id?:string;title?:string;desc?:string;plan?:string;dept?:string};

export async function POST(request:Request){
  try{
    const {ideas}=await request.json() as {ideas?:IdeaInput[]};
    if(!ideas?.length)return NextResponse.json({error:'没有可总结的建议'},{status:400});
    const apiKey=process.env.API_KEY,model=process.env.OPENAI_MODEL;
    if(!apiKey||!model)return NextResponse.json({error:'AI 服务尚未完成配置'},{status:503});
    const response=await fetch('https://api.apiyi.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,messages:[{role:'system',content:'你是企业创新洞察顾问。综合分析多条已采纳建议，返回严格 JSON，不要 markdown。字段为 summary（总体总结）、themes（3条高频主题）、patterns（3条共性做法）、opportunities（3条创新机会）。不得编造数据或收益。'},{role:'user',content:JSON.stringify(ideas.slice(0,20))}],temperature:0.4,enable_thinking:false,max_tokens:1200,response_format:{type:'json_object'}})});
    const data=await response.json() as {choices?:Array<{message?:{content?:string}}> ;error?:{message?:string}};
    if(!response.ok)throw new Error(data.error?.message||`上游服务请求失败（${response.status}）`);
    const content=data.choices?.[0]?.message?.content;
    if(!content)throw new Error('AI 未返回有效总结');
    return NextResponse.json({...JSON.parse(content.replace(/^```json\s*|\s*```$/g,'')),source:'ai'});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'AI 整体洞察暂时不可用'},{status:500})}
}
