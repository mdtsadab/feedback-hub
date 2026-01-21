CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  source TEXT,
  product TEXT,
  summary TEXT,
  created_at TEXT NOT NULL
);
