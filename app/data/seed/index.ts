import { accounts, initialPointRecords, pointProfiles, seed } from '../../idea-data';
import type { CommentRow, DepartmentRow, IdeaLifecycleRecordRow, IdeaRow, IdeaUserActionRow, MockDatabase, PointRecordRow, UserRow } from '../schema';

const importedAt = '2026-08-25T00:00:00.000Z';
const baseDate = new Date('2026-08-24T12:00:00+08:00');
const safeId = (prefix: string, index: number) => `${prefix}-${String(index + 1).padStart(3, '0')}`;

function legacyDate(value: string): string {
  if (value === '刚刚') return importedAt;
  if (value.startsWith('今天')) return `2026-08-24T${value.slice(3)}:00+08:00`;
  if (value.startsWith('昨天')) return `2026-08-23T${value.slice(3)}:00+08:00`;
  if (/^\d{2}-\d{2}$/.test(value)) return `2026-${value}T12:00:00+08:00`;
  const parsed = new Date(value || baseDate);
  return Number.isNaN(parsed.getTime()) ? importedAt : parsed.toISOString();
}

const departmentNames = [...new Set([
  ...accounts.map(x => x.dept), ...pointProfiles.map(x => x.dept), ...seed.map(x => x.dept),
])];
export const seedDepartments: DepartmentRow[] = departmentNames.map((name, index) => ({ id: safeId('DEPT', index), name, enabled: true }));
const departmentIdByName = new Map(seedDepartments.map(row => [row.name, row.id]));

const accountRoleByName = new Map(accounts.map(row => [row.name, row.role]));
const people = [...new Map([
  ...accounts.map(x => [x.name, x.dept] as const),
  ...pointProfiles.map(x => [x.name, x.dept] as const),
  ...seed.map(x => [x.author, x.dept] as const),
].map(row => [row[0], row])).values()];
export const seedUsers: UserRow[] = people.map(([name, dept], index) => ({
  id: safeId('USER', index), name, role: accountRoleByName.get(name) || '灵感捕手', departmentId: departmentIdByName.get(dept)!, enabled: accounts.some(account => account.name === name), createdAt: importedAt,
}));
const userIdByName = new Map(seedUsers.map(row => [row.name, row.id]));

export const seedIdeas: IdeaRow[] = [];
export const seedIdeaLifecycleRecords: IdeaLifecycleRecordRow[] = [];

seed.forEach((legacy, index) => {
  const createdAt = legacyDate(legacy.date);
  const updatedAt = legacy.adoptedAt || legacy.reviewedAt || createdAt;
  const status = legacy.status;
  seedIdeas.push({ id: legacy.id, authorId: userIdByName.get(legacy.author)!, title: legacy.title, description: legacy.desc, plan: legacy.plan, status, createdAt });
  seedIdeaLifecycleRecords.push({ id: `LIFECYCLE-IMPORT-${String(index + 1).padStart(3, '0')}`, ideaId: legacy.id, action: '历史导入', operatorId: userIdByName.get(legacy.author), operatorRole: legacy.reviewedByRole || accountRoleByName.get(legacy.author) || '灵感捕手', toStatus: status, comment: legacy.reviewedByRole ? `原数据记录为${legacy.reviewedByRole}处理` : '从原始静态数据导入', updatedAt });
});

export const seedPointRecords: PointRecordRow[] = initialPointRecords.map(record => {
  const user = seedUsers.find(x => x.name === record.name)!;
  return { id: record.id, userId: user.id, departmentId: departmentIdByName.get(record.dept)!, ideaId: record.ideaId, points: record.points, reason: record.reason, sourceType: '历史结转', createdAt: record.createdAt };
});

const discussionIdeaId = seedIdeas.some(x => x.id === 'MI-2026-031') ? 'MI-2026-031' : seedIdeas[0]?.id;
const discussionIdea = seedIdeas.find(x => x.id === discussionIdeaId);
export const seedComments: CommentRow[] = discussionIdea ? [
  { id: 'COMMENT-20251223-0001', ideaId: discussionIdea.id, authorId: userIdByName.get('陈嘉言')!, content: '这个问题在跨部门协作时很常见，建议试点时同步记录平均借用时长。', createdAt: new Date(1766504280000).toISOString(), deleted: false },
  { id: 'COMMENT-20251223-0002', ideaId: discussionIdea.id, authorId: discussionIdea.authorId, parentId: 'COMMENT-20251223-0001', replyToUserId: userIdByName.get('陈嘉言')!, content: '收到，我会把借用时长和逾期次数都加入试点指标。', createdAt: new Date(1766504760000).toISOString(), deleted: false },
  { id: 'COMMENT-20251223-0003', ideaId: discussionIdea.id, authorId: userIdByName.get('顾宁')!, content: '方案方向清晰，可以补充紧急借用场景下的审批规则。', createdAt: new Date(1766507100000).toISOString(), deleted: false },
] : [];
export const seedIdeaUserActions: IdeaUserActionRow[] = seed.find(x => x.liked) && discussionIdea ? [
  { id: 'ACTION-SEED-001', ideaId: discussionIdea.id, userId: discussionIdea.authorId, actionType: 'liked', createdAt: importedAt },
] : [];

const maxIdeaNumber = Math.max(...seed.map(x => Number(x.id.split('-').at(-1)) || 0), 42);
export const seedDatabase: MockDatabase = {
  meta: { version: 1, ideaNumberYear: 2026, nextIdeaNumber: maxIdeaNumber + 1, createdAt: importedAt, updatedAt: importedAt },
  departments: seedDepartments,
  users: seedUsers,
  ideas: seedIdeas,
  ideaLifecycleRecords: seedIdeaLifecycleRecords,
  comments: seedComments,
  ideaUserActions: seedIdeaUserActions,
  pointRecords: seedPointRecords,
};
