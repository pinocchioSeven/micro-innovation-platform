export type UserRole = '灵感捕手' | '建议初审' | '建议终审';
export type IdeaStatus = '待审核' | '待终审' | '已采纳' | '已退回';
export type IdeaLifecycleAction = '历史导入' | '提交' | '编辑' | '初审通过' | '初审退回' | '终审通过' | '终审退回' | '重新提交';
export type IdeaActionType = 'like' | 'collect';
export type PointSourceType = '历史结转' | '提交建议' | '初审通过' | '终审通过' | '人工调整';

export type DepartmentRow = { 
  id: string; 
  name: string; 
  enabled: boolean 
};
export type UserRow = { 
  id: string; 
  name: string; 
  role: UserRole; 
  departmentId: string; 
  enabled: boolean 
};
export type IdeaRow = { 
  id: string; 
  authorId: string; 
  submittedDepartmentId: string; 
  currentVersionId: string; 
  status: IdeaStatus; 
  createdAt: string; 
  updatedAt: string 
};
export type IdeaVersionRow = { 
  id: string; 
  ideaId: string; 
  ersionNumber: number; 
  previousVersionId?: string; 
  title: string; 
  description: string; 
  plan: string; 
  createdById: string; 
  createdAt: string; 
  changeSummary?: string };
export type IdeaLifecycleRecordRow = { id: string; ideaId: string; versionId: string; action: IdeaLifecycleAction; operatorId?: string; operatorRole: UserRole; fromStatus?: IdeaStatus; toStatus: IdeaStatus; comment?: string; createdAt: string };
export type CommentRow = { id: string; ideaId: string; authorId: string; parentId?: string; replyToUserId?: string; content: string; createdAt: string; deleted: boolean };
export type IdeaUserActionRow = { id: string; ideaId: string; userId: string; actionType: IdeaActionType; createdAt: string };
export type PointRecordRow = { id: string; userId: string; departmentId: string; ideaId?: string; lifecycleRecordId?: string; points: number; reason: string; sourceType: PointSourceType; createdAt: string };


export type MockDatabase = {
  meta: { version: number; ideaNumberYear: number; nextIdeaNumber: number; createdAt: string; updatedAt: string };
  departments: DepartmentRow[];
  users: UserRow[];
  ideas: IdeaRow[];
  ideaVersions: IdeaVersionRow[];
  ideaLifecycleRecords: IdeaLifecycleRecordRow[];
  comments: CommentRow[];
  ideaUserActions: IdeaUserActionRow[];
  pointRecords: PointRecordRow[];
};
