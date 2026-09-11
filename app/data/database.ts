import type { MockDatabase } from './schema';
import { seedDatabase } from './seed';

const STORAGE_KEY = 'micro-innovation-database-v1';
export const cloneDatabase = (database: MockDatabase): MockDatabase => structuredClone(database);

export function loadDatabase(): MockDatabase {
  if (typeof window === 'undefined') return cloneDatabase(seedDatabase);
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) { const database = cloneDatabase(seedDatabase); saveDatabase(database); return database; }
  try {
    const database = JSON.parse(saved) as MockDatabase;
    if (database.meta?.version !== seedDatabase.meta.version) throw new Error('旧版数据');
    return database;
  } catch {
    const database = cloneDatabase(seedDatabase); saveDatabase(database); return database;
  }
}

export function saveDatabase(database: MockDatabase): void {
  if (typeof window === 'undefined') return;
  database.meta.updatedAt = new Date().toISOString();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
}

export function resetDatabase(): MockDatabase {
  const database = cloneDatabase(seedDatabase);
  saveDatabase(database);
  return database;
}
