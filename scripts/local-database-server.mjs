import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const databasePath = resolve(process.cwd(), 'data', 'micro-innovation-seed.db');
const database = new DatabaseSync(databasePath);
database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
const port = 3001;
// 本地预览可能通过 localhost 或 127.0.0.1 打开；服务不使用 Cookie，允许本地跨源访问。
const allowedOrigin = '*';

const all = (sql, ...params) => database.prepare(sql).all(...params);
const get = (sql, ...params) => database.prepare(sql).get(...params);
const run = (sql, ...params) => database.prepare(sql).run(...params);
const uid = prefix => `${prefix}-${randomUUID()}`;
const nextDailyId = (table, prefix) => {
  if (!['comments', 'idea_lifecycle_records', 'point_records'].includes(table)) throw new Error('不支持的编号类型');
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const idPrefix = `${prefix}-${day}-`;
  const rows = all(`SELECT id FROM ${table} WHERE id LIKE ? ORDER BY id DESC`, `${idPrefix}%`);
  const next = rows.reduce((max, row) => Math.max(max, Number(row.id.slice(idPrefix.length)) || 0), 0) + 1;
  return `${idPrefix}${String(next).padStart(4, '0')}`;
};
const json = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
};
const bodyOf = request => new Promise((resolveBody, reject) => { let body = ''; request.on('data', chunk => { body += chunk; if (body.length > 1_000_000) reject(new Error('请求内容过大')); }); request.on('end', () => { try { resolveBody(body ? JSON.parse(body) : {}) } catch { reject(new Error('JSON格式错误')) } }); request.on('error', reject); });
const transaction = callback => { database.exec('BEGIN IMMEDIATE'); try { const result = callback(); database.exec('COMMIT'); return result } catch (error) { database.exec('ROLLBACK'); throw error } };

function readDatabase() {
  const departments = all('SELECT id,name,enabled FROM departments ORDER BY id').map(row => ({ ...row, enabled: Boolean(row.enabled) }));
  const users = all('SELECT id,name,role,department_id,enabled,created_at FROM users ORDER BY id').map(row => ({ id: row.id, name: row.name, role: row.role, departmentId: row.department_id, enabled: Boolean(row.enabled), createdAt: row.created_at }));
  const ideas = all('SELECT id,author_id,title,description,plan,status,created_at FROM ideas ORDER BY created_at DESC,id DESC').map(row => ({ id: row.id, authorId: row.author_id, title: row.title, description: row.description, plan: row.plan, status: row.status, createdAt: row.created_at }));
  const ideaLifecycleRecords = all('SELECT id,idea_id,action,operator_id,operator_role,from_status,to_status,comment,updated_at FROM idea_lifecycle_records ORDER BY updated_at,id').map(row => ({ id: row.id, ideaId: row.idea_id, action: row.action, ...(row.operator_id ? { operatorId: row.operator_id } : {}), operatorRole: row.operator_role, ...(row.from_status ? { fromStatus: row.from_status } : {}), toStatus: row.to_status, ...(row.comment ? { comment: row.comment } : {}), updatedAt: row.updated_at }));
  const comments = all('SELECT id,idea_id,author_id,parent_id,reply_to_user_id,content,created_at,deleted FROM comments ORDER BY created_at,id').map(row => ({ id: row.id, ideaId: row.idea_id, authorId: row.author_id, ...(row.parent_id ? { parentId: row.parent_id } : {}), ...(row.reply_to_user_id ? { replyToUserId: row.reply_to_user_id } : {}), content: row.content, createdAt: row.created_at, deleted: Boolean(row.deleted) }));
  const ideaUserActions = all('SELECT id,idea_id,user_id,action_type,created_at FROM idea_user_actions ORDER BY created_at,id').map(row => ({ id: row.id, ideaId: row.idea_id, userId: row.user_id, actionType: row.action_type, createdAt: row.created_at }));
  const pointRecords = all('SELECT id,user_id,department_id,idea_id,lifecycle_record_id,points,reason,source_type,created_at FROM point_records ORDER BY created_at,id').map(row => ({ id: row.id, userId: row.user_id, departmentId: row.department_id, ...(row.idea_id ? { ideaId: row.idea_id } : {}), ...(row.lifecycle_record_id ? { lifecycleRecordId: row.lifecycle_record_id } : {}), points: Number(row.points), reason: row.reason, sourceType: row.source_type, createdAt: row.created_at }));
  const maxNumber = ideas.reduce((max, idea) => Math.max(max, Number(idea.id.split('-').at(-1)) || 0), 0);
  return { meta: { version: 2, ideaNumberYear: 2026, nextIdeaNumber: maxNumber + 1, createdAt: ideas.at(-1)?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }, departments, users, ideas, ideaLifecycleRecords, comments, ideaUserActions, pointRecords };
}

function requireUser(name) { const user = get('SELECT * FROM users WHERE name=? AND enabled=1', name); if (!user) throw new Error('当前用户不存在或未启用'); return user }
function requireIdea(ideaId) { const idea = get('SELECT * FROM ideas WHERE id=?', ideaId); if (!idea) throw new Error('建议不存在'); return idea }
function requireAdoptedIdea(ideaId) { const idea = requireIdea(ideaId); if (idea.status !== '已采纳') throw new Error('只有已采纳建议可以点赞、收藏或评论'); return idea }

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (request.method === 'GET' && url.pathname === '/database') return json(response, 200, readDatabase());
    if (request.method !== 'POST') return json(response, 404, { error: '接口不存在' });
    const input = await bodyOf(request);
    if (url.pathname === '/ideas') transaction(() => {
      const user = requireUser(input.accountName); const now = new Date().toISOString(); const currentYear = new Date().getFullYear(); const max = get("SELECT MAX(CAST(substr(id,length(id)-2) AS INTEGER)) AS value FROM ideas WHERE id LIKE ?", `MI-${currentYear}-%`)?.value || 0; const ideaId = `MI-${currentYear}-${String(Number(max) + 1).padStart(3, '0')}`; const lifecycleId = nextDailyId('idea_lifecycle_records', 'LIFECYCLE');
      run('INSERT INTO ideas(id,author_id,title,description,plan,status,created_at) VALUES(?,?,?,?,?,?,?)', ideaId, user.id, input.title, input.desc, input.plan || '', '待初审', now);
      run('INSERT INTO idea_lifecycle_records(id,idea_id,action,operator_id,operator_role,to_status,comment,updated_at) VALUES(?,?,?,?,?,?,?,?)', lifecycleId, ideaId, '提交', user.id, user.role, '待初审', '首次提交建议', now);
      run('INSERT INTO point_records(id,user_id,department_id,idea_id,lifecycle_record_id,points,reason,source_type,created_at) VALUES(?,?,?,?,?,?,?,?,?)', nextDailyId('point_records', 'POINT'), user.id, user.department_id, ideaId, lifecycleId, 2, '提交建议', '提交建议', now);
    });
    else if (url.pathname === '/transition') transaction(() => {
      const user = requireUser(input.accountName); const idea = requireIdea(input.ideaId); const reviewComment = String(input.comment || '').trim(); if (!reviewComment) throw new Error('请填写审核意见'); if (reviewComment.length > 200) throw new Error('审核意见不能超过200字'); const now = new Date().toISOString(); let action;
      if (user.role === '建议初审' && idea.status === '待初审' && ['待终审', '已驳回'].includes(input.toStatus)) action = input.toStatus === '待终审' ? '初审通过' : '初审退回';
      else if (user.role === '建议终审' && idea.status === '待终审' && ['已采纳', '已驳回'].includes(input.toStatus)) action = input.toStatus === '已采纳' ? '终审通过' : '终审退回';
      else throw new Error('当前角色不能执行该状态流转');
      const lifecycleId = nextDailyId('idea_lifecycle_records', 'LIFECYCLE'); run('UPDATE ideas SET status=? WHERE id=?', input.toStatus, idea.id);
      run('INSERT INTO idea_lifecycle_records(id,idea_id,action,operator_id,operator_role,from_status,to_status,comment,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', lifecycleId, idea.id, action, user.id, user.role, idea.status, input.toStatus, reviewComment, now);
      const points = action === '初审通过' ? 5 : action === '终审通过' ? 10 : 0; if (points) { const author = get('SELECT department_id FROM users WHERE id=?', idea.author_id); run('INSERT INTO point_records(id,user_id,department_id,idea_id,lifecycle_record_id,points,reason,source_type,created_at) VALUES(?,?,?,?,?,?,?,?,?)', nextDailyId('point_records', 'POINT'), idea.author_id, author.department_id, idea.id, lifecycleId, points, action, action, now) }
    });
    else if (url.pathname === '/resubmit') transaction(() => {
      const user = requireUser(input.accountName); const idea = requireIdea(input.ideaId); if (idea.author_id !== user.id || idea.status !== '已驳回') throw new Error('只有建议作者可以修改并重新提交已驳回建议'); const now = new Date().toISOString();
      run('UPDATE ideas SET title=?,description=?,plan=?,status=?,created_at=? WHERE id=?', input.title, input.desc, input.plan || '', '待初审', now, idea.id);
      run('INSERT INTO idea_lifecycle_records(id,idea_id,action,operator_id,operator_role,from_status,to_status,comment,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', nextDailyId('idea_lifecycle_records', 'LIFECYCLE'), idea.id, '重新提交', user.id, user.role, idea.status, '待初审', '驳回后覆盖原建议并重新提交', now);
    });
    else if (url.pathname === '/toggle-action') transaction(() => {
      const user = requireUser(input.accountName); requireAdoptedIdea(input.ideaId); if (!['liked', 'collection'].includes(input.actionType)) throw new Error('互动类型无效'); const existing = get('SELECT id FROM idea_user_actions WHERE idea_id=? AND user_id=? AND action_type=?', input.ideaId, user.id, input.actionType);
      if (existing) run('DELETE FROM idea_user_actions WHERE id=?', existing.id); else run('INSERT INTO idea_user_actions(id,idea_id,user_id,action_type,created_at) VALUES(?,?,?,?,?)', uid('ACTION'), input.ideaId, user.id, input.actionType, new Date().toISOString());
    });
    else if (url.pathname === '/comments') transaction(() => { const user = requireUser(input.accountName); requireAdoptedIdea(input.ideaId); if (!String(input.content || '').trim()) throw new Error('评论内容不能为空'); run('INSERT INTO comments(id,idea_id,author_id,content,created_at,deleted) VALUES(?,?,?,?,?,0)', nextDailyId('comments', 'COMMENT'), input.ideaId, user.id, String(input.content).trim(), new Date().toISOString()) });
    else if (url.pathname === '/replies') transaction(() => { const user = requireUser(input.accountName); requireAdoptedIdea(input.ideaId); if (!String(input.content || '').trim()) throw new Error('回复内容不能为空'); const parent = get('SELECT id,idea_id FROM comments WHERE id=?', input.parentId); if (!parent || parent.idea_id !== input.ideaId) throw new Error('父评论不存在'); const replyTo = get('SELECT id FROM users WHERE name=?', input.replyToName); run('INSERT INTO comments(id,idea_id,author_id,parent_id,reply_to_user_id,content,created_at,deleted) VALUES(?,?,?,?,?,?,?,0)', nextDailyId('comments', 'COMMENT'), input.ideaId, user.id, parent.id, replyTo?.id || null, String(input.content).trim(), new Date().toISOString()) });
    else return json(response, 404, { error: '接口不存在' });
    return json(response, 200, readDatabase());
  } catch (error) { return json(response, 500, { error: error instanceof Error ? error.message : '数据库操作失败' }); }
});

server.listen(port, '127.0.0.1', () => process.stdout.write(`Local SQLite API: http://127.0.0.1:${port}\nDatabase: ${databasePath}\n`));
const close = () => server.close(() => { database.close(); process.exit(0) });
process.on('SIGINT', close); process.on('SIGTERM', close);
