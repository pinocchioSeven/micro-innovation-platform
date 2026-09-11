import type { Idea, Status } from '../idea-data';
import type { MockDatabase } from '../data/schema';

const API = 'http://127.0.0.1:3001';
async function request(path: string, body?: object): Promise<MockDatabase> {
  const response = await fetch(`${API}${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = await response.json() as MockDatabase & { error?: string };
  if (!response.ok) throw new Error(data.error || '本地数据库服务不可用');
  return data;
}
export const fetchDatabase = () => request('/database');
export const createIdeaInDatabase = (accountName: string, input: Pick<Idea, 'title' | 'desc' | 'plan'>) => request('/ideas', { accountName, ...input });
export const transitionIdeaInDatabase = (ideaId: string, accountName: string, toStatus: Status, comment: string) => request('/transition', { ideaId, accountName, toStatus, comment });
export const resubmitIdeaInDatabase = (ideaId: string, accountName: string, input: Pick<Idea, 'title' | 'desc' | 'plan'>) => request('/resubmit', { ideaId, accountName, ...input });
export const toggleIdeaActionInDatabase = (ideaId: string, accountName: string, actionType: 'liked' | 'collection') => request('/toggle-action', { ideaId, accountName, actionType });
export const addCommentToDatabase = (ideaId: string, accountName: string, content: string) => request('/comments', { ideaId, accountName, content });
export const addReplyToDatabase = (ideaId: string, parentId: string, accountName: string, replyToName: string, content: string) => request('/replies', { ideaId, parentId, accountName, replyToName, content });
