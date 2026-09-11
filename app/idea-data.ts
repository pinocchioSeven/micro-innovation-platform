import {realisticIdeas} from './realistic-ideas';

export type Status='待初审'|'待终审'|'已采纳'|'已驳回';

export type Idea={
  id:string;title:string;desc:string;plan:string;author:string;dept:string;date:string;status:Status;
  likes:number;comments:number;saved:number;adoptedAt?:string;reviewedAt?:string;
  reviewedByRole?:'建议初审'|'建议终审';liked?:boolean;collected?:boolean;
};

export type Account={id:string;name:string;role:'灵感捕手'|'建议初审'|'建议终审';dept:string};

export type PointProfile={name:string;dept:string};
export type PointRecord={id:string;name:string;dept:string;points:number;reason:string;createdAt:string;ideaId?:string};

export const accounts:Account[]=[
  {name:'林澄',role:'灵感捕手',dept:'生产运营部'},
  {name:'周文清',role:'灵感捕手',dept:'智能制造部'},
  {name:'陈嘉言',role:'建议初审',dept:'数字化中心'},
  {name:'顾宁',role:'建议终审',dept:'综合管理部'}
];

export const pointProfiles:PointProfile[]=[
  ['周文清','智能制造部'],['陈嘉言','数字化中心'],['顾宁','综合管理部'],['许知远','研发中心'],['沈悦','安全环保部'],
  ['赵一帆','质量管理部'],['苏宁川','市场运营部'],['林澄','生产运营部'],['唐若溪','供应链部'],['陆明','财务管理部'],
  ['叶青','人力资源部'],['韩雪','客户服务部'],['方启明','物流仓储部'],['吴桐','信息安全部'],['谢安然','工程建设部'],
  ['蒋一鸣','智能制造部'],['宋雨欣','数字化中心'],['邵文博','综合管理部'],['章若楠','研发中心'],['程浩','安全环保部'],
  ['袁佳','质量管理部'],['夏晨','市场运营部'],['秦朗','生产运营部'],['罗静','供应链部'],['高远','财务管理部'],
  ['任思齐','人力资源部'],['杜欣怡','客户服务部'],['魏然','物流仓储部'],['潘越','信息安全部'],['梁辰','工程建设部'],
  ['贺川','智能制造部'],['孟琪','数字化中心'],['白露','综合管理部'],['江一诺','研发中心'],['康宁','安全环保部'],
  ['傅航','质量管理部'],['乔薇','市场运营部'],['戴维','生产运营部'],['毛晓彤','供应链部'],['石磊','财务管理部'],
  ['曹悦','人力资源部'],['金睿','客户服务部'],['郑凯','物流仓储部'],['侯宁','信息安全部'],['彭宇','工程建设部'],
  ['卢嘉','智能制造部'],['崔璐','数字化中心'],['钟毅','综合管理部'],['范晨曦','研发中心'],['武洁','安全环保部']
].map(([name,dept])=>({name,dept}));

export const initialPointRecords:PointRecord[]=[
  ['周文清','智能制造部',240],['陈嘉言','数字化中心',190],['顾宁','综合管理部',165],['许知远','研发中心',158],
  ['沈悦','安全环保部',146],['赵一帆','质量管理部',138],['苏宁川','市场运营部',129],['林澄','生产运营部',120],
  ['唐若溪','供应链部',112],['陆明','财务管理部',105]
].map(([name,dept,points],index)=>({id:`history-${index+1}`,name:String(name),dept:String(dept),points:Number(points),reason:'历史积分结转',createdAt:'2026-08-01T00:00:00'}));

export const searchConcepts:Record<string,string[]>={
  会议室:['会议室','预约','签到','空间','自动释放'],
  设备:['设备','借用','归还','预约'],
  生产:['生产','一线','班组','晨会','现场'],
  效率:['效率','优化','自动','统一','提醒','流程'],
  浪费:['浪费','闲置','无人使用','低库存','重复'],
  数字化:['数字化','系统','自动','看板','信息'],
  耗材:['耗材','库存','打印纸','墨盒','采购'],
  访客:['访客','登记','访客码','信息录入'],
  分享:['分享','经验','知识','复制'],
  安全:['安全','环保','风险']
};

const featuredIdeas:Idea[]=[
  {id:'MI-2026-042',title:'优化跨部门设备借用流程',desc:'设备借用依赖纸质登记，信息同步不及时，归还节点也难以追踪。',plan:'上线统一预约看板，绑定责任人并在归还前自动提醒。',author:'周文清',dept:'智能制造部',date:'今天 09:42',status:'待初审',likes:18,comments:6,saved:8},
  {id:'MI-2026-041',title:'生产异常信息移动端快速上报',desc:'生产现场出现异常后需要返回工位填写记录，信息传递较慢。',plan:'提供移动端扫码上报入口，自动关联设备、产线和当班责任人。',author:'林澄',dept:'生产运营部',date:'今天 08:35',status:'待初审',likes:27,comments:8,saved:12},
  {id:'MI-2026-040',title:'设备点检任务增加到期提醒',desc:'设备点检主要依靠纸质计划，容易遗漏临近到期的检查任务。',plan:'建立数字化点检清单，并在到期前向负责人发送提醒。',author:'赵一帆',dept:'质量管理部',date:'昨天 17:10',status:'待初审',likes:22,comments:5,saved:9},
  {id:'MI-2026-039',title:'供应商资料统一归档与检索',desc:'供应商资质和合同分散在不同人员处，查找资料耗时较长。',plan:'按供应商建立统一电子档案，支持标签分类和到期提醒。',author:'唐若溪',dept:'供应链部',date:'昨天 16:48',status:'待初审',likes:16,comments:4,saved:11},
  {id:'MI-2026-038',title:'生产晨会增加三分钟改善分享',desc:'一线的小改善缺少轻量分享渠道，优秀经验难以快速复制。',plan:'每天由一个班组分享一项可复用改进，沉淀为现场知识卡片。',author:'林澄',dept:'生产运营部',date:'昨天 16:20',status:'待终审',likes:34,comments:11,saved:15},
  {id:'MI-2026-037',title:'质量问题照片自动关联工单',desc:'质量异常照片单独保存在手机中，后续难以对应具体产品和工单。',plan:'拍照时扫描工单二维码，自动绑定批次、工位和异常类型。',author:'赵一帆',dept:'质量管理部',date:'08-21',status:'待终审',likes:42,comments:13,saved:18},
  {id:'MI-2026-036',title:'危险作业审批增加天气风险提示',desc:'户外危险作业审批时需要人工查询天气，极端天气风险容易被忽略。',plan:'审批页面自动获取天气预警，并对高温、大风和雷电作业进行提示。',author:'沈悦',dept:'安全环保部',date:'08-21',status:'待终审',likes:39,comments:9,saved:17},
  {id:'MI-2026-035',title:'员工常见问题建立智能知识卡片',desc:'员工重复咨询报销、考勤和系统操作问题，占用大量沟通时间。',plan:'整理高频问题形成知识卡片，通过关键词检索快速查看标准答案。',author:'陈嘉言',dept:'数字化中心',date:'08-20',status:'待终审',likes:55,comments:16,saved:29},
  {id:'MI-2026-034',title:'物流车辆入厂预约错峰管理',desc:'物流车辆集中到厂时容易在门岗排队，影响卸货效率和道路通行。',plan:'按卸货能力开放预约时段，向司机推送建议到厂时间。',author:'唐若溪',dept:'供应链部',date:'08-20',status:'待初审',likes:31,comments:7,saved:14},
  {id:'MI-2026-033',title:'办公区域照明按使用状态自动关闭',desc:'会议区和公共办公区下班后偶尔长时间亮灯，造成能源浪费。',plan:'结合人体感应和时间策略关闭无人区域照明，并保留手动控制。',author:'顾宁',dept:'综合管理部',date:'08-19',status:'待终审',likes:63,comments:14,saved:25},
  {id:'MI-2026-032',title:'研发测试设备共享预约看板',desc:'测试设备由不同项目组分别管理，设备空闲情况不透明，存在重复采购。',plan:'建立共享预约看板，展示设备状态、使用人和预计释放时间。',author:'许知远',dept:'研发中心',date:'08-19',status:'待初审',likes:47,comments:12,saved:21},
  {id:'MI-2026-031',title:'会议室无人使用自动释放',desc:'会议室被预约后经常无人使用，临时会议却找不到可用空间。',plan:'预约开始10分钟内无人签到，系统自动释放并通知预约人。',author:'陈嘉言',dept:'数字化中心',date:'08-18',status:'已采纳',likes:128,comments:24,saved:46,adoptedAt:'2026-08-20T09:30:00',reviewedAt:'2026-08-20T09:30:00',reviewedByRole:'建议终审',liked:true},
  {id:'MI-2026-030',title:'报销单据扫码自动识别填报',desc:'员工报销需要手工录入发票号码、金额和日期，重复操作较多。',plan:'扫描发票自动识别关键字段，并校验重复报销和金额一致性。',author:'陆明',dept:'财务管理部',date:'08-18',status:'已采纳',likes:104,comments:21,saved:40,adoptedAt:'2026-08-19T11:20:00',reviewedAt:'2026-08-19T11:20:00',reviewedByRole:'建议初审'},
  {id:'MI-2026-029',title:'生产换线工具定点颜色管理',desc:'换线工具使用后摆放位置不统一，寻找和清点会占用准备时间。',plan:'按产线划分颜色和固定位置，使用轮廓标识提示工具归位。',author:'林澄',dept:'生产运营部',date:'08-17',status:'已采纳',likes:91,comments:18,saved:35,adoptedAt:'2026-08-19T08:40:00',reviewedAt:'2026-08-19T08:40:00',reviewedByRole:'建议终审'},
  {id:'MI-2026-028',title:'安全隐患随手拍闭环跟踪',desc:'现场隐患通过聊天工具反馈后，整改责任和完成情况难以持续追踪。',plan:'扫码提交隐患照片和位置，自动分派责任人并记录整改验收过程。',author:'沈悦',dept:'安全环保部',date:'08-17',status:'已采纳',likes:117,comments:26,saved:44,adoptedAt:'2026-08-18T16:30:00',reviewedAt:'2026-08-18T16:30:00',reviewedByRole:'建议初审'},
  {id:'MI-2026-027',title:'办公耗材设置低库存提醒',desc:'耗材补充依赖人工巡查，偶尔出现打印纸或墨盒临时短缺。',plan:'设置安全库存阈值，低于阈值时自动形成采购提醒。',author:'顾宁',dept:'综合管理部',date:'08-16',status:'已采纳',likes:86,comments:17,saved:31,adoptedAt:'2026-08-18T14:10:00',reviewedAt:'2026-08-18T14:10:00',reviewedByRole:'建议终审'},
  {id:'MI-2026-026',title:'客户反馈按产品类型自动分派',desc:'客户反馈由人工转发给不同产品负责人，处理过程容易延迟。',plan:'根据产品、问题类型和区域自动分派，并设置超时升级提醒。',author:'苏宁川',dept:'市场运营部',date:'08-15',status:'已采纳',likes:78,comments:15,saved:28,adoptedAt:'2026-08-17T10:00:00',reviewedAt:'2026-08-17T10:00:00',reviewedByRole:'建议初审'},
  {id:'MI-2026-024',title:'工位空调温度分区设置',desc:'同一区域不同工位对温度需求差异较大，频繁调整影响舒适度和能耗。',plan:'按照日照和人员密度进行温度分区，并限制合理调节范围。',author:'顾宁',dept:'综合管理部',date:'08-14',status:'已驳回',likes:14,comments:9,saved:6,reviewedAt:'2026-08-16T15:20:00',reviewedByRole:'建议终审'},
  {id:'MI-2026-021',title:'项目周报自动汇总关键进展',desc:'项目成员分别填写周报后仍需人工整理进度、风险和下周计划。',plan:'按固定模板提取关键字段，自动生成项目汇总和风险清单。',author:'许知远',dept:'研发中心',date:'08-13',status:'已驳回',likes:19,comments:7,saved:10,reviewedAt:'2026-08-15T10:15:00',reviewedByRole:'建议初审'},
  {id:'MI-2026-019',title:'访客登记信息一次录入',desc:'访客在不同区域重复填写相同信息，体验不佳。',plan:'通过访客码复用已授权信息。',author:'沈悦',dept:'安全环保部',date:'08-12',status:'已驳回',likes:9,comments:3,saved:2,reviewedAt:'2026-08-14T09:40:00',reviewedByRole:'建议终审'}
];

export const seed:Idea[]=[...featuredIdeas,...realisticIdeas];
