import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SOURCE = DATA_DIR / "structured-seed.json"
DATABASE = DATA_DIR / "micro-innovation-seed.db"
SQL_DUMP = DATA_DIR / "micro-innovation-seed.sql"

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('灵感捕手', '建议初审', '建议终审')),
  department_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('待初审', '待终审', '已采纳', '已驳回')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE idea_lifecycle_records (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('历史导入', '提交', '编辑', '初审通过', '初审退回', '终审通过', '终审退回', '重新提交')),
  operator_id TEXT,
  operator_role TEXT NOT NULL CHECK (operator_role IN ('灵感捕手', '建议初审', '建议终审')),
  from_status TEXT CHECK (from_status IS NULL OR from_status IN ('待初审', '待终审', '已采纳', '已驳回')),
  to_status TEXT NOT NULL CHECK (to_status IN ('待初审', '待终审', '已采纳', '已驳回')),
  comment TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (idea_id) REFERENCES ideas(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  parent_id TEXT,
  reply_to_user_id TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
  FOREIGN KEY (idea_id) REFERENCES ideas(id),
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES comments(id),
  FOREIGN KEY (reply_to_user_id) REFERENCES users(id)
);

CREATE TABLE idea_user_actions (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('liked', 'collection')),
  created_at TEXT NOT NULL,
  UNIQUE (idea_id, user_id, action_type),
  FOREIGN KEY (idea_id) REFERENCES ideas(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE point_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  idea_id TEXT,
  lifecycle_record_id TEXT,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('历史结转', '提交建议', '初审通过', '终审通过', '人工调整')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (idea_id) REFERENCES ideas(id),
  FOREIGN KEY (lifecycle_record_id) REFERENCES idea_lifecycle_records(id)
);

CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_ideas_author ON ideas(author_id);
CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_lifecycle_idea ON idea_lifecycle_records(idea_id, updated_at);
CREATE INDEX idx_comments_idea ON comments(idea_id, created_at);
CREATE INDEX idx_actions_idea ON idea_user_actions(idea_id, action_type);
CREATE INDEX idx_points_user ON point_records(user_id, created_at);
CREATE INDEX idx_points_department ON point_records(department_id, created_at);

CREATE TRIGGER comments_only_for_adopted_before_insert
BEFORE INSERT ON comments
WHEN (SELECT status FROM ideas WHERE id = NEW.idea_id) <> '已采纳'
BEGIN SELECT RAISE(ABORT, '只有已采纳建议可以评论'); END;

CREATE TRIGGER actions_only_for_adopted_before_insert
BEFORE INSERT ON idea_user_actions
WHEN (SELECT status FROM ideas WHERE id = NEW.idea_id) <> '已采纳'
BEGIN SELECT RAISE(ABORT, '只有已采纳建议可以点赞或收藏'); END;
"""

def values(row, columns):
    return tuple(row.get(column) for column in columns)

def build():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    if DATABASE.exists():
        DATABASE.unlink()
    connection = sqlite3.connect(DATABASE)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(SCHEMA)
    with connection:
        connection.executemany("INSERT INTO departments(id,name,enabled) VALUES(?,?,?)", [(r["id"], r["name"], int(r["enabled"])) for r in data["departments"]])
        connection.executemany("INSERT INTO users(id,name,role,department_id,enabled,created_at) VALUES(?,?,?,?,?,?)", [(r["id"], r["name"], r["role"], r["departmentId"], int(r["enabled"]), r["createdAt"]) for r in data["users"]])
        connection.executemany("INSERT INTO ideas(id,author_id,title,description,plan,status,created_at) VALUES(?,?,?,?,?,?,?)", [values(r, ["id","authorId","title","description","plan","status","createdAt"]) for r in data["ideas"]])
        connection.executemany("INSERT INTO idea_lifecycle_records(id,idea_id,action,operator_id,operator_role,from_status,to_status,comment,updated_at) VALUES(?,?,?,?,?,?,?,?,?)", [values(r, ["id","ideaId","action","operatorId","operatorRole","fromStatus","toStatus","comment","updatedAt"]) for r in data["ideaLifecycleRecords"]])
        connection.executemany("INSERT INTO comments(id,idea_id,author_id,parent_id,reply_to_user_id,content,created_at,deleted) VALUES(?,?,?,?,?,?,?,?)", [(r["id"],r["ideaId"],r["authorId"],r.get("parentId"),r.get("replyToUserId"),r["content"],r["createdAt"],int(r["deleted"])) for r in data["comments"]])
        connection.executemany("INSERT INTO idea_user_actions(id,idea_id,user_id,action_type,created_at) VALUES(?,?,?,?,?)", [values(r, ["id","ideaId","userId","actionType","createdAt"]) for r in data["ideaUserActions"]])
        connection.executemany("INSERT INTO point_records(id,user_id,department_id,idea_id,lifecycle_record_id,points,reason,source_type,created_at) VALUES(?,?,?,?,?,?,?,?,?)", [values(r, ["id","userId","departmentId","ideaId","lifecycleRecordId","points","reason","sourceType","createdAt"]) for r in data["pointRecords"]])
    violations = connection.execute("PRAGMA foreign_key_check").fetchall()
    if violations:
        raise RuntimeError(f"Foreign key violations: {violations}")
    counts = {name: connection.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0] for name in ["departments","users","ideas","idea_lifecycle_records","comments","idea_user_actions","point_records"]}
    dump = "PRAGMA foreign_keys = OFF;\n" + "\n".join(connection.iterdump()) + "\nPRAGMA foreign_keys = ON;\n"
    SQL_DUMP.write_text(dump, encoding="utf-8")
    connection.close()
    print(json.dumps(counts, ensure_ascii=False, indent=2))
    print(DATABASE)
    print(SQL_DUMP)

if __name__ == "__main__":
    build()
