import type { Account, Idea, PointRecord } from '../idea-data';
import type { MockDatabase } from '../data/schema';

export type ThreadReplyView = { id: string; author: string; content: string; time: string; createdAt: number; replyTo?: string };
export type ThreadCommentView = { id: string; author: string; content: string; time: string; createdAt: number; replies: ThreadReplyView[] };

const displayTime = (iso: string) => new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

export function getAccounts(database: MockDatabase): Account[] {
  return database.users.filter(user => user.enabled).map(user => ({ id: user.id, name: user.name, role: user.role, dept: database.departments.find(dept => dept.id === user.departmentId)?.name || '未知部门' }));
}

export function getIdeaViews(database: MockDatabase, currentUserName?: string): Idea[] {
  const currentUser = database.users.find(user => user.name === currentUserName);
  return database.ideas.map(idea => {
    const author = database.users.find(row => row.id === idea.authorId);
    const department = database.departments.find(row => row.id === author?.departmentId);
    if (!author || !department) throw new Error(`建议 ${idea.id} 的关联数据不完整`);
    const actions = database.ideaUserActions.filter(row => row.ideaId === idea.id);
    const comments = database.comments.filter(row => row.ideaId === idea.id && !row.deleted);
    const lastReview = [...database.ideaLifecycleRecords].filter(row => row.ideaId === idea.id && ['初审通过', '初审退回', '终审通过', '终审退回', '历史导入'].includes(row.action)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return {
      id: idea.id, title: idea.title, desc: idea.description, plan: idea.plan, author: author.name, dept: department.name,
      date: displayTime(idea.createdAt), status: idea.status, likes: idea.status === '已采纳' ? actions.filter(row => row.actionType === 'liked').length : 0,
      comments: idea.status === '已采纳' ? comments.length : 0, saved: idea.status === '已采纳' ? actions.filter(row => row.actionType === 'collection').length : 0,
      reviewedAt: lastReview?.updatedAt, reviewedByRole: lastReview?.operatorRole === '灵感捕手' ? undefined : lastReview?.operatorRole,
      adoptedAt: idea.status === '已采纳' ? lastReview?.updatedAt : undefined,
      liked: Boolean(idea.status === '已采纳' && currentUser && actions.some(row => row.userId === currentUser.id && row.actionType === 'liked')),
      collected: Boolean(idea.status === '已采纳' && currentUser && actions.some(row => row.userId === currentUser.id && row.actionType === 'collection')),
    };
  });
}

export function getPointViews(database: MockDatabase): PointRecord[] {
  return database.pointRecords.map(record => ({ id: record.id, name: database.users.find(user => user.id === record.userId)?.name || '未知用户', dept: database.departments.find(dept => dept.id === record.departmentId)?.name || '未知部门', points: record.points, reason: record.reason, createdAt: record.createdAt, ideaId: record.ideaId }));
}

export function getThreadComments(ideaId: string, database: MockDatabase): ThreadCommentView[] {
  if (database.ideas.find(idea => idea.id === ideaId)?.status !== '已采纳') return [];
  const rows = database.comments.filter(row => row.ideaId === ideaId && !row.deleted);
  return rows.filter(row => !row.parentId).map(root => ({ id: root.id, author: database.users.find(user => user.id === root.authorId)?.name || '未知用户', content: root.content, time: displayTime(root.createdAt), createdAt: Date.parse(root.createdAt), replies: rows.filter(row => row.parentId === root.id).map(reply => ({ id: reply.id, author: database.users.find(user => user.id === reply.authorId)?.name || '未知用户', content: reply.content, time: displayTime(reply.createdAt), createdAt: Date.parse(reply.createdAt), replyTo: database.users.find(user => user.id === reply.replyToUserId)?.name })) }));
}
