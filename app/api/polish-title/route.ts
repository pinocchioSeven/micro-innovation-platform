import {NextResponse} from 'next/server';

export async function POST(request:Request){
  try{
    const {title}=await request.json() as {title?:string};
    const cleanTitle=title?.trim();
    if(!cleanTitle)return NextResponse.json({error:'请先输入需要润色的标题'},{status:400});
    if(cleanTitle.length>50)return NextResponse.json({error:'标题不能超过50个字'},{status:400});

    const apiKey=process.env.API_KEY;
    const model=process.env.OPENAI_MODEL;
    if(!apiKey||!model)return NextResponse.json({error:'AI 服务尚未完成配置'},{status:500});

    const response=await fetch('https://api.apiyi.com/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
      body:JSON.stringify({
        model,
        messages:[
          {role:'system',content:'你是企业微创新建议标题编辑。将用户标题润色得清晰、简洁、专业、有行动导向。只返回一个润色后的中文标题，不要解释，不要引号，不超过50个汉字，不得编造原标题中没有的信息。'},
          {role:'user',content:cleanTitle}
        ],
        temperature:0.7,
        top_p:0.8,
        presence_penalty:1.5,
        enable_thinking:false,
        max_tokens:256
      })
    });
    const data=await response.json() as {choices?:Array<{message?:{content?:string}}> ;error?:{message?:string}};
    if(!response.ok)throw new Error(data.error?.message||`上游服务请求失败（${response.status}）`);
    const polished=data.choices?.[0]?.message?.content?.trim().replace(/^[“”"']|[“”"']$/g,'').slice(0,50);
    if(!polished)throw new Error('AI 未返回有效标题');
    return NextResponse.json({title:polished});
  }catch(error){
    const message=error instanceof Error?error.message:'AI 润色暂时不可用';
    return NextResponse.json({error:message},{status:500});
  }
}
